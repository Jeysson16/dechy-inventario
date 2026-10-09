import React from 'react';
import { Phone, Mail, MapPin, ArrowUpRight } from 'lucide-react';

interface ContactoProps {
  branch: any;
  primaryColor: string;
  bannerImage?: string;
}

// The branch stores WhatsApp either as a wa.me/api.whatsapp link or as a bare number
const whatsappUrl = (raw: string) => {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9) digits = `51${digits}`; // Peru country code
  return digits ? `https://wa.me/${digits}` : '';
};

const whatsappLabel = (raw: string) => {
  const match = raw.match(/(?:wa\.me\/|phone=)(\d+)/);
  return match ? `+${match[1]}` : raw;
};

const socialUrl = (raw: string, base: string) => {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${base}${raw.replace(/^@/, '')}`;
};

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.46 9.44zm8.04-17.48A11.3 11.3 0 0 0 12.05.5C5.78.5.68 5.6.68 11.86c0 2 .52 3.96 1.52 5.68L.58 23.5l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.37-11.37 0-3.03-1.18-5.89-3.34-8.04z" />
  </svg>
);

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.3c0-.9.26-1.5 1.56-1.5h1.66V3.96a22 22 0 0 0-2.42-.13c-2.4 0-4.04 1.46-4.04 4.15v2.32H7.56v3.2h2.71v8h3.23z" />
  </svg>
);

// "Contacto" tab: everything comes from the company's own settings in the
// inventory (Empresas → contacto y redes), so each company shows its own data
export const Contacto: React.FC<ContactoProps> = ({ branch, primaryColor, bannerImage }) => {
  const cfg = branch?.configuracion || {};
  const telefono: string = cfg.contacto?.telefono || branch?.telefono || '';
  const correo: string = cfg.contacto?.correo || branch?.correo || '';
  const direccion: string = cfg.contacto?.direccion || branch?.location || '';
  const whatsappRaw: string = cfg.redes_sociales?.whatsapp || '';
  const instagram: string = cfg.redes_sociales?.instagram || '';
  const facebook: string = cfg.redes_sociales?.facebook || '';

  const channels = [
    telefono && {
      key: 'tel', label: 'Teléfono', value: telefono, href: `tel:${telefono.replace(/[^\d+]/g, '')}`,
      icon: <Phone className="w-5 h-5" />,
    },
    (whatsappRaw || telefono) && {
      key: 'wa', label: 'WhatsApp', value: whatsappRaw ? whatsappLabel(whatsappRaw) : telefono, href: whatsappUrl(whatsappRaw || telefono),
      icon: <WhatsAppIcon className="w-5 h-5" />,
    },
    correo && {
      key: 'mail', label: 'Correo electrónico', value: correo, href: `mailto:${correo}`,
      icon: <Mail className="w-5 h-5" />,
    },
    direccion && {
      key: 'map', label: 'Dirección', value: direccion, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`,
      icon: <MapPin className="w-5 h-5" />,
    },
  ].filter(Boolean) as { key: string; label: string; value: string; href: string; icon: React.ReactNode }[];

  const socials = [
    instagram && { key: 'ig', label: 'Instagram', href: socialUrl(instagram, 'https://instagram.com/'), icon: <InstagramIcon className="w-5 h-5" /> },
    facebook && { key: 'fb', label: 'Facebook', href: socialUrl(facebook, 'https://facebook.com/'), icon: <FacebookIcon className="w-5 h-5" /> },
    whatsappRaw && { key: 'wa', label: 'WhatsApp', href: whatsappUrl(whatsappRaw), icon: <WhatsAppIcon className="w-5 h-5" /> },
  ].filter(Boolean) as { key: string; label: string; href: string; icon: React.ReactNode }[];

  return (
    <>
      {/* Banner de página */}
      <div className="relative py-16 px-6 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={bannerImage || '/img/hero_lifestyle_bg.png'} className="w-full h-full object-cover opacity-25 filter blur-sm scale-105" alt="" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>Inicio</span>
            <span className="opacity-60">/</span>
            <span style={{ color: primaryColor }} className="font-semibold">Contacto</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight max-w-xl">
            Hablemos de <span className="italic" style={{ color: primaryColor }}>tu proyecto</span>
          </h1>
          <p className="text-sm text-slate-300 font-light max-w-lg">
            Escríbenos o llámanos: te asesoramos con medidas, cantidades y disponibilidad.
          </p>
        </div>
      </div>

      <section className="py-14 px-4 sm:px-6 bg-[#f7f7f7] dark:bg-[#0c0c0e]">
        <div className="max-w-6xl mx-auto space-y-12">
          {channels.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-10">Pronto publicaremos nuestros datos de contacto.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {channels.map(c => (
                <a
                  key={c.key}
                  href={c.href}
                  target={c.key === 'tel' || c.key === 'mail' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="group rounded-3xl p-6 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                      {c.icon}
                    </span>
                    <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">{c.label}</span>
                    <span className="mt-1 block text-[15px] font-semibold text-slate-900 dark:text-white break-words">{c.value}</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {socials.length > 0 && (
            <div className="text-center space-y-5">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">Síguenos</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-950 dark:text-white font-normal">Nuestras redes</h2>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {socials.map(s => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  >
                    <span style={{ color: primaryColor }}>{s.icon}</span>
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
