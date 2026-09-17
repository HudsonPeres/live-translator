// src/pages/Home.tsx
import { useState } from "react";
import { Link } from "react-router-dom";

type Language = "ENGLISH" | "ESPANHOL";
type Status = "online" | "offline";

interface Room {
  id: Language;
  label: string;
  status: Status;
}

export default function Home() {
  const [rooms] = useState<Room[]>([
    { id: "ENGLISH", label: "ENGLISH", status: "online" },
    { id: "ESPANHOL", label: "ESPANHOL", status: "offline" },
  ]);

  const [listening, setListening] = useState<Language | null>(null);

  function toggleListen(room: Room) {
    if (room.status === "offline") return;
    setListening((prev) => (prev === room.id ? null : room.id));
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
          className="h-36" // 👈 mude aqui o tamanho (h-20, h-24, etc.)
        />
      </div>

      {/* ===== SELECT LANGUAGE ===== */}
      <div className="w-full max-w-md mb-10">
        <div className="bg-black text-white text-center rounded-full py-3 font-bold tracking-wide text-sm">
          SELECT THE LANGUAGE
        </div>
      </div>

      {/* ===== CARDS ===== */}
      <div className="w-full max-w-md flex flex-col gap-6">
        {rooms.map((room) => {
          const isListening = listening === room.id;
          const isOnline = room.status === "online";

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
              disabled={!isOnline}
              className={`${bg} ${textColor} rounded-2xl p-6 shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed`}
            >
              <h2 className="text-2xl font-bold text-center mb-4">
                {room.label}
              </h2>

              <div className="flex justify-center">
                <div className="bg-black rounded-2xl w-40 h-24 flex items-center justify-center">
                  {isListening ? (
                    <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center">
                      <div className="w-4 h-4 bg-white"></div>
                    </div>
                  ) : isOnline ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="w-12 h-12 fill-white"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
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
                {isListening
                  ? "YOU ARE LISTENING"
                  : isOnline
                    ? "ONLINE"
                    : "OFFLINE"}
              </p>
            </button>
          );
        })}
      </div>

      {/* ===== LOGIN  ===== */}
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
