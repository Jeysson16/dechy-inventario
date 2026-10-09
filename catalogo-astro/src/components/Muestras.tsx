import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Truck, CheckCircle2 } from 'lucide-react';

interface MuestrasProps {
  branch: any;
  primaryColor: string;
  bannerImage?: string;
}

// Departamento → provincias → distritos (INEI ubigeo), served from /public so the
// ~50 KB list only loads when someone opens this tab
type District = [string, string];
type Province = { id: string; n: string; d: District[] };
type Department = { id: string; n: string; p: Province[] };

const BUSINESS_TYPES = [
  'Tengo una tienda o ferretería',
  'Quiero emprender / revender',
  'Soy instalador o contratista',
  'Arquitecto / diseñador de interiores',
  'Otro',
];

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  email: '',
  businessName: '',
  businessType: '',
  departmentId: '',
  provinceId: '',
  districtId: '',
  address: '',
  reference: '',
  message: '',
  website: '', // honeypot: real visitors never see or fill it
};

const whatsappNumber = (branch: any) => {
  const raw: string = branch?.configuracion?.redes_sociales?.whatsapp || branch?.configuracion?.contacto?.telefono || branch?.telefono || '';
  const fromLink = raw.match(/(?:wa\.me\/|phone=)(\d+)/);
  if (fromLink) return fromLink[1];
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 9) digits = `51${digits}`;
  return digits || '51946303481'; // same fallback as the catalog's order button
};

// How each "¿Qué te describe mejor?" option reads inside the message ("dedicado al rubro de …");
// "Otro" has no phrase, so that clause is left out
const BUSINESS_PHRASES: Record<string, string> = {
  'Tengo una tienda o ferretería': 'tienda o ferretería',
  'Quiero emprender / revender': 'emprendimiento y reventa de productos',
  'Soy instalador o contratista': 'instalación y contratación de obras',
  'Arquitecto / diseñador de interiores': 'arquitectura y diseño de interiores',
};

type MessageData = {
  company: string; fullName: string; businessName: string; businessType: string;
  district: string; province: string; department: string;
  phone: string; email: string; address: string; reference: string; message: string;
};

// Letter-style WhatsApp message; optional fields drop their sentence when empty
const buildMessage = (d: MessageData) => {
  const rubro = BUSINESS_PHRASES[d.businessType];
  const place = `${d.district}, provincia de ${d.province}, departamento de ${d.department}`;
  const intro = d.businessName
    ? `Tengo un negocio llamado ${d.businessName}${rubro ? `, dedicado al rubro de ${rubro}` : ''}, ubicado en ${place}.`
    : `${rubro ? `Me dedico al rubro de ${rubro} y me` : 'Me'} encuentro en ${place}.`;
  return [
    `Hola, equipo de ${d.company}. Mi nombre es ${d.fullName} y me comunico con ustedes para solicitar muestras gratuitas de sus productos. ${intro}`,
    'Me gustaría conocer de cerca la calidad, los acabados y los diseños de sus productos para evaluar su incorporación a mi negocio.',
    `Pueden contactarme al celular ${d.phone} o escribirme al correo ${d.email}. Mi dirección es ${d.address}${d.reference ? `, tomando como referencia ${d.reference}` : ''}.`,
    d.message && `Como comentario adicional, quisiera indicar lo siguiente: ${d.message}${/[.!?]$/.test(d.message) ? '' : '.'}`,
    'Agradezco su atención y quedo pendiente de su respuesta para coordinar la disponibilidad y entrega de las muestras.',
    '¡Muchas gracias!',
  ].filter(Boolean).join('\n\n');
};

const inputClass =
  'w-full text-[14px] px-4 py-3 rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10 outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-white/30 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-50';

const Field: React.FC<{ label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }> = ({ label, required, error, className = '', children }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    {children}
    {error && <span className="block text-[12px] text-red-500">{error}</span>}
  </label>
);

// "Muestras gratis" tab: people who want to sell the products ask for physical
// samples. Nothing is stored: the request goes to the company's WhatsApp as a
// pre-filled message the visitor sends from their own phone.
export const Muestras: React.FC<MuestrasProps> = ({ branch, primaryColor, bannerImage }) => {
  const [ubigeo, setUbigeo] = useState<Department[]>([]);
  const [ubigeoError, setUbigeoError] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<null | { summary: string }>(null);

  useEffect(() => {
    fetch('/data/ubigeo-peru.json')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setUbigeo)
      .catch(() => setUbigeoError(true));
  }, []);

  const department = useMemo(() => ubigeo.find(d => d.id === form.departmentId), [ubigeo, form.departmentId]);
  const province = useMemo(() => department?.p.find(p => p.id === form.provinceId), [department, form.provinceId]);
  const district = useMemo(() => province?.d.find(d => d[0] === form.districtId), [province, form.districtId]);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // Changing a level of the location clears the levels below it
      if (key === 'departmentId') { next.provinceId = ''; next.districtId = ''; }
      if (key === 'provinceId') next.districtId = '';
      return next;
    });
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 3) e.fullName = 'Ingresa tus nombres y apellidos.';
    if (!/^9\d{8}$/.test(form.phone)) e.phone = 'Ingresa un celular de 9 dígitos que empiece con 9.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Ingresa un correo válido.';
    if (!form.businessType) e.businessType = 'Cuéntanos qué tipo de negocio tienes.';
    if (!form.departmentId) e.departmentId = 'Elige el departamento.';
    if (!form.provinceId) e.provinceId = 'Elige la provincia.';
    if (!form.districtId) e.districtId = 'Elige el distrito.';
    if (form.address.trim().length < 5) e.address = 'Ingresa la dirección de entrega.';
    if (!consent) e.consent = 'Necesitamos tu autorización para contactarte.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const waNumber = whatsappNumber(branch);
  const waLink = (summary: string) => `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(summary)}`;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (form.website) return; // bot filled the hidden field
    if (!validate()) return;
    const summary = buildMessage({
      company: branch?.name || 'DECHY',
      fullName: form.fullName.trim(),
      businessName: form.businessName.trim(),
      businessType: form.businessType,
      district: district?.[1] || '',
      province: province?.n || '',
      department: department?.n || '',
      phone: form.phone,
      email: form.email.trim().toLowerCase(),
      address: form.address.trim(),
      reference: form.reference.trim(),
      message: form.message.trim(),
    });
    // Opened inside the submit handler so pop-up blockers allow it
    window.open(waLink(summary), '_blank', 'noopener');
    setSent({ summary });
    setForm(EMPTY_FORM);
    setConsent(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            <span style={{ color: primaryColor }} className="font-semibold">Muestras gratis</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
            Pide tus muestras <span style={{ color: primaryColor }}>totalmente gratis</span>
          </h1>
          <p className="text-sm text-slate-300 font-light max-w-xl">
            ¿Tienes una tienda o quieres emprender? Te enviamos muestras físicas de nuestros productos para que las conozcas, las muestres a tus clientes y empieces a vender.
          </p>
        </div>
      </div>

      <section className="py-14 px-4 sm:px-6 bg-[#f7f7f7] dark:bg-[#0c0c0e]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_2fr] gap-10">
          {/* Beneficios */}
          <aside className="space-y-4">
            {[
              { icon: <Gift className="w-5 h-5" />, title: 'Sin costo', text: 'Las muestras no tienen ningún costo para ti.' },
              { icon: <Truck className="w-5 h-5" />, title: 'Te las llevamos', text: 'Coordinamos el envío a la dirección que nos indiques.' },
            ].map(b => (
              <div key={b.title} className="flex gap-4 rounded-2xl p-5 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5">
                <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>{b.icon}</span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{b.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{b.text}</p>
                </div>
              </div>
            ))}
          </aside>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl p-8 sm:p-12 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 text-center space-y-5"
            >
              <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: primaryColor }} />
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">¡Ya casi está!</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Se abrió WhatsApp con tus datos. Presiona <strong>Enviar</strong> en el chat para completar tu solicitud y te contactaremos para coordinar el envío de tus muestras.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <a
                  href={waLink(sent.summary)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-full text-white font-semibold bg-[#25D366] hover:brightness-95 transition"
                >
                  Abrir WhatsApp de nuevo
                </a>
                <button
                  type="button"
                  onClick={() => setSent(null)}
                  className="px-6 py-3 rounded-full font-semibold ring-1 ring-slate-300 dark:ring-white/15 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                >
                  Enviar otra solicitud
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={submit} noValidate className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 space-y-8">
              {/* Honeypot */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => set('website', e.target.value)} className="hidden" aria-hidden="true" />

              <fieldset className="space-y-4">
                <legend className="text-lg font-bold text-slate-950 dark:text-white mb-2">Tus datos</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Nombres y apellidos" required error={errors.fullName} className="sm:col-span-2">
                    <input className={inputClass} value={form.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="name" maxLength={120} />
                  </Field>
                  <Field label="Celular / WhatsApp" required error={errors.phone}>
                    <input className={inputClass} inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9XX XXX XXX" />
                  </Field>
                  <Field label="Correo electrónico" required error={errors.email}>
                    <input type="email" className={inputClass} autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} maxLength={120} placeholder="tucorreo@ejemplo.com" />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-lg font-bold text-slate-950 dark:text-white mb-2">Tu negocio</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="¿Qué te describe mejor?" required error={errors.businessType}>
                    <select className={inputClass} value={form.businessType} onChange={e => set('businessType', e.target.value)}>
                      <option value="">Selecciona…</option>
                      {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Nombre de tu tienda o negocio">
                    <input className={inputClass} value={form.businessName} onChange={e => set('businessName', e.target.value)} maxLength={120} placeholder="Opcional" />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-lg font-bold text-slate-950 dark:text-white mb-2">¿A dónde enviamos tus muestras?</legend>
                {ubigeoError && <p className="text-sm text-red-500">No se pudo cargar la lista de ubicaciones. Recarga la página.</p>}
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Departamento" required error={errors.departmentId}>
                    <select className={inputClass} value={form.departmentId} onChange={e => set('departmentId', e.target.value)} disabled={ubigeo.length === 0}>
                      <option value="">{ubigeo.length ? 'Selecciona…' : 'Cargando…'}</option>
                      {ubigeo.map(d => <option key={d.id} value={d.id}>{d.n}</option>)}
                    </select>
                  </Field>
                  <Field label="Provincia" required error={errors.provinceId}>
                    <select className={inputClass} value={form.provinceId} onChange={e => set('provinceId', e.target.value)} disabled={!department}>
                      <option value="">Selecciona…</option>
                      {department?.p.map(p => <option key={p.id} value={p.id}>{p.n}</option>)}
                    </select>
                  </Field>
                  <Field label="Distrito" required error={errors.districtId}>
                    <select className={inputClass} value={form.districtId} onChange={e => set('districtId', e.target.value)} disabled={!province}>
                      <option value="">Selecciona…</option>
                      {province?.d.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Dirección" required error={errors.address}>
                    <input className={inputClass} autoComplete="street-address" value={form.address} onChange={e => set('address', e.target.value)} maxLength={200} placeholder="Av. / Jr. / Calle, número, Mz, Lt" />
                  </Field>
                  <Field label="Referencia">
                    <input className={inputClass} value={form.reference} onChange={e => set('reference', e.target.value)} maxLength={200} placeholder="Opcional — frente al parque, etc." />
                  </Field>
                </div>
                <Field label="Comentario">
                  <textarea className={`${inputClass} min-h-[96px] resize-y`} value={form.message} onChange={e => set('message', e.target.value)} maxLength={1000} placeholder="Opcional — cuéntanos qué vendes o qué necesitas" />
                </Field>
              </fieldset>

              <div className="space-y-4">
                <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setErrors(prev => ({ ...prev, consent: '' })); }} className="mt-0.5 w-4 h-4 accent-slate-900" />
                  <span>Autorizo el uso de mis datos para gestionar esta solicitud y ser contactado, conforme a la Ley N.° 29733 de Protección de Datos Personales.</span>
                </label>
                {errors.consent && <p className="text-[12px] text-red-500">{errors.consent}</p>}
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white font-bold tracking-wide shadow-lg hover:brightness-110 transition"
                  style={{ backgroundColor: primaryColor }}
                >
                  Solicitar
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
};
