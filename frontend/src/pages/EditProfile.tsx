// src/pages/EditProfile.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "../api/client";
import { getUser, getToken, updateStoredUser } from "../auth/auth";

export default function EditProfile() {
  const navigate = useNavigate();
  const user = getUser();
  const token = getToken();

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!user || !token) {
    navigate("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Só envia o que mudou
      const payload: { email?: string; password?: string } = {};
      if (email && email !== user!.email) payload.email = email;
      if (password) payload.password = password;

      if (Object.keys(payload).length === 0) {
        setSuccess("Nada para guardar.");
        setLoading(false);
        return;
      }

      const updated = await updateProfile(token!, payload);
      updateStoredUser(updated);
      setSuccess("Perfil atualizado com sucesso!");
      setPassword("");

      // Volta ao painel após 1.2s
      setTimeout(() => navigate("/translate"), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8 pb-8">
      {/* Header com logo */}
      <div className="w-full max-w-md flex justify-between items-start mb-10">
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

      {/* Título PERFIL */}
      <div className="w-full max-w-md bg-purple-400 text-white text-center rounded-full py-3 font-bold tracking-wide text-lg mb-10">
        PERFIL
      </div>

      {/* Formulário */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md flex flex-col gap-4"
      >
        {/* USER (read-only) */}
        <input
          type="text"
          value={user.username}
          readOnly
          disabled
          className="bg-gray-300 text-black text-center rounded-full py-4 font-bold tracking-wide cursor-not-allowed opacity-80"
        />

        {/* EMAIL (editável) */}
        <input
          type="email"
          placeholder="EMAIL"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-gray-300 text-black text-center placeholder-gray-700 rounded-full py-4 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-black"
        />

        {/* PASSWORD (editável, opcional) */}
        <input
          type="password"
          placeholder="PASSWORD (deixe vazio para manter)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-300 text-black text-center placeholder-gray-700 rounded-full py-4 font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-black text-sm"
        />

        {error && (
          <p className="text-red-600 text-center text-sm font-semibold">
            {error}
          </p>
        )}
        {success && (
          <p className="text-green-600 text-center text-sm font-semibold">
            {success}
          </p>
        )}

        <div className="flex justify-center pt-6">
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white font-bold tracking-wide rounded-full px-16 py-3 disabled:opacity-50 hover:bg-gray-800 transition"
          >
            {loading ? "A GUARDAR..." : "CONFIRMAR"}
          </button>
        </div>
      </form>

      {/* Botão voltar */}
      <button
        onClick={() => navigate("/translate")}
        className="mt-8 text-sm text-gray-600 underline"
      >
        ← Voltar
      </button>

      {/* Footer */}
      <footer className="w-full max-w-md text-center mt-auto pt-8 text-xs text-gray-500">
        <p className="font-semibold">Versão Beta</p>
        <p>Desenvolvido por Hudson Peres</p>
      </footer>
    </div>
  );
}
