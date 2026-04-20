import {
  FileSpreadsheet,
  FileText,
  FileUp,
  FileWarning,
  Download,
  Upload,
} from "lucide-react";

import { formatDateLabel } from "../../utils/shipping";

const getFileIcon = (name = "") => {
  const lowered = name.toLowerCase();
  if (
    lowered.endsWith(".xlsx") ||
    lowered.endsWith(".xls") ||
    lowered.endsWith(".csv")
  ) {
    return FileSpreadsheet;
  }
  if (
    lowered.endsWith(".pdf") ||
    lowered.endsWith(".doc") ||
    lowered.endsWith(".docx")
  ) {
    return FileText;
  }
  return FileWarning;
};

const DocumentManager = ({
  shipment,
  pendingFiles,
  onPendingFilesChange,
  onUploadDocuments,
  uploading,
}) => {
  const existingDocuments = shipment?.documentos || [];

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    onPendingFilesChange([...(pendingFiles || []), ...files]);
    event.target.value = "";
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
            Documentos
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
            Soporte logístico
          </h3>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/15">
          <Upload className="h-4 w-4" />
          Adjuntar
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
            className="hidden"
            onChange={handleFileSelection}
          />
        </label>
      </div>

      {!!pendingFiles?.length && (
        <div className="mt-5 rounded-3xl border border-dashed border-primary/25 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              Archivos pendientes
            </p>
            {shipment?.id && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => onUploadDocuments?.(pendingFiles)}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" />
                {uploading ? "Subiendo..." : "Subir ahora"}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {pendingFiles.map((file) => (
              <div
                key={`${file.name}-${file.lastModified}`}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 dark:bg-slate-950/60"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {existingDocuments.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            No hay documentos subidos todavía.
          </div>
        ) : (
          existingDocuments.map((document) => {
            const Icon = getFileIcon(document.name);
            return (
              <div
                key={document.url}
                className="flex items-center justify-between rounded-3xl border border-slate-200 px-4 py-4 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {document.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {document.type || "Documento"} •{" "}
                      {formatDateLabel(document.uploadedAt)}
                    </p>
                  </div>
                </div>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </a>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DocumentManager;
