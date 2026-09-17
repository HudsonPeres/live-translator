// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { saveAuth } from "../auth/auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token, user } = await login(username, password);
      saveAuth(token, user);

      // Redirecionar por role
      // Ambos os roles vão para o painel do tradutor.
      // O botão "SUPER USER" só aparece para quem tem esse role.
      navigate("/translate");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8">
      {/* Header com logo */}
      <div className="w-full max-w-md flex justify-between items-start mb-16">
        <h1 className="text-2xl font-bold text-black leading-tight">
          Live
          <br />
          Translating
          <br />
          Center
          <br />
          IPCC
        </h1>
        <img
          src="./IPPC_logo.png"
          alt="Igreja Portugal para Cristo"
          className="h-36"
        />
      </div>

      {/* Título LOGIN */}
      <div className="w-full max-w-md bg-black rounded-full py-4 mb-8">
        <h2 className="text-white text-center text-xl font-bold tracking-wide">
          LOGIN
        </h2>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <input
          type="text"
          placeholder="USER"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full bg-gray-300 text-black text-center placeholder-gray-700 rounded-full py-4 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-black"
        />

        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full bg-gray-300 text-black text-center placeholder-gray-700 rounded-full py-4 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-black"
        />

        {error && (
          <p className="text-red-600 text-center text-sm font-semibold">
            {error}
          </p>
        )}

        <div className="flex justify-center pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white font-bold tracking-wide rounded-full px-16 py-3 disabled:opacity-50 hover:bg-gray-800 transition"
          >
            {loading ? "A ENTRAR..." : "ENTRAR"}
          </button>
        </div>
      </form>
    </div>
  );
}
