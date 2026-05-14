const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const TOKEN_SPLIT_REGEX = /[\s\-_/.,;:]+/g;

export const normalizeForSearch = (value) => {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFD")
    .replace(DIACRITIC_MARKS_REGEX, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, "");
};

export const toSearchableText = (value, depth = 0) => {
  if (value === null || value === undefined) return "";

  if (depth > 2) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSearchableText(item, depth + 1)).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map((item) => toSearchableText(item, depth + 1))
      .join(" ");
  }

  return String(value);
};

const foldText = (value) => {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFD")
    .replace(DIACRITIC_MARKS_REGEX, "")
    .toLowerCase();
};

const tokenizeQuery = (query) => {
  const folded = foldText(query);
  if (!folded) return [];

  return folded
    .split(TOKEN_SPLIT_REGEX)
    .map((part) => normalizeForSearch(part))
    .filter(Boolean);
};

const levenshteinDistanceAtMost = (a, b, maxDistance) => {
  const lenA = a.length;
  const lenB = b.length;

  if (Math.abs(lenA - lenB) > maxDistance) {
    return false;
  }

  const previous = new Array(lenB + 1);
  const current = new Array(lenB + 1);

  for (let j = 0; j <= lenB; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= lenA; i += 1) {
    current[0] = i;
    let rowMin = current[0];

    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = previous[j] + 1;
      const insertion = current[j - 1] + 1;
      const substitution = previous[j - 1] + cost;
      const dist = Math.min(deletion, insertion, substitution);

      current[j] = dist;
      rowMin = Math.min(rowMin, dist);
    }

    if (rowMin > maxDistance) {
      return false;
    }

    for (let j = 0; j <= lenB; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[lenB] <= maxDistance;
};

const hasApproximateSubstring = (target, query, maxDistance) => {
  if (!target || !query) return false;

  const qLen = query.length;
  const minLen = Math.max(1, qLen - maxDistance);
  const maxLen = Math.min(target.length, qLen + maxDistance);

  for (let size = minLen; size <= maxLen; size += 1) {
    for (let i = 0; i + size <= target.length; i += 1) {
      const fragment = target.slice(i, i + size);
      if (levenshteinDistanceAtMost(fragment, query, maxDistance)) {
        return true;
      }
    }
  }

  return false;
};

export const fuzzyIncludes = (value, query) => {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return true;

  const normalizedValue = normalizeForSearch(toSearchableText(value));
  if (!normalizedValue) return false;

  // Coincidencia exacta primero
  if (normalizedValue.includes(normalizedQuery)) return true;

  // Para queries muy cortas, requiere inclusión exacta
  if (normalizedQuery.length <= 2) {
    return normalizedValue.includes(normalizedQuery);
  }

  // Para queries más largas, permite fuzzy pero con distancia muy pequeña
  const maxDistance = normalizedQuery.length <= 4 ? 0 : 1;

  // Solo aplica fuzzy si hay suficiente similitud en longitud
  if (
    Math.abs(normalizedValue.length - normalizedQuery.length) <= maxDistance &&
    levenshteinDistanceAtMost(normalizedValue, normalizedQuery, maxDistance)
  ) {
    return true;
  }

  return false;
};

export const matchesAnyFuzzy = (query, values = []) => {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;

  const normalizedValues = values
    .map((value) => normalizeForSearch(toSearchableText(value)))
    .filter(Boolean);

  if (normalizedValues.length === 0) return false;

  return tokens.every((token) => {
    const hasNumericContent = /\d/.test(token);

    // Búsqueda de tokens numéricos: requiere que aparezca en orden (no exacto)
    if (hasNumericContent && token.length >= 2) {
      return normalizedValues.some((value) => {
        // Para números/códigos: busca substring o patrón
        if (value.includes(token)) return true;
        // Si es muy corto (1-2 caracteres), permite fuzzy
        if (token.length <= 2) return fuzzyIncludes(value, token);
        return false;
      });
    }

    // Para búsqueda de texto, usa fuzzy
    return normalizedValues.some((value) => fuzzyIncludes(value, token));
  });
};
