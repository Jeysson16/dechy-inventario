import { Link } from "react-router-dom";
import { X } from "lucide-react";

const MegaMenu = ({ categories = [], onClose }) => {
  /* Split categories into columns of up to 6 items */
  const COLS = 4;
  const colSize = Math.ceil(categories.length / COLS);
  const columns = Array.from({ length: COLS }, (_, i) =>
    categories.slice(i * colSize, i * colSize + colSize),
  ).filter((col) => col.length > 0);

  return (
    <div className="shop-megamenu">
      <div className="shop-shell py-7">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-6 size-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
          style={{ position: "absolute" }}
        >
          <X size={14} />
        </button>

        <div
          className="grid gap-x-10"
          style={{
            gridTemplateColumns: `repeat(${columns.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {/* "Ver todo" column */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
              Explorar
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link
                  to="/tienda/catalogo"
                  onClick={onClose}
                  className="text-sm font-bold text-[#B8984D] hover:text-[#CFAE70] transition-colors"
                >
                  Todos los productos
                </Link>
              </li>
              <li>
                <Link
                  to="/tienda/catalogo?filter=sale"
                  onClick={onClose}
                  className="text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Ofertas y descuentos
                </Link>
              </li>
              <li>
                <Link
                  to="/tienda/calculadora"
                  onClick={onClose}
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Calculadora de materiales
                </Link>
              </li>
            </ul>
          </div>

          {/* Category columns */}
          {columns.map((col, colIdx) => (
            <div key={colIdx}>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                Categorías
              </p>
              <ul className="space-y-1.5">
                {col.map((cat) => (
                  <li key={cat}>
                    <Link
                      to={`/tienda/catalogo?cat=${encodeURIComponent(cat)}`}
                      onClick={onClose}
                      className="text-sm text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      {cat}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MegaMenu;
