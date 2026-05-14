import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
} from "react-leaflet";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";

const route = [
  [-12.0464, -77.0428],
  [-8.1091, -79.0215],
  [31.2304, 121.4737],
].reverse();

const timeline = [
  { id: 1, title: "Produccion completada", date: "03 Ene 2026", done: true },
  {
    id: 2,
    title: "Salida de puerto en China",
    date: "08 Ene 2026",
    done: true,
  },
  { id: 3, title: "Arribo a Callao", date: "27 Ene 2026", done: true },
  { id: 4, title: "En ruta a Trujillo", date: "29 Ene 2026", done: false },
  { id: 5, title: "Entrega final", date: "Estimado 31 Ene 2026", done: false },
];

const docs = [
  "Factura comercial",
  "Packing list",
  "BL / Guia maritima",
  "Comprobante de despacho",
];

const TrackingPage = () => {
  const [searchParams] = useSearchParams();
  const order = searchParams.get("order") || "Sin codigo";

  const progress = useMemo(() => {
    const done = timeline.filter((step) => step.done).length;
    return Math.round((done / timeline.length) * 100);
  }, []);

  const markerPosition =
    route[Math.max(Math.floor((progress / 100) * (route.length - 1)), 0)];

  return (
    <div className="space-y-8 py-8">
      <section className="rounded-3xl border border-slate-700/60 bg-gradient-to-r from-[#111c32] to-[#0b1220] p-6">
        <p className="text-sm uppercase tracking-wider text-slate-400">
          Tracking de pedido
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-100">
          Orden: {order}
        </h1>
        <p className="mt-1 text-slate-300">
          Ruta estimada China - Callao - Trujillo
        </p>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2 }}
            className="h-full rounded-full bg-[#CFAE70]"
          />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Progreso logistica: {progress}%
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <article className="shop-card overflow-hidden rounded-2xl p-3">
          <MapContainer
            center={[-9.6, -83]}
            zoom={3}
            className="h-[380px] w-full rounded-xl"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline
              positions={route}
              pathOptions={{ color: "#CFAE70", weight: 4 }}
            />
            <CircleMarker
              center={markerPosition}
              radius={10}
              pathOptions={{ color: "#CFAE70" }}
            >
              <Popup>Pedido en transito</Popup>
            </CircleMarker>
          </MapContainer>
        </article>

        <article className="space-y-4">
          <div className="shop-card rounded-2xl p-4">
            <h2 className="text-lg font-black text-slate-100">
              Linea de tiempo
            </h2>
            <ol className="mt-4 space-y-3">
              {timeline.map((step) => (
                <li key={step.id} className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${step.done ? "bg-[#CFAE70]" : "bg-slate-500"}`}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-400">{step.date}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="shop-card rounded-2xl p-4">
            <h2 className="text-lg font-black text-slate-100">Documentos</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {docs.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>
    </div>
  );
};

export default TrackingPage;
