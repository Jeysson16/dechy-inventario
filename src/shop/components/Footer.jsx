import { Facebook, Instagram, MessageCircle } from "lucide-react";

const Footer = () => {
  return (
    <footer className="mt-16 border-t border-slate-700/60 bg-slate-950/60">
      <div className="shop-shell grid gap-8 py-10 md:grid-cols-3">
        <div>
          <h4 className="text-lg font-black text-slate-100">
            Dechy <span className="text-[#CFAE70]">Store</span>
          </h4>
          <p className="mt-3 text-sm text-slate-400">
            Diseno elegante, envio seguro y seguimiento completo de tus pedidos.
          </p>
        </div>

        <div>
          <h5 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Contacto
          </h5>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>Trujillo, Peru</li>
            <li>+51 999 999 999</li>
            <li>soporte@dechy.com</li>
          </ul>
        </div>

        <div>
          <h5 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Redes
          </h5>
          <div className="mt-3 flex gap-2">
            <a
              className="rounded-lg bg-slate-800 p-2 text-slate-200 hover:text-[#CFAE70]"
              href="#"
              aria-label="Facebook"
            >
              <Facebook size={18} />
            </a>
            <a
              className="rounded-lg bg-slate-800 p-2 text-slate-200 hover:text-[#CFAE70]"
              href="#"
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
            <a
              className="rounded-lg bg-slate-800 p-2 text-slate-200 hover:text-[#CFAE70]"
              href="#"
              aria-label="WhatsApp"
            >
              <MessageCircle size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
