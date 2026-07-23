export class SunatApiError extends Error {
  constructor(message, { code = "SUNAT_API_ERROR", status = 0, errors = [] } = {}) {
    super(message);
    this.name = "SunatApiError";
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!value || value.startsWith("/")) {
    return value;
  }
  if (!/^https?:\/\//i.test(value)) {
    throw new SunatApiError("VITE_BACKEND_URL no está configurada correctamente.", {
      code: "INVALID_BACKEND_URL",
    });
  }
  return value;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new SunatApiError("El servicio SUNAT devolvió una respuesta no válida.", {
      code: "INVALID_JSON_RESPONSE",
      status: response.status,
    });
  }
}

async function authenticatedHeaders() {
  const { auth } = await import("../config/firebase.js");
  const user = auth.currentUser;
  if (!user) {
    throw new SunatApiError("Debe iniciar sesión para usar el servicio SUNAT.", {
      code: "AUTH_REQUIRED",
      status: 401,
    });
  }
  // SUNAT is a protected fiscal operation. Force a fresh Firebase ID token so
  // the backend never receives a token that expired while the sales screen was
  // kept open for a long time.
  const token = await user.getIdToken(true);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function authenticatedRequest(path, {
  method = "GET",
  body,
  baseUrl = import.meta.env.VITE_BACKEND_URL || "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 30000,
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}${path}`, {
      method,
      headers: await authenticatedHeaders(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const result = await readJson(response);
    if (!response.ok || result?.success !== true) {
      throw new SunatApiError(result?.message || "La operación SUNAT no pudo completarse.", {
        code: result?.code,
        status: response.status,
        errors: result?.details || result?.errors || [],
      });
    }
    return result.data;
  } catch (error) {
    if (error instanceof SunatApiError) throw error;
    if (error?.name === "AbortError") {
      throw new SunatApiError("El servicio SUNAT no respondió a tiempo.", { code: "SUNAT_API_TIMEOUT" });
    }
    throw new SunatApiError("No se pudo conectar con el servicio interno SUNAT.", {
      code: "SUNAT_API_UNREACHABLE",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assertSafeDraft(result, status) {
  const draft = result?.data;
  const safe =
    result?.success === true &&
    draft?.status === "DRAFT_UNSIGNED_NOT_SENT" &&
    draft?.sentToSunat === false &&
    draft?.signed === false &&
    draft?.cdr === null &&
    typeof draft?.documentId === "string" &&
    typeof draft?.xml === "string" &&
    draft.xml.startsWith("<?xml");
  if (!safe) {
    throw new SunatApiError(
      "El backend no confirmó un borrador XML seguro, sin firma y sin envío.",
      { code: "UNSAFE_DRAFT_RESPONSE", status },
    );
  }
  return draft;
}

export async function previewSunatDocument(
  payload,
  { baseUrl = import.meta.env.VITE_BACKEND_URL || "", fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {},
) {
  const url = `${normalizeBaseUrl(baseUrl)}/api/sunat/preview`;
  if (typeof fetchImpl !== "function") {
    throw new SunatApiError("No hay un cliente HTTP disponible.", { code: "FETCH_UNAVAILABLE" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await readJson(response);
    if (!response.ok || result?.success !== true) {
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      const details = errors.map((item) => item?.message).filter(Boolean).join(" ");
      throw new SunatApiError(
        details || result?.message || "El borrador no pasó la validación.",
        { code: result?.code, status: response.status, errors },
      );
    }
    return assertSafeDraft(result, response.status);
  } catch (error) {
    if (error instanceof SunatApiError) throw error;
    if (error?.name === "AbortError") {
      throw new SunatApiError("El servicio SUNAT no respondió a tiempo.", { code: "SUNAT_API_TIMEOUT" });
    }
    throw new SunatApiError("No se pudo conectar con el servicio interno SUNAT.", {
      code: "SUNAT_API_UNREACHABLE",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function getSunatConfigStatus(options) {
  return authenticatedRequest("/api/sunat/config/status", options);
}

export function saveSunatConfig(config, options) {
  return authenticatedRequest("/api/sunat/config", { ...options, method: "PUT", body: config });
}

export function previewSunatSale(saleId, options) {
  return authenticatedRequest(`/api/sunat/sales/${encodeURIComponent(saleId)}/preview`, options);
}

export function sendSunatSale(saleId, { environment = "beta", ...options } = {}) {
  return authenticatedRequest(`/api/sunat/sales/${encodeURIComponent(saleId)}/send`, {
    ...options,
    method: "POST",
    body: { environment },
    timeoutMs: options.timeoutMs || 45000,
  });
}
