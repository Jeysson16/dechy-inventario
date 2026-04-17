const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

const RUC_CACHE_COLLECTION = "ruc_cache";

const isValidRuc = (ruc) => /^\d{11}$/.test(String(ruc || "").trim());

const normalizeRucPayload = (payload, ruc) => {
  const data = payload || {};

  return {
    ruc: data.ruc || ruc,
    razon_social:
      data.razon_social || data.razonSocial || data.nombre_o_razon_social || "",
    direccion: data.direccion || data.domicilio_fiscal || "",
    estado: data.estado || "",
    condicion: data.condicion || "",
    consultado_api: true,
    raw: data,
  };
};

exports.consultarRUC = onRequest(
  {
    invoker: "public",
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({
        ok: false,
        error: "Metodo no permitido.",
      });
      return;
    }

    const ruc = String(req.query.ruc || "").trim();
    if (!isValidRuc(ruc)) {
      res.status(400).json({
        ok: false,
        error: "El RUC debe tener 11 digitos numericos.",
      });
      return;
    }

    try {
      const db = admin.firestore();
      const cacheRef = db.collection(RUC_CACHE_COLLECTION).doc(ruc);
      const cachedSnapshot = await cacheRef.get();

      if (cachedSnapshot.exists) {
        const cachedData = cachedSnapshot.data();
        res.status(200).json({
          ok: true,
          source: "cache",
          data: cachedData,
        });
        return;
      }

      const apiKey = process.env.CONSULTAPERU_API_KEY || "";
      if (!apiKey) {
        logger.error("CONSULTAPERU_API_KEY no esta configurada.");
        res.status(500).json({
          ok: false,
          error: "La clave de API no esta configurada en Functions.",
        });
        return;
      }

      const response = await axios.get(
        `https://api.consultaperuapi.com/v1/ruc/${ruc}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 15000,
        },
      );

      const normalizedData = normalizeRucPayload(response.data, ruc);
      const now = new Date();

      await cacheRef.set({
        ...normalizedData,
        fecha_consulta: now.toISOString().split("T")[0],
        consultedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        ok: true,
        source: "api",
        data: {
          ...normalizedData,
          fecha_consulta: now.toISOString().split("T")[0],
        },
      });
    } catch (error) {
      const statusCode = error?.response?.status || 500;
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        "Error consultando RUC";

      logger.error("Error consultando RUC:", {
        statusCode,
        message,
      });

      res.status(statusCode).json({
        ok: false,
        error:
          statusCode === 404
            ? "RUC no encontrado."
            : "No se pudo consultar el RUC.",
        detail: message,
      });
    }
  },
);

// Función para consultar venta por ticketNumber
exports.consultSale = onRequest(
  {
    invoker: "public",
  },
  async (req, res) => {
    const ticketNumber = req.query.ticketNumber;

    if (!ticketNumber) {
      res.status(400).send("Ticket number required");
      return;
    }

    try {
      const salesRef = admin.firestore().collection("sales");
      const query = salesRef.where("ticketNumber", "==", ticketNumber);
      const snapshot = await query.get();

      if (snapshot.empty) {
        res.status(404).send("Sale not found");
        return;
      }

      const sale = snapshot.docs[0].data();

      // Generar HTML
      const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consulta de Venta - ${sale.ticketNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f9f9f9; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          .status { font-weight: bold; color: ${sale.status === "completed" ? "green" : sale.status === "pending_delivery" ? "orange" : "red"}; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total { font-weight: bold; font-size: 1.2em; text-align: right; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Consulta de Venta</h1>
            <p><strong>Ticket:</strong> ${sale.ticketNumber}</p>
            <p><strong>Estado:</strong> <span class="status">${sale.status}</span></p>
            <p><strong>Fecha:</strong> ${sale.date ? new Date(sale.date.toDate()).toLocaleString("es-ES") : "N/A"}</p>
            <p><strong>Cliente:</strong> ${sale.customerName || "N/A"}</p>
          </div>
          <h2>Productos</h2>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${
                sale.items
                  ? sale.items
                      .map(
                        (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.price ? item.price.toFixed(2) : "0.00"}</td>
                  <td>$${item.subtotal ? item.subtotal.toFixed(2) : "0.00"}</td>
                </tr>
              `,
                      )
                      .join("")
                  : '<tr><td colspan="4">No hay productos</td></tr>'
              }
            </tbody>
          </table>
          <div class="total">
            <p>Total: $${sale.total ? sale.total.toFixed(2) : "0.00"}</p>
          </div>
        </div>
      </body>
      </html>
    `;

      res.status(200).send(html);
    } catch (error) {
      logger.error("Error consulting sale:", error);
      res.status(500).send("Error interno del servidor");
    }
  },
);
