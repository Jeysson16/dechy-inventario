const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ maxInstances: 10 });

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
