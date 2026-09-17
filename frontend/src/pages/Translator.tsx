import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Room } from "livekit-client";
import { getUser, logout, getToken as getJwt } from "../auth/auth";
import { getToken } from "../api/client";

type Language = "english" | "espanhol";

export default function Translator() {
  const navigate = useNavigate();
  const user = getUser();
  const jwt = getJwt();

  const [activeLanguage, setActiveLanguage] = useState<Language | null>(null);
  const [connecting, setConnecting] = useState<Language | null>(null);
  const [error, setError] = useState("");

  const roomRef = useRef<Room | null>(null);

  // Se nao houver utilizador, redireciona
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Cleanup ao desmontar: garante que a transmissao para
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  function handleLogout() {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    logout();
    navigate("/");
  }

  async function stopTranslating() {
    if (roomRef.current) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // ignora erros ao desligar mic
      }
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setActiveLanguage(null);
    setConnecting(null);
  }

  async function startTranslating(lang: Language) {
    setError("");
    setConnecting(lang);

    try {
      if (!jwt) throw new Error("Sessao expirada. Faca login novamente.");

      const identity = `translator-${user?.username || "anon"}-${Date.now()}`;
      const { token, url } = await getToken(lang, identity, "publisher", jwt);

      const room = new Room();
      roomRef.current = room;

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);

      setActiveLanguage(lang);
      setConnecting(null);
    } catch (e: any) {
      console.error("Erro ao iniciar transmissao:", e);
      setError(e.message || "Nao foi possivel iniciar a transmissao.");
      setConnecting(null);

      // limpa se ficou algo ligado
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    }
  }

  async function toggleTranslate(lang: Language) {
    // Se ja esta ativo neste idioma -> para
    if (activeLanguage === lang) {
      await stopTranslating();
      return;
    }

    // Se esta a traduzir outro idioma -> para o atual primeiro
    if (roomRef.current) {
      await stopTranslating();
    }

    await startTranslating(lang);
  }

  if (!user) return null;

  const languages: { id: Language; label: string }[] = [
    { id: "english", label: "ENGLISH" },
    { id: "espanhol", label: "ESPANHOL" },
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

      {/* ===== ERRO ===== */}
      {error && (
        <p className="w-full max-w-md bg-red-100 text-red-700 rounded-full py-2 px-4 text-center text-sm font-semibold mb-4">
          {error}
        </p>
      )}

      {/* ===== CARTÕES ===== */}
      <div className="w-full max-w-md flex flex-col gap-6">
        {languages.map((lang) => {
          const isActive = activeLanguage === lang.id;
          const isConnecting = connecting === lang.id;

          const bg = isActive ? "bg-green-700" : "bg-red-600";

          return (
            <div
              key={lang.id}
              className={`${bg} text-white rounded-2xl p-6 shadow-lg transition-colors`}
            >
              <h2 className="text-2xl font-bold text-center mb-4">
                {lang.label}
              </h2>

              <div className="flex justify-center">
                <button
                  onClick={() => toggleTranslate(lang.id)}
                  disabled={isConnecting}
                  className="bg-black text-white rounded-2xl w-48 h-20 flex items-center justify-center font-bold tracking-wide text-sm hover:bg-gray-900 active:scale-95 transition whitespace-pre-line disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isConnecting
                    ? "A CONECTAR..."
                    : isActive
                      ? "STOP\nTRANSLATE"
                      : "START\nTRANSLATE"}
                </button>
              </div>

              <p className="text-center mt-4 font-bold tracking-wide text-sm">
                {isConnecting
                  ? "A CONECTAR..."
                  : isActive
                    ? "VOCÊ ESTÁ ONLINE"
                    : "VOCÊ ESTÁ OFFLINE"}
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

      {/* ===== BOTÃO SUPER USER ===== */}
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
