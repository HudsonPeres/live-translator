// src/pages/EditProfile.tsx
import { Link } from "react-router-dom";
import { getUser } from "../auth/auth";

export default function EditProfile() {
  const user = getUser();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8 pb-8">
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
        <img src="/IPPC_logo.png" alt="IPCC" className="h-16" />
      </div>

      <div className="w-full max-w-md bg-purple-400 text-white text-center rounded-full py-3 font-bold tracking-wide mb-8">
        PERFIL
      </div>

      <p className="text-sm text-gray-600 text-center mb-6">
        Em construção — vamos preencher com os campos USER, EMAIL, PASSWORD.
      </p>

      <p className="text-sm text-gray-800 mb-8">
        Utilizador atual: <strong>{user?.username}</strong>
      </p>

      <Link
        to="/translate"
        className="bg-black text-white rounded-full px-8 py-3 font-bold tracking-wide text-sm"
      >
        VOLTAR
      </Link>
    </div>
  );
}
