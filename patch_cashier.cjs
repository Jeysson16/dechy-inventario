const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Cashier.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add props to SaleDetailContent
content = content.replace(
`  paymentReference,
  setPaymentReference,
}) => {`,
`  paymentReference,
  setPaymentReference,
  documentType,
  setDocumentType,
  customerDocument,
  setCustomerDocument,
}) => {`);

// 2. Add SUNAT UI to SaleDetailContent
content = content.replace(
`              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Monto Pagado (S/)`,
`              <div className="space-y-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Tipo de Comprobante
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Nota de Venta", "Boleta", "Factura"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDocumentType(type)}
                        className={\`py-2 px-1 text-[10px] font-bold rounded-lg border \${documentType === type ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-500 border-slate-200'}\`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                {documentType !== "Nota de Venta" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      {documentType === "Factura" ? "RUC" : "DNI/RUC"}
                    </label>
                    <input
                      type="text"
                      value={customerDocument}
                      onChange={(e) => setCustomerDocument(e.target.value)}
                      placeholder={documentType === "Factura" ? "Ingrese RUC" : "Ingrese DNI/RUC"}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Monto Pagado (S/)`);

// 3. Add states to Cashier
content = content.replace(
`  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);`,
`  const [paymentReference, setPaymentReference] = useState("");
  const [documentType, setDocumentType] = useState("Nota de Venta");
  const [customerDocument, setCustomerDocument] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);`);

// 4. Update handleApprove
content = content.replace(
`      await updateDoc(doc(db, "sales", sale.id), {
        status: "pending_delivery",
        paymentDate: new Date(),
        paymentMethod,
        amountPaid: Number(amountPaid),
        paymentReference: paymentReference || "",
      });
      toast.success("Venta aprobada y pagada.");`,
`      const saleDataToUpdate = {
        status: "pending_delivery",
        paymentDate: new Date(),
        paymentMethod,
        amountPaid: Number(amountPaid),
        paymentReference: paymentReference || "",
        documentType,
        customerDocument
      };

      if (documentType !== "Nota de Venta") {
        try {
          // LLamada al backend para emitir comprobante en SUNAT
          const response = await fetch("https://dechy-inventario-backend.vercel.app/api/sunat/emitir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sale,
              documentType,
              customerDocument,
              amountPaid,
              paymentMethod
            })
          });
          const result = await response.json();
          if (result.success) {
            saleDataToUpdate.sunatStatus = "aceptado";
            saleDataToUpdate.sunatCdr = result.data.cdr;
            saleDataToUpdate.sunatPdfUrl = result.data.pdfUrl;
            toast.success("Comprobante emitido en SUNAT exitosamente.");
          } else {
            saleDataToUpdate.sunatStatus = "error";
            toast.error("Error en SUNAT: " + result.error);
          }
        } catch (error) {
          console.error("Error enviando a SUNAT:", error);
          saleDataToUpdate.sunatStatus = "pendiente";
          toast.error("No se pudo conectar con el servidor SUNAT.");
        }
      }

      await updateDoc(doc(db, "sales", sale.id), saleDataToUpdate);
      toast.success("Venta aprobada y pagada.");`);

// 5. Update resetPaymentFields
content = content.replace(
`    setPaymentReference("");
  };`,
`    setPaymentReference("");
    setDocumentType("Nota de Venta");
    setCustomerDocument("");
  };`);

// 6. Update SaleDetailContent usage (both places using global regex)
content = content.replace(/setPaymentReference=\{setPaymentReference\}\s*\/\>/g,
`setPaymentReference={setPaymentReference}
                          documentType={documentType}
                          setDocumentType={setDocumentType}
                          customerDocument={customerDocument}
                          setCustomerDocument={setCustomerDocument}
                        />`);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Cashier patched successfully");
