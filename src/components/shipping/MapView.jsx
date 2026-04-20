import { Fragment, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";

import {
  ROUTE_COLORS,
  SHIPMENT_ROUTE,
  clamp,
  getCurvedRouteByShipment,
  getProgressCurveByProgress,
  getMarkerPositionByProgressOnRoute,
  getShipmentRouteColor,
} from "../../utils/shipping";
import "./shipping-map.css";

const hexToRgba = (hex, alpha = 0.5) => {
  const cleaned = hex.replace("#", "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : cleaned;

  const value = parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const MapView = ({ shipments = [], selectedShipmentId = null }) => {
  const fleet = useMemo(
    () =>
      shipments.map((shipment, index) => {
        const route = getCurvedRouteByShipment(shipment, index);
        const progress = clamp(shipment?.progresoCalculado ?? 0, 0, 100);
        const progressCurve = getProgressCurveByProgress(route, progress);
        const markerPosition = getMarkerPositionByProgressOnRoute(
          route,
          progress,
        );
        const color = getShipmentRouteColor(shipment?.id, index);
        const glow = hexToRgba(color, 0.48);
        const markerIcon = L.divIcon({
          className: "shipment-live-marker",
          html: `<div class="shipment-marker-pulse fleet" style="--marker-color: ${color}; --marker-glow: ${glow};"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        return {
          shipment,
          route,
          progress,
          progressCurve,
          markerPosition,
          color,
          markerIcon,
          selected: selectedShipmentId === shipment.id,
        };
      }),
    [shipments, selectedShipmentId],
  );

  const routeCoordinates = SHIPMENT_ROUTE.map((point) => point.coords);

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
          Mapa simulado
        </p>
        <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
          Rutas marítimas curvas por pedido
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Cada curva representa el progreso logístico real de un pedido activo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ROUTE_COLORS.slice(0, 6).map((color) => (
            <span
              key={color}
              className="h-2.5 w-8 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="h-[360px] isolate">
        <MapContainer
          center={[10, -150]}
          zoom={2}
          minZoom={2}
          maxZoom={5}
          scrollWheelZoom={false}
          worldCopyJump
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {fleet.map((item) => (
            <Fragment key={`route-${item.shipment.id}`}>
              <Polyline
                positions={item.route}
                pathOptions={{
                  color: "#475569",
                  weight: item.selected ? 4 : 3,
                  opacity: item.selected ? 0.35 : 0.24,
                  dashArray: "8 10",
                }}
              />
              <Polyline
                positions={item.progressCurve}
                pathOptions={{
                  color: item.color,
                  weight: item.selected ? 7 : 5,
                  opacity: item.selected ? 0.95 : 0.8,
                }}
              />
            </Fragment>
          ))}

          {SHIPMENT_ROUTE.filter((point) => point.kind !== "waypoint").map(
            (point) => (
              <CircleMarker
                key={point.name}
                center={point.coords}
                radius={point.kind === "destination" ? 9 : 7}
                pathOptions={{
                  color: "#ffffff",
                  fillColor:
                    point.kind === "destination" ? "#16a34a" : "#2563eb",
                  fillOpacity: 1,
                  weight: 3,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <div className="text-xs font-bold">{point.name}</div>
                </Tooltip>
              </CircleMarker>
            ),
          )}

          {fleet.map((item) => (
            <Marker
              key={`marker-${item.shipment.id}`}
              position={item.markerPosition}
              icon={item.markerIcon}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <div className="space-y-1 text-xs">
                  <p className="font-black">{item.shipment.id_contenedor}</p>
                  <p>Estado: {item.shipment.estadoCalculado}</p>
                  <p>Progreso: {Math.round(item.progress)}%</p>
                </div>
              </Tooltip>
            </Marker>
          ))}

          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#0f172a",
              weight: 2,
              opacity: 0.18,
            }}
          />
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;
