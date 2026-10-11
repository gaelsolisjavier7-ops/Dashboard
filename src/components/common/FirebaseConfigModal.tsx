import React, { useState } from 'react';
import type { FirebaseConfigState } from '../../types/finance';
import { X, Database } from 'lucide-react';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  // Firebase ya está configurado con config hardcodeada en services/firebase.ts
  const isFirebaseConfigured = true;
  const currentConfig = null as FirebaseConfigState | null;

  const saveConfig = (_config: FirebaseConfigState | null) => {
    // No-op: la configuración está hardcodeada en services/firebase.ts
    window.location.reload();
  };

  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig?.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(
    currentConfig?.messagingSenderId || ''
  );
  const [appId, setAppId] = useState(currentConfig?.appId || '');

  const [pasteJson, setPasteJson] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'json' | 'env'>('form');

  if (!isOpen) return null;

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      alert('Por favor ingresa al menos API Key y Project ID.');
      return;
    }

    const newConfig: FirebaseConfigState = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim() || `${projectId.trim()}.appspot.com`,
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    saveConfig(newConfig);
    onClose();
  };

  const handleParseAndSaveJson = () => {
    try {
      // Allow user to paste standard firebaseConfig object
      const cleaned = pasteJson
        .replace(/const firebaseConfig =/, '')
        .replace(/;/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.apiKey && parsed.projectId) {
        saveConfig(parsed);
        onClose();
      } else {
        alert('El objeto JSON no contiene apiKey o projectId válidos.');
      }
    } catch {
      alert('No se pudo interpretar el formato JSON. Asegúrate de pegar un objeto JSON válido.');
    }
  };

  const handleClear = () => {
    if (confirm('¿Restablecer a modo local sin Firebase?')) {
      saveConfig(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#ffffff] rounded-[24px] max-w-[560px] w-full p-6 sm:p-8 border border-[#e0e0e0] shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e0e0e0] flex items-center justify-center text-[#1d1d1f] absolute right-6 top-6 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2 text-[#0066cc]">
          <Database className="w-5 h-5" />
          <span className="text-[13px] font-semibold uppercase tracking-wider">
            Firebase Integration
          </span>
        </div>
        <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight mt-1">
          Configuración de Firebase
        </h3>
        <p className="text-[14px] text-[#7a7a7a] mt-0.5">
          Conecta tu base de datos Firestore y autenticación para guardar y sincronizar tus datos.
        </p>

        {/* Current status pill */}
        <div className="mt-4 p-3.5 rounded-[14px] bg-[#f5f5f7] border border-[#e0e0e0] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isFirebaseConfigured ? 'bg-[#34c759]' : 'bg-[#ff9500]'
              }`}
            />
            <span className="text-[14px] font-medium text-[#1d1d1f]">
              Estado: {isFirebaseConfigured ? 'Conectado a Firebase' : 'Modo Almacenamiento Local'}
            </span>
          </div>
          {isFirebaseConfigured && (
            <button
              onClick={handleClear}
              className="text-[12px] text-[#ff3b30] hover:underline"
            >
              Desconectar
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="mt-5 flex items-center space-x-2 border-b border-[#f0f0f0] pb-2">
          <button
            onClick={() => setActiveTab('form')}
            className={`text-[14px] pb-1 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'form'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#7a7a7a] hover:text-[#1d1d1f]'
            }`}
          >
            Formulario
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`text-[14px] pb-1 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'json'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#7a7a7a] hover:text-[#1d1d1f]'
            }`}
          >
            Pegar JSON
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`text-[14px] pb-1 px-2 border-b-2 font-medium transition-colors ${
              activeTab === 'env'
                ? 'border-[#0066cc] text-[#0066cc]'
                : 'border-transparent text-[#7a7a7a] hover:text-[#1d1d1f]'
            }`}
          >
            Archivo .env
          </button>
        </div>

        {/* Tab 1: Form Inputs */}
        {activeTab === 'form' && (
          <form onSubmit={handleSaveForm} className="mt-4 space-y-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">
                API Key *
              </label>
              <input
                type="text"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-[13px] px-3.5 py-2 rounded-[10px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">
                Project ID *
              </label>
              <input
                type="text"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="mi-proyecto-firebase"
                className="w-full text-[13px] px-3.5 py-2 rounded-[10px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">
                Auth Domain
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="mi-proyecto-firebase.firebaseapp.com"
                className="w-full text-[13px] px-3.5 py-2 rounded-[10px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">
                  App ID
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:12345:web:abcd"
                  className="w-full text-[13px] px-3.5 py-2 rounded-[10px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1">
                  Sender ID
                </label>
                <input
                  type="text"
                  value={messagingSenderId}
                  onChange={(e) => setMessagingSenderId(e.target.value)}
                  placeholder="123456789"
                  className="w-full text-[13px] px-3.5 py-2 rounded-[10px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                Cancelar
              </button>
              <button type="submit" className="apple-btn-primary px-6 py-2 text-[14px]">
                Guardar y Conectar
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Paste JSON */}
        {activeTab === 'json' && (
          <div className="mt-4 space-y-3">
            <p className="text-[13px] text-[#7a7a7a]">
              Pega el objeto de configuración generado en la consola de Firebase:
            </p>
            <textarea
              rows={6}
              value={pasteJson}
              onChange={(e) => setPasteJson(e.target.value)}
              placeholder={`{\n  "apiKey": "AIzaSy...",\n  "authDomain": "...",\n  "projectId": "..."\n}`}
              className="w-full font-mono text-[12px] p-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleParseAndSaveJson}
                className="apple-btn-primary px-6 py-2 text-[14px]"
              >
                Cargar Configuración
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: .env guide */}
        {activeTab === 'env' && (
          <div className="mt-4 space-y-3 text-[13px]">
            <p className="text-[#7a7a7a]">
              También puedes crear un archivo <code className="bg-[#f5f5f7] px-1.5 py-0.5 rounded font-mono text-[#1d1d1f]">.env</code> en la raíz del proyecto con las siguientes variables:
            </p>
            <div className="p-3 bg-[#1d1d1f] text-[#ffffff] rounded-[12px] font-mono text-[12px] space-y-1 overflow-x-auto">
              <div>VITE_FIREBASE_API_KEY=AIzaSy...</div>
              <div>VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com</div>
              <div>VITE_FIREBASE_PROJECT_ID=tu-proyecto</div>
              <div>VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com</div>
              <div>VITE_FIREBASE_MESSAGING_SENDER_ID=123456789</div>
              <div>VITE_FIREBASE_APP_ID=1:12345:web:abcdef</div>
            </div>
            <p className="text-[12px] text-[#8e8e93]">
              Vite cargará automáticamente estas variables al reiniciar el servidor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
