import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import { getToken, getRoomStatus } from "../api/client";

type Language = "english" | "espanhol";

interface RoomInfo {
  id: Language;
  label: string;
  online: boolean;
}

export default function Home() {
  const [rooms, setRooms] = useState<RoomInfo[]>([
    { id: "english", label: "ENGLISH", online: false },
    { id: "espanhol", label: "ESPANHOL", online: false },
  ]);

  const [listening, setListening] = useState<Language | null>(null);
  const [connecting, setConnecting] = useState<Language | null>(null);
  const [error, setError] = useState("");

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // ---------- Polling do estado das salas ----------
  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const [en, es] = await Promise.all([
          getRoomStatus("english"),
          getRoomStatus("espanhol"),
        ]);
        if (!mounted) return;
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === "english") return { ...r, online: en.online };
            if (r.id === "espanhol") return { ...r, online: es.online };
            return r;
          }),
        );
      } catch {
        // silencioso — se o backend estiver offline, mantem estado atual
      }
    }

    check();
    const interval = setInterval(check, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // ---------- Cleanup ao desmontar ----------
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (audioElRef.current) {
        audioElRef.current.remove();
        audioElRef.current = null;
      }
    };
  }, []);

  // ---------- Funcao para parar de ouvir ----------
  function stopListening() {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    setListening(null);
    setConnecting(null);
  }

  // ---------- Funcao para comecar a ouvir ----------
  async function startListening(roomId: Language) {
    setError("");
    setConnecting(roomId);

    try {
      const { token, url } = await getToken(
        roomId,
        `listener-${Date.now()}`,
        "subscriber",
      );

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          // Cria um elemento audio e liga a track
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.style.display = "none";
          document.body.appendChild(el);
          audioElRef.current = el;

          // Garantir que toca (alguns browsers exigem chamar play())
          el.play().catch((e) => console.error("Erro ao tocar audio:", e));
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setListening(null);
        setConnecting(null);
        roomRef.current = null;
      });

      await room.connect(url, token);
      setListening(roomId);
      setConnecting(null);
    } catch (e: any) {
      console.error("Erro ao conectar no LiveKit:", e);
      setError("Nao foi possivel conectar. Tente novamente.");
      setConnecting(null);
      stopListening();
    }
  }

  // ---------- Handler do clique ----------
  function toggleListen(room: RoomInfo) {
    if (!room.online) return;

    if (listening === room.id) {
      stopListening();
    } else {
      stopListening(); // garante que nao fica em duas salas ao mesmo tempo
      startListening(room.id);
    }
  }

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
          className="h-36"
        />
      </div>

      {/* ===== SELECT LANGUAGE ===== */}
      <div className="w-full max-w-md mb-10">
        <div className="bg-black text-white text-center rounded-full py-3 font-bold tracking-wide text-sm">
          SELECT THE LANGUAGE
        </div>
      </div>

      {/* ===== ERRO ===== */}
      {error && (
        <p className="w-full max-w-md bg-red-100 text-red-700 rounded-full py-2 px-4 text-center text-sm font-semibold mb-4">
          {error}
        </p>
      )}

      {/* ===== CARDS ===== */}
      <div className="w-full max-w-md flex flex-col gap-6">
        {rooms.map((room) => {
          const isListening = listening === room.id;
          const isConnecting = connecting === room.id;
          const isOnline = room.online;

          const bg = isListening
            ? "bg-green-700"
            : isOnline
              ? "bg-purple-200"
              : "bg-red-600";

          const textColor =
            isListening || !isOnline ? "text-white" : "text-black";

          return (
            <button
              key={room.id}
              onClick={() => toggleListen(room)}
              disabled={!isOnline || isConnecting}
              className={`${bg} ${textColor} rounded-2xl p-6 shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed`}
            >
              <h2 className="text-2xl font-bold text-center mb-4">
                {room.label}
              </h2>

              <div className="flex justify-center">
                <div className="bg-black rounded-2xl w-40 h-24 flex items-center justify-center">
                  {isConnecting ? (
                    // Icone de loading
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : isListening ? (
                    // Icone STOP
                    <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center">
                      <div className="w-4 h-4 bg-white"></div>
                    </div>
                  ) : isOnline ? (
                    // Icone PLAY
                    <svg
                      viewBox="0 0 24 24"
                      className="w-12 h-12 fill-white"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    // Icone X (offline)
                    <svg
                      viewBox="0 0 24 24"
                      className="w-12 h-12 stroke-white stroke-2"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="18" y1="6" x2="6" y2="18" />
                    </svg>
                  )}
                </div>
              </div>

              <p className="text-center mt-4 font-bold tracking-wide text-sm">
                {isConnecting
                  ? "A CONECTAR..."
                  : isListening
                    ? "YOU ARE LISTENING"
                    : isOnline
                      ? "ONLINE"
                      : "OFFLINE"}
              </p>
            </button>
          );
        })}
      </div>

      {/* ===== LOGIN ===== */}
      <Link to="/login" className="mt-auto pt-10 w-full max-w-md">
        <div className="bg-black text-white rounded-full py-4 px-6 flex items-center justify-between font-bold tracking-wide">
          <span className="flex-1 text-center">LOGIN</span>
          <span className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center">
            ›
          </span>
        </div>
      </Link>

      {/* ===== FOOTER ===== */}
      <footer className="w-full max-w-md text-center mt-6 text-xs text-gray-500">
        <p className="font-semibold">Versão Beta</p>
        <p>Desenvolvido por Hudson Peres</p>
      </footer>
    </div>
  );
}
