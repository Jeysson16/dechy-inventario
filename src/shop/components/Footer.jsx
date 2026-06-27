import { Link } from "react-router-dom";
import {
  Facebook,
  Instagram,
  Youtube,
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
} from "lucide-react";

const TikTokIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.15 8.15 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z" />
  </svg>
);

const PinterestIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

const SOCIAL = [
  {
    Icon: Facebook,
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61584642333339",
  },
  {
    Icon: Instagram,
    label: "Instagram",
    href: "https://www.instagram.com/dechy_imp/",
  },
  {
    Icon: TikTokIcon,
    label: "TikTok",
    href: "https://www.tiktok.com/@dechy.importacion",
  },
  { Icon: Youtube, label: "YouTube", href: "#youtube" },
  { Icon: PinterestIcon, label: "Pinterest", href: "#pinterest" },
];

const Footer = () => (
  <footer className="bg-[#0F172A] text-white mt-20">
    {/* Main columns */}
    <div className="shop-shell py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
      {/* Brand */}
      <div className="sm:col-span-2 lg:col-span-1">
        <img
          src="/img/LOGO DECHY.png"
          alt="Dechy"
          className="h-11 mb-4 object-contain brightness-0 invert"
        />
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
          Materiales de construcción premium: cielo raso, porcelanatos y
          acabados de calidad con entrega a todo el país.
        </p>
        <div className="flex flex-wrap gap-2 mt-5">
          {SOCIAL.map(({ Icon, label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="size-9 rounded-xl bg-slate-800 hover:bg-[#CFAE70] hover:text-slate-900 flex items-center justify-center text-slate-400 transition-all"
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div>
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Navegación
        </h5>
        <ul className="space-y-2.5">
          {[
            { to: "/tienda", label: "Inicio" },
            { to: "/tienda/catalogo", label: "Catálogo de productos" },
            { to: "/tienda/calculadora", label: "Calculadora de materiales" },
          ].map(({ to, label }) => (
            <li key={to}>
              <Link
                to={to}
                className="text-sm text-slate-400 hover:text-[#CFAE70] transition-colors"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Customer service */}
      <div>
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Atención al Cliente
        </h5>
        <ul className="space-y-2.5">
          {[
            "Políticas de compra",
            "Garantía de productos",
            "Devoluciones y cambios",
            "Preguntas frecuentes",
          ].map((item) => (
            <li key={item}>
              <a
                href="#"
                className="text-sm text-slate-400 hover:text-[#CFAE70] transition-colors"
              >
                {item}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact */}
      <div>
        <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
          Contacto
        </h5>
        <ul className="space-y-3">
          <li className="flex items-start gap-2.5 text-sm text-slate-400">
            <MapPin size={15} className="flex-shrink-0 text-[#CFAE70] mt-0.5" />
            Antenor Orrego N° Mz.B Lt1, Trujillo, La Libertad, Perú
          </li>
          <li>
            <a
              href="https://wa.me/51919066888"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-[#CFAE70] transition-colors"
            >
              <MessageCircle
                size={15}
                className="flex-shrink-0 text-[#CFAE70]"
              />
              +51 919 066 888
            </a>
          </li>
          <li>
            <a
              href="mailto:dechysac25@gmail.com"
              className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-[#CFAE70] transition-colors"
            >
              <Mail size={15} className="flex-shrink-0 text-[#CFAE70]" />
              dechysac25@gmail.com
            </a>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-slate-400">
            <Clock size={15} className="flex-shrink-0 text-[#CFAE70] mt-0.5" />
            Lun – Dom: 8:30 am – 7:00 pm
          </li>
        </ul>
      </div>
    </div>

    {/* Legal footer */}
    <div className="border-t border-slate-800">
      <div className="shop-shell py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <p>
          © {new Date().getFullYear()} Dechy. Todos los derechos reservados.
        </p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-slate-300 transition-colors">
            Política de Privacidad
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Términos y Condiciones
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Cookies
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
