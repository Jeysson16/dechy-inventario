import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import toast from "react-hot-toast";

import { db, storage } from "../../config/firebase";

// ─── Fix Leaflet default icon (Vite / bundler issue) ───────────────────────
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom pin icon for pending location
const pendingIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "hue-rotate-[200deg]",
});

// ─── Constants ────────────────────────────────────────────────────────────────
const PERU_CENTER = [-9.19, -75.015];
const PERU_ZOOM = 6;

// ─── Sub-component: Search control ──────────────────────────────────────────
const SearchControl = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const map = useMap();

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(term)}&limit=5&countrycodes=pe`,
        { headers: { "Accept-Language": "es" } },
      );
      const data = await res.json();
      setResults(data);
    } catch {
      toast.error("Error al buscar ubicación.");
    } finally {
      setSearching(false);
    }
  };

  const flyTo = (item) => {
    map.flyTo([parseFloat(item.lat), parseFloat(item.lon)], 14, { animate: true });
    setResults([]);
    setQuery(item.display_name.split(",")[0]);
  };

  return (
    <div className="absolute top-3 left-12 z-[1000] w-72">
      <div className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Buscar ubicación en Perú..."
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white shadow-md outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="px-3 py-2 bg-primary text-white rounded-xl shadow-md hover:bg-primary/90 transition-colors"
        >
          {searching ? (
            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-sm">search</span>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden max-h-52 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => flyTo(r)}
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0 text-slate-700"
            >
              <span className="font-semibold">{r.display_name.split(",")[0]}</span>
              <span className="text-slate-400 ml-1 truncate">
                {r.display_name.split(",").slice(1, 3).join(",")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sub-component: Map click handler ───────────────────────────────────────
const MapClickHandler = ({ active, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (active) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

// ─── Sub-component: FlyTo controller ────────────────────────────────────────
const FlyToController = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target && typeof target.lat === "number") {
      map.flyTo([target.lat, target.lng], 15, { animate: true, duration: 1.2 });
    }
  }, [target, map]);
  return null;
};

// ─── Sub-component: Location assign panel ───────────────────────────────────
const LocationAssignPanel = ({ customers, pendingCoords, onAssign, onCancel }) => {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5 MB.");
      return;
    }
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      toast.error("Selecciona un cliente.");
      return;
    }
    setSaving(true);
    try {
      let localPhotoUrl = undefined;
      if (photoFile) {
        const sRef = storageRef(
          storage,
          `customers/${selectedCustomer}/local_${Date.now()}.jpg`,
        );
        await uploadBytes(sRef, photoFile);
        localPhotoUrl = await getDownloadURL(sRef);
      }

      const update = {
        lat: pendingCoords.lat,
        lng: pendingCoords.lng,
      };
      if (localPhotoUrl !== undefined) update.localPhotoUrl = localPhotoUrl;

      await updateDoc(doc(db, "customers", selectedCustomer), update);
      toast.success("Ubicación guardada correctamente.");
      onAssign();
    } catch (err) {
      console.error("Error saving location:", err);
      toast.error("No se pudo guardar la ubicación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">
          Asignar ubicación
        </p>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <p className="text-[10px] text-slate-400 bg-slate-50 rounded-lg px-2 py-1 mb-3 font-mono">
        {pendingCoords.lat.toFixed(6)}, {pendingCoords.lng.toFixed(6)}
      </p>

      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
        Cliente
      </label>
      <select
        value={selectedCustomer}
        onChange={(e) => setSelectedCustomer(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm mb-4 outline-none bg-slate-50 focus:ring-2 focus:ring-primary/20"
      >
        <option value="">— Seleccionar cliente —</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.customerName}
            {c.customerDNI ? ` (${c.customerDNI})` : ""}
          </option>
        ))}
      </select>

      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
        Foto del local <span className="font-normal normal-case text-slate-400">(opcional)</span>
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={handlePhoto}
        className="w-full text-xs text-slate-600 mb-2 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-bold cursor-pointer"
      />
      {preview && (
        <img
          src={preview}
          alt="Vista previa"
          className="w-full h-28 object-cover rounded-xl mb-3 border border-slate-100"
        />
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              Guardando
            </span>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Main CustomerMap component ──────────────────────────────────────────────
/**
 * Props:
 *  customers       – array of customer objects
 *  flyToCustomer   – { lat, lng, key } — change key to trigger fly
 *  onCustomerClick – (customer) => void
 */
const CustomerMap = ({ customers = [], flyToCustomer = null, onCustomerClick }) => {
  const [addingMode, setAddingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const mapRef = useRef(null);

  // Only render customers that have valid coordinates
  const mappedCustomers = customers.filter(
    (c) => typeof c.lat === "number" && typeof c.lng === "number",
  );

  const handleGeoLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no disponible en este navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPendingCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddingMode(false);
      },
      () => toast.error("No se pudo obtener tu ubicación."),
      { timeout: 10000 },
    );
  };

  const handleToggleAddingMode = () => {
    setAddingMode((v) => !v);
    setPendingCoords(null);
  };

  return (
    <div className="relative w-full h-full" style={{ isolation: "isolate" }}>
      <MapContainer
        center={PERU_CENTER}
        zoom={PERU_ZOOM}
        style={{ width: "100%", height: "100%" }}
        ref={mapRef}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* External fly-to from parent (e.g. table map icon) */}
        {flyToCustomer && (
          <FlyToController target={flyToCustomer} key={flyToCustomer.key} />
        )}

        {/* Map click handler */}
        <MapClickHandler
          active={addingMode}
          onMapClick={(coords) => {
            setPendingCoords(coords);
            setAddingMode(false);
          }}
        />

        {/* Clustered markers */}
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
          {mappedCustomers.map((customer) => (
            <Marker
              key={customer.id}
              position={[customer.lat, customer.lng]}
              eventHandlers={{ click: () => onCustomerClick?.(customer) }}
            >
              {/* Tooltip shown on hover */}
              <Tooltip
                direction="top"
                offset={[0, -12]}
                opacity={1}
                className="leaflet-customer-tooltip"
              >
                <div style={{ textAlign: "center", minWidth: 140, maxWidth: 200 }}>
                  {customer.localPhotoUrl ? (
                    <img
                      src={customer.localPhotoUrl}
                      alt={customer.customerName}
                      style={{
                        width: "100%",
                        height: 90,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 6,
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 60,
                        background: "#f1f5f9",
                        borderRadius: 8,
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94a3b8",
                        fontSize: 24,
                      }}
                    >
                      🏪
                    </div>
                  )}
                  <p style={{ fontWeight: 900, fontSize: 13, margin: 0, color: "#0f172a" }}>
                    {customer.customerName}
                  </p>
                  {customer.customerDNI && (
                    <p style={{ fontSize: 11, margin: "2px 0 0", color: "#64748b" }}>
                      {customer.customerDNI}
                    </p>
                  )}
                </div>
              </Tooltip>

              {/* Popup shown on click */}
              <Popup maxWidth={220}>
                <div style={{ minWidth: 180 }}>
                  {customer.localPhotoUrl && (
                    <img
                      src={customer.localPhotoUrl}
                      alt={customer.customerName}
                      style={{
                        width: "100%",
                        height: 110,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 8,
                        display: "block",
                      }}
                    />
                  )}
                  <p style={{ fontWeight: 900, fontSize: 14, margin: "0 0 4px", color: "#0f172a" }}>
                    {customer.customerName}
                  </p>
                  {customer.customerDNI && (
                    <p style={{ fontSize: 12, margin: "2px 0", color: "#64748b" }}>
                      <strong>DNI/RUC:</strong> {customer.customerDNI}
                    </p>
                  )}
                  {customer.phone && (
                    <p style={{ fontSize: 12, margin: "2px 0", color: "#64748b" }}>
                      <strong>Tel:</strong> {customer.phone}
                    </p>
                  )}
                  {customer.address && (
                    <p style={{ fontSize: 12, margin: "2px 0", color: "#64748b" }}>
                      {customer.address}
                    </p>
                  )}
                  <p style={{ fontSize: 11, margin: "6px 0 0", color: "#94a3b8" }}>
                    Ventas: {Number(customer.totalSalesCount || 0)} · S/{" "}
                    {Number(customer.totalSalesAmount || 0).toFixed(2)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Pending new location marker */}
        {pendingCoords && (
          <Marker position={[pendingCoords.lat, pendingCoords.lng]} icon={pendingIcon} />
        )}
      </MapContainer>

      {/* ── Control buttons (bottom-right) ── */}
      <div className="absolute bottom-5 right-3 z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={handleGeoLocation}
          title="Usar mi ubicación"
          className="size-10 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-base text-slate-600">my_location</span>
        </button>

        <button
          type="button"
          onClick={handleToggleAddingMode}
          title={addingMode ? "Cancelar" : "Marcar ubicación en mapa"}
          className={`size-10 rounded-xl shadow-md border flex items-center justify-center transition-colors ${
            addingMode
              ? "bg-primary text-white border-primary"
              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
          }`}
        >
          <span className="material-symbols-outlined text-base">add_location_alt</span>
        </button>
      </div>

      {/* ── Adding-mode hint ── */}
      {addingMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg pointer-events-none animate-pulse">
          Haz clic en el mapa para marcar la ubicación
        </div>
      )}

      {/* ── Location assign panel ── */}
      {pendingCoords && !addingMode && (
        <LocationAssignPanel
          customers={customers}
          pendingCoords={pendingCoords}
          onAssign={() => setPendingCoords(null)}
          onCancel={() => setPendingCoords(null)}
        />
      )}
    </div>
  );
};

export default CustomerMap;
