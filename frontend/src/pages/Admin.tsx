import { Link, useNavigate } from "react-router-dom";
import { getUser, logout } from "../auth/auth";
import Footer from "../components/Footer";
import Header from "../components/Header";

export default function Admin() {
  const navigate = useNavigate();
  const user = getUser();

  if (!user || user.role !== "SUPER_USER") {
    navigate("/translate");
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8 pb-8">
      {/* Header */}
      <Header />

      {/* Título SUPER USER */}
      <div className="w-full max-w-md bg-purple-400 text-white text-center rounded-full py-3 font-bold tracking-wide text-lg mb-10">
        SUPER USER
      </div>

      {/* Texto explicativo */}
      <p className="w-full max-w-md text-center text-sm text-black leading-relaxed mb-10 uppercase">
        Aqui o Super User pode criar novos utilizadores, apagar utilizadores e
        alterar o user, email e fazer reset de senha dos utilizadores
      </p>

      {/* Botão CONFIRMAR */}
      <Link
        to="/admin/users"
        className="bg-black text-white rounded-full px-12 py-3 font-bold tracking-wide text-sm hover:bg-gray-900"
      >
        CONFIRMAR
      </Link>

      {/* Botões de navegação */}
      <div className="w-full max-w-md flex gap-3 mt-auto pt-10">
        <Link
          to="/translate"
          className="flex-1 bg-purple-400 text-white text-center rounded-full py-3 font-bold tracking-wide text-sm hover:bg-purple-500"
        >
          PAINEL TRADUTOR
        </Link>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="flex-1 bg-black text-white text-center rounded-full py-3 font-bold tracking-wide text-sm hover:bg-gray-900"
        >
          LOG OUT
        </button>
      </div>

      <Footer />
    </div>
  );
}
