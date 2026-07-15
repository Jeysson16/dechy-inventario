/**
 * ShopRegisterPage — Registro e inicio de sesión para clientes de la tienda.
 * Guarda datos en Firestore "shopCustomers" y crea cuenta Firebase Auth.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { useShopAuth } from "../context/ShopAuthContext";

const DOC_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "CE" },
  { value: "Pasaporte", label: "Pasaporte" },
  { value: "RUC", label: "RUC" },
];

const PASSWORD_RULES = [
  { id: "len", label: "Mín. 8 caracteres", test: (p) => p.length >= 8 },
  { id: "num", label: "1 número", test: (p) => /\d/.test(p) },
  { id: "lower", label: "1 minúscula", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "1 mayúscula", test: (p) => /[A-Z]/.test(p) },
  { id: "space", label: "Sin espacio", test: (p) => !/\s/.test(p) },
];

const FIREBASE_ERRORS = {
  "auth/email-already-in-use": "Este correo ya está registrado. Inicia sesión.",
  "auth/invalid-email": "Correo electrónico inválido.",
  "auth/weak-password": "La contraseña es demasiado débil.",
  "auth/user-not-found": "No existe una cuenta con este correo.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
  "auth/network-request-failed": "Error de conexión. Verifica tu internet.",
};

const ShopRegisterPage = () => {
  const navigate = useNavigate();
  const { signInWithGoogle } = useShopAuth();
  const [mode, setMode] = useState("register"); // "login" | "register"
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    apellidos: "",
    tipoDoc: "DNI",
    numDoc: "",
    celular: "",
    termsShop: false,
    termsPrivacy: false,
  });

  const set = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  };

  const passRules = PASSWORD_RULES.map((r) => ({
    ...r,
    ok: form.password ? r.test(form.password) : false,
  }));
  const passValid = passRules.every((r) => r.ok);

  const canRegister =
    form.email &&
    passValid &&
    form.nombre.trim() &&
    form.apellidos.trim() &&
    form.celular.trim() &&
    form.termsShop &&
    form.termsPrivacy;

  const canLogin = form.email && form.password;

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const u = await signInWithGoogle();
      if (u) navigate("/tienda/catalogo");
    } catch {
      setError("Error con Google. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!canRegister) return;
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      );
      await updateProfile(cred.user, {
        displayName: `${form.nombre.trim()} ${form.apellidos.trim()}`,
      });
      await sendEmailVerification(cred.user);

      // Save to Firestore shopCustomers
      await setDoc(doc(db, "shopCustomers", cred.user.uid), {
        uid: cred.user.uid,
        email: form.email.trim().toLowerCase(),
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        displayName: `${form.nombre.trim()} ${form.apellidos.trim()}`,
        tipoDocumento: form.tipoDoc,
        numeroDocumento: form.numDoc.trim(),
        celular: form.celular.trim(),
        photoURL: null,
        provider: "email",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
    } catch (err) {
      setError(
        FIREBASE_ERRORS[err.code] || "Error al registrar. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!canLogin) return;
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      navigate("/tienda/catalogo");
    } catch (err) {
      setError(
        FIREBASE_ERRORS[err.code] ||
          "Error al iniciar sesión. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──
  if (success) {
    return (
      <div className="shop-page-enter min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
          <CheckCircle2 size={52} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">
            ¡Cuenta creada!
          </h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Te enviamos un correo de verificación a{" "}
            <strong>{form.email}</strong>. Revisa tu bandeja de entrada.
          </p>
          <Link
            to="/tienda/catalogo"
            className="block w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm text-center hover:bg-[#CFAE70] hover:text-slate-900 transition-all"
          >
            Ir al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page-enter min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/img/brand/logo-dechy.png"
            alt="Dechy Importaciones"
            className="h-14 object-contain"
            onError={(e) => {
              e.target.src = "/img/brand/logopngdechy.png";
            }}
          />
        </div>

        <h1 className="text-xl font-black text-slate-900 text-center mb-1">
          {mode === "register"
            ? "Inicia sesión o regístrate para comprar"
            : "Inicia sesión para comprar"}
        </h1>

        {/* Social logos banner */}
        <div className="flex items-center justify-center gap-2 mt-3 mb-1">
          <ShoppingBag size={16} className="text-[#CFAE70]" />
          <span className="text-xs text-slate-500">
            Compra segura con tu cuenta de Dechy
          </span>
        </div>

        <p className="text-xs text-slate-500 mb-5 text-center">
          ¿Ya tienes una cuenta Google? Úsala para acceder rápidamente.
        </p>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all font-semibold text-slate-700 text-sm mb-5 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </button>

        {/* Divider */}
        <div className="relative flex items-center mb-5">
          <div className="flex-grow border-t border-slate-200" />
          <span className="mx-3 text-xs text-slate-400 font-medium">
            O con correo electrónico
          </span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2.5 mb-4">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={mode === "register" ? handleRegister : handleLogin}
          className="space-y-4"
        >
          {/* Correo */}
          <div className="shop-field">
            <label className="shop-label">Correo</label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="Ingresa un correo"
              className="shop-input"
              required
              autoComplete="email"
            />
          </div>

          {/* Register-only fields */}
          {mode === "register" && (
            <>
              <div className="shop-field">
                <label className="shop-label">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={set("nombre")}
                  placeholder="Ingresa un nombre"
                  className="shop-input"
                  required
                  autoComplete="given-name"
                />
              </div>

              <div className="shop-field">
                <label className="shop-label">Apellidos</label>
                <input
                  type="text"
                  value={form.apellidos}
                  onChange={set("apellidos")}
                  placeholder="Ingresa apellidos"
                  className="shop-input"
                  required
                  autoComplete="family-name"
                />
              </div>

              <div className="shop-field">
                <label className="shop-label">Tipo de documento</label>
                <div className="flex gap-2">
                  <select
                    value={form.tipoDoc}
                    onChange={set("tipoDoc")}
                    className="shop-input w-24 flex-shrink-0"
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.numDoc}
                    onChange={set("numDoc")}
                    placeholder="Ingresa un documento de identidad"
                    className="shop-input flex-1"
                  />
                </div>
              </div>

              <div className="shop-field">
                <label className="shop-label">Celular</label>
                <div className="flex">
                  <span className="shop-input-prefix">+51</span>
                  <input
                    type="tel"
                    value={form.celular}
                    onChange={set("celular")}
                    placeholder="Ingresa un celular"
                    className="shop-input shop-input-suffix"
                    required
                    autoComplete="tel"
                  />
                </div>
              </div>
            </>
          )}

          {/* Contraseña */}
          <div className="shop-field">
            <label className="shop-label">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                placeholder="Ingresa una contraseña"
                className="shop-input pr-10"
                required
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          {/* Password rules (register only) */}
          {mode === "register" && form.password && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
              {passRules.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-1.5 text-xs ${
                    r.ok ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full flex-shrink-0 ${
                      r.ok ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  {r.label}
                </div>
              ))}
            </div>
          )}

          {/* Terms (register only) */}
          {mode === "register" && (
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.termsShop}
                  onChange={set("termsShop")}
                  className="mt-0.5 shop-checkbox"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Acepto los{" "}
                  <a href="#" className="underline hover:text-[#CFAE70]">
                    términos y condiciones
                  </a>{" "}
                  para acumular puntos en mis compras.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.termsPrivacy}
                  onChange={set("termsPrivacy")}
                  className="mt-0.5 shop-checkbox"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Acepto los{" "}
                  <a href="#" className="underline hover:text-[#CFAE70]">
                    términos y condiciones
                  </a>{" "}
                  de Dechy Importaciones y autorizo la{" "}
                  <a href="#" className="underline hover:text-[#CFAE70]">
                    política de privacidad
                  </a>
                  .
                </span>
              </label>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={
              loading || (mode === "register" ? !canRegister : !canLogin)
            }
            className={`w-full py-3 rounded-xl text-sm font-black transition-all mt-2 ${
              (mode === "register" ? canRegister : canLogin) && !loading
                ? "bg-slate-900 text-white hover:bg-[#CFAE70] hover:text-slate-900 cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {loading
              ? "Procesando..."
              : mode === "register"
                ? "Regístrate"
                : "Iniciar sesión"}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-sm text-slate-500 mt-5">
          {mode === "register" ? (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className="font-semibold text-slate-900 hover:text-[#CFAE70] transition-colors underline"
              >
                Inicia sesión
              </button>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{" "}
              <button
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className="font-semibold text-slate-900 hover:text-[#CFAE70] transition-colors underline"
              >
                Regístrate
              </button>
            </>
          )}
        </p>

        <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
          Solo aceptamos cuentas verificadas. Tu información está protegida y no
          se comparte con terceros.
        </p>
      </div>
    </div>
  );
};

export default ShopRegisterPage;
