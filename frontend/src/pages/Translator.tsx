// src/pages/Translator.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUser, logout } from "../auth/auth";

type Language = "ENGLISH" | "ESPANHOL";

export default function Translator() {
  const navigate = useNavigate();
  const user = getUser();

  // Qual idioma o tradutor está a transmitir (null = nenhum)
  const [activeLanguage, setActiveLanguage] = useState<Language | null>(null);

  function handleLogout() {
    logout();
    navigate("/");
  }

  function toggleTranslate(lang: Language) {
    // Se já está a traduzir este idioma → para
    // Se está a traduzir o outro → troca
    // Se não está a traduzir nada → começa
    setActiveLanguage((prev) => (prev === lang ? null : lang));
  }

  // Se por acaso não houver utilizador, redireciona
  if (!user) {
    navigate("/login");
    return null;
  }

  const languages: { id: Language; label: string }[] = [
    { id: "ENGLISH", label: "ENGLISH" },
    { id: "ESPANHOL", label: "ESPANHOL" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8 pb-8">
      {/* ===== HEADER ===== */}
      <div className="w-full max-w-md flex justify-between items-start mb-6">
        <h1 className="text-2xl font-bold leading-tight">
          Live
          <br />
          Translating
          <br />
          Center
          <br />
          IPCC
        </h1>
        <img
          src="/IPPC_logo.png"
          alt="Igreja Portugal para Cristo"
          className="h-16"
        />
      </div>

      {/* ===== BEM VINDO ===== */}
      <p className="w-full max-w-md text-center text-lg font-semibold mb-4">
        BEM VINDO {user.username.toUpperCase()}.
      </p>

      {/* ===== SELECT LANGUAGE ===== */}
      <div className="w-full max-w-md mb-10">
        <div className="bg-black text-white text-center rounded-full py-3 font-bold tracking-wide text-sm">
          ESCOLHA A LÍNGUA PARA TRADUZIR
        </div>
      </div>

      {/* ===== CARTÕES ===== */}
      <div className="w-full max-w-md flex flex-col gap-6">
        {languages.map((lang) => {
          const isActive = activeLanguage === lang.id;

          const bg = isActive ? "bg-green-700" : "bg-red-600";

          return (
            <div
              key={lang.id}
              className={`${bg} text-white rounded-2xl p-6 shadow-lg`}
            >
              <h2 className="text-2xl font-bold text-center mb-4">
                {lang.label}
              </h2>

              <div className="flex justify-center">
                <button
                  onClick={() => toggleTranslate(lang.id)}
                  className="bg-black text-white rounded-2xl w-48 h-20 flex items-center justify-center font-bold tracking-wide text-sm hover:bg-gray-900 active:scale-95 transition"
                >
                  {isActive ? "STOP\nTRANSLATE" : "START\nTRANSLATE"}
                </button>
              </div>

              <p className="text-center mt-4 font-bold tracking-wide text-sm">
                {isActive ? "VOCÊ ESTÁ ONLINE" : "VOCÊ ESTÁ OFFLINE"}
              </p>
            </div>
          );
        })}
      </div>

      {/* ===== BOTÕES INFERIORES ===== */}
      <div className="w-full max-w-md flex gap-3 mt-10">
        <Link
          to="/profile"
          className="flex-1 bg-purple-400 text-white text-center rounded-full py-3 font-bold tracking-wide text-sm hover:bg-purple-500"
        >
          EDITAR PERFIL
        </Link>
        <button
          onClick={handleLogout}
          className="flex-1 bg-black text-white text-center rounded-full py-3 font-bold tracking-wide text-sm hover:bg-gray-900"
        >
          LOG OUT
        </button>
      </div>

      {/* ===== BOTÃO SUPER USER (só aparece para SUPER_USER) ===== */}
      {user.role === "SUPER_USER" && (
        <div className="w-full max-w-md mt-6 flex flex-col items-center">
          <Link
            to="/admin"
            className="bg-purple-400 text-white rounded-full px-8 py-3 font-bold tracking-wide text-sm hover:bg-purple-500"
          >
            SUPER USER
          </Link>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <footer className="w-full max-w-md text-center mt-auto pt-8 text-xs text-gray-500">
        <p className="font-semibold">Versão Beta</p>
        <p>Desenvolvido por Hudson Peres</p>
      </footer>
    </div>
  );
}
