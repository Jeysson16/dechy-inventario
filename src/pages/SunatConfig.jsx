import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-hot-toast';

const SunatConfig = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ruc: '',
    razonSocial: '',
    direccion: '',
    usuarioSol: '',
    claveSol: '',
    cdtBase64: ''
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const docRef = doc(db, 'settings', 'sunat');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFormData(docSnap.data());
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Error al cargar la configuración');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // base64 contains metadata like data:application/x-pkcs12;base64,
        const base64String = event.target.result.split(',')[1] || event.target.result;
        setFormData(prev => ({ ...prev, cdtBase64: base64String }));
        toast.success('Certificado cargado en memoria');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'sunat');
      await setDoc(docRef, formData);
      toast.success('Configuración de SUNAT guardada correctamente');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuración SUNAT</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">RUC de la Empresa (Dechy)</label>
            <input type="text" name="ruc" value={formData.ruc} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Razón Social</label>
            <input type="text" name="razonSocial" value={formData.razonSocial} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Dirección Fiscal</label>
          <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Usuario SOL</label>
            <input type="text" name="usuarioSol" value={formData.usuarioSol} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Clave SOL</label>
            <input type="password" name="claveSol" value={formData.claveSol} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border" />
          </div>
        </div>

        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Certificado Digital Tributario (CDT - Archivo .pfx)</label>
          <input type="file" accept=".pfx" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark" />
          {formData.cdtBase64 && (
            <p className="mt-2 text-sm text-green-600">✓ Certificado cargado (se guardará en base64)</p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SunatConfig;
