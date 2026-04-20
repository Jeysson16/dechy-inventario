export const SHIPPING_STEPS = [
  "Preparación",
  "En tránsito",
  "Aduanas",
  "Reparto",
  "Entregado",
];

export const NOTIFICATION_THRESHOLDS = [7, 5, 3, 1, 0];

export const SHIPMENT_ROUTE = [
  // Nota: longitudes asiáticas en formato continuo transpacífico (< -180)
  // para evitar que Leaflet dibuje rutas atravesando continentes.
  { name: "Shanghái", coords: [31.2304, -238.5263], kind: "origin" },
  { name: "Pacífico norte", coords: [25.2, -206.0], kind: "waypoint" },
  { name: "Pacífico central", coords: [11.0, -168.0], kind: "waypoint" },
  { name: "Pacífico oriental", coords: [-2.5, -124.0], kind: "waypoint" },
  { name: "Chancay", coords: [-11.56, -77.27], kind: "port" },
  { name: "Trujillo", coords: [-8.1116, -79.0287], kind: "destination" },
];

const ROUTE_TEMPLATE_NORTH = [
  [31.2304, -238.5263],
  [31.0, -225],
  [27.5, -208],
  [23.0, -191],
  [17.8, -173],
  [11.5, -155],
  [5.0, -136],
  [-1.5, -116],
  [-7.5, -97],
  [-11.56, -77.27],
  [-8.1116, -79.0287],
];

const ROUTE_TEMPLATE_DIRECT = [
  [31.2304, -238.5263],
  [24.0, -217],
  [16.0, -196],
  [7.8, -173],
  [-0.2, -149],
  [-6.2, -124],
  [-9.4, -100],
  [-11.56, -77.27],
  [-8.1116, -79.0287],
];

export const ROUTE_COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#0f766e",
];

export const STATUS_META = {
  Preparación: {
    tone: "sky",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    bar: "from-sky-500 to-cyan-400",
    accent: "text-sky-500",
  },
  "En tránsito": {
    tone: "amber",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    bar: "from-amber-500 to-orange-400",
    accent: "text-amber-500",
  },
  Aduanas: {
    tone: "violet",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    bar: "from-violet-500 to-fuchsia-400",
    accent: "text-violet-500",
  },
  Reparto: {
    tone: "emerald",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    bar: "from-emerald-500 to-lime-400",
    accent: "text-emerald-500",
  },
  Entregado: {
    tone: "slate",
    chip: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
    bar: "from-slate-800 to-slate-500",
    accent: "text-slate-700 dark:text-slate-200",
  },
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const getDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getShipmentProgress = (fechaSalida, diasEstimados = 45) => {
  const startDate = getDateValue(fechaSalida);
  if (!startDate) return 0;

  const now = new Date();
  const totalMs =
    Math.max(Number(diasEstimados) || 45, 1) * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - startDate.getTime();
  const raw = (elapsedMs / totalMs) * 100;
  return clamp(raw, 0, 100);
};

export const getShipmentStatus = (progress) => {
  const rounded = Math.round(progress);
  if (rounded <= 5) return "Preparación";
  if (rounded <= 70) return "En tránsito";
  if (rounded <= 85) return "Aduanas";
  if (rounded <= 99) return "Reparto";
  return "Entregado";
};

export const getEstimatedArrivalDate = (fechaSalida, diasEstimados = 45) => {
  const startDate = getDateValue(fechaSalida);
  if (!startDate) return null;
  const next = new Date(startDate);
  next.setDate(next.getDate() + (Number(diasEstimados) || 45));
  return next;
};

export const getDaysRemaining = (fechaSalida, diasEstimados = 45) => {
  const arrival = getEstimatedArrivalDate(fechaSalida, diasEstimados);
  if (!arrival) return null;
  const diff = arrival.getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

export const getElapsedDays = (fechaSalida) => {
  const startDate = getDateValue(fechaSalida);
  if (!startDate) return 0;
  const diff = Date.now() - startDate.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
};

export const formatDateLabel = (value) => {
  const date = getDateValue(value);
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatLongDateLabel = (value) => {
  const date = getDateValue(value);
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const getDistance = (from, to) => {
  const latDiff = to[0] - from[0];
  const lngDiff = to[1] - from[1];
  return Math.sqrt(latDiff ** 2 + lngDiff ** 2);
};

const interpolateQuadratic = (start, control, end, t) => {
  const oneMinusT = 1 - t;
  const lat =
    oneMinusT * oneMinusT * start[0] +
    2 * oneMinusT * t * control[0] +
    t * t * end[0];
  const lng =
    oneMinusT * oneMinusT * start[1] +
    2 * oneMinusT * t * control[1] +
    t * t * end[1];
  return [lat, lng];
};

const getHashValue = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getPathSegments = (points) =>
  points.slice(0, -1).map((point, index) => ({
    start: point,
    end: points[index + 1],
    length: getDistance(point, points[index + 1]),
  }));

const getPointByPathDistance = (points, targetDistance) => {
  const segments = getPathSegments(points);
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const safeTarget = clamp(targetDistance, 0, totalLength);

  let covered = 0;
  for (const segment of segments) {
    if (covered + segment.length >= safeTarget) {
      const local =
        segment.length === 0 ? 0 : (safeTarget - covered) / segment.length;
      return [
        segment.start[0] + (segment.end[0] - segment.start[0]) * local,
        segment.start[1] + (segment.end[1] - segment.start[1]) * local,
      ];
    }
    covered += segment.length;
  }

  return points.at(-1) || points[0] || [0, 0];
};

export const getShipmentRouteColor = (shipmentId, fallbackIndex = 0) => {
  if (!ROUTE_COLORS.length) return "#2563eb";
  const hashIndex = getHashValue(shipmentId || String(fallbackIndex));
  return ROUTE_COLORS[hashIndex % ROUTE_COLORS.length];
};

export const getShipmentRouteVariant = (shipmentId, fallbackIndex = 0) => {
  const hash = getHashValue(shipmentId || String(fallbackIndex));
  const variants = [-1.8, -1.2, -0.6, 0.6, 1.2, 1.8];
  return variants[hash % variants.length];
};

export const getCurvedRouteByVariant = (variant = 1, density = 10) => {
  const useNorthLane = variant < 0;
  const basePoints = useNorthLane
    ? ROUTE_TEMPLATE_NORTH
    : ROUTE_TEMPLATE_DIRECT;
  const curved = [basePoints[0]];
  const laneStrength = Math.abs(variant) * 0.4;
  const phase = Math.abs(variant) * 1.35;

  for (let index = 0; index < basePoints.length - 1; index += 1) {
    const start = basePoints[index];
    const end = basePoints[index + 1];
    const dLat = end[0] - start[0];
    const dLng = end[1] - start[1];
    const length = Math.sqrt(dLat ** 2 + dLng ** 2) || 1;
    const normal = [-dLng / length, dLat / length];
    const direction = useNorthLane ? -1 : 1;
    const wave =
      Math.sin(index * 1.3 + phase) * 0.65 +
      Math.cos(index * 0.7 + phase) * 0.35;
    const segmentCurve = direction * laneStrength * wave;
    const offsetScale = Math.min(5.8, Math.max(1.6, length * 0.045));
    const control = [
      (start[0] + end[0]) / 2 + normal[0] * segmentCurve * offsetScale,
      (start[1] + end[1]) / 2 + normal[1] * segmentCurve * offsetScale,
    ];

    for (let step = 1; step <= density; step += 1) {
      const t = step / density;
      curved.push(interpolateQuadratic(start, control, end, t));
    }
  }

  return curved;
};

export const getCurvedRouteByShipment = (shipment, fallbackIndex = 0) => {
  const variant = getShipmentRouteVariant(shipment?.id, fallbackIndex);
  return getCurvedRouteByVariant(variant);
};

export const getMarkerPositionByProgressOnRoute = (routePoints, progress) => {
  if (!routePoints?.length) return [0, 0];

  const segments = getPathSegments(routePoints);
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const target = (clamp(progress, 0, 100) / 100) * totalLength;
  return getPointByPathDistance(routePoints, target);
};

export const getProgressCurveByProgress = (routePoints, progress) => {
  if (!routePoints?.length) return [];

  const segments = getPathSegments(routePoints);
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const target = (clamp(progress, 0, 100) / 100) * totalLength;

  const result = [routePoints[0]];
  let covered = 0;

  for (const segment of segments) {
    if (covered + segment.length < target) {
      result.push(segment.end);
      covered += segment.length;
      continue;
    }

    const remaining = target - covered;
    const local =
      segment.length === 0 ? 0 : clamp(remaining / segment.length, 0, 1);
    result.push([
      segment.start[0] + (segment.end[0] - segment.start[0]) * local,
      segment.start[1] + (segment.end[1] - segment.start[1]) * local,
    ]);
    break;
  }

  return result;
};

export const getMarkerPositionByProgress = (progress) => {
  const points = SHIPMENT_ROUTE.map((point) => point.coords);
  const segments = getPathSegments(points);
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const target = (clamp(progress, 0, 100) / 100) * totalLength;

  let covered = 0;
  for (const segment of segments) {
    if (covered + segment.length >= target) {
      const local =
        segment.length === 0 ? 0 : (target - covered) / segment.length;
      return [
        segment.start[0] + (segment.end[0] - segment.start[0]) * local,
        segment.start[1] + (segment.end[1] - segment.start[1]) * local,
      ];
    }
    covered += segment.length;
  }

  return points.at(-1);
};

export const getTimelineIndex = (status) => {
  const found = SHIPPING_STEPS.findIndex((step) => step === status);
  return found === -1 ? 0 : found;
};

export const getShipmentSnapshot = (shipment) => {
  const progress = getShipmentProgress(
    shipment.fecha_salida,
    shipment.dias_estimados,
  );
  const status = getShipmentStatus(progress);
  const estimatedArrival = getEstimatedArrivalDate(
    shipment.fecha_salida,
    shipment.dias_estimados,
  );
  const daysRemaining = getDaysRemaining(
    shipment.fecha_salida,
    shipment.dias_estimados,
  );
  const elapsedDays = getElapsedDays(shipment.fecha_salida);

  return {
    ...shipment,
    progresoCalculado: progress,
    estadoCalculado: status,
    estimatedArrival,
    daysRemaining,
    elapsedDays,
    isDelayed: elapsedDays > (Number(shipment.dias_estimados) || 45),
  };
};
