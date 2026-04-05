import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import AppLayout from "../components/layout/AppLayout";
import { storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const MyAccount = () => {
  const { userProfile, displayName, updateUserProfile } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    setForm({
      name: userProfile?.name || displayName || "",
      phone: userProfile?.phone || "",
    });
    setAvatarUrl(userProfile?.avatarUrl || "");
    setAvatarPreview(userProfile?.avatarUrl || "");
    setAvatarFile(null);
    setUploadProgress(0);
  }, [userProfile, displayName]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let savedAvatarUrl = avatarUrl;
      if (avatarFile) {
        const storageRef = ref(
          storage,
          `profiles/${Date.now()}_${avatarFile.name}`,
        );
        const uploadTask = uploadBytesResumable(storageRef, avatarFile);
        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            resolve,
          );
        });
        savedAvatarUrl = await getDownloadURL(uploadTask.snapshot.ref);
      }

      await updateUserProfile({
        name: form.name,
        phone: form.phone,
        avatarUrl: savedAvatarUrl,
      });

      toast.success("Tu cuenta se actualizó correctamente.");
      setAvatarFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar tu cuenta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8 flex flex-col gap-3">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Mi cuenta
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Actualiza tu nombre, teléfono y foto de perfil. Solo tú puedes
            modificar estos datos.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-32 w-32 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-5xl">
                      person
                    </span>
                  </div>
                )}
              </div>
              <label className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Subir avatar
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              {uploadProgress > 0 && (
                <div className="w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
                  <div
                    className="h-2 bg-primary transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tu correo no puede ser modificado desde aquí.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MyAccount;
