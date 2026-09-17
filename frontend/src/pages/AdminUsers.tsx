import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  type User,
} from "../api/client";
import { getToken } from "../auth/auth";

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  userId?: number;
  username: string;
  email: string;
  password: string;
  role: string;
}

const emptyForm: FormState = {
  open: false,
  mode: "create",
  username: "",
  email: "",
  password: "",
  role: "TRANSLATOR",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [info, setInfo] = useState("");

  const token = getToken()!;

  async function refresh() {
    setLoading(true);
    try {
      const data = await listUsers(token);
      setUsers(data);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreate() {
    setForm({ ...emptyForm, open: true, mode: "create" });
  }

  function openEdit(u: User) {
    setForm({
      open: true,
      mode: "edit",
      userId: u.id,
      username: u.username,
      email: u.email,
      password: "",
      role: u.role,
    });
  }

  async function handleSave() {
    setError("");
    try {
      if (form.mode === "create") {
        if (!form.username || !form.email || !form.password) {
          setError("Preencha username, email e password");
          return;
        }
        await createUser(token, {
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
        });
      } else if (form.mode === "edit" && form.userId) {
        const payload: any = {};
        if (form.username) payload.username = form.username;
        if (form.email) payload.email = form.email;
        if (form.password) payload.password = form.password;
        await updateUser(token, form.userId, payload);
      }
      setForm(emptyForm);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Tem a certeza que quer apagar este utilizador?")) return;
    try {
      await deleteUser(token, id);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleReset(id: number) {
    if (!confirm("Gerar nova password temporária?")) return;
    try {
      const res = await resetPassword(token, id);
      setInfo(
        `Nova password para ${res.email}: ${res.new_password} (copie e envie ao utilizador)`,
      );
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-8 pb-8">
      {/* Header */}
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
        <img src="/IPPC_logo.png" alt="IPCC" className="h-36" />
      </div>

      <div className="w-full max-w-md bg-purple-400 text-white text-center rounded-full py-3 font-bold tracking-wide mb-6">
        UTILIZADORES
      </div>

      <button
        onClick={openCreate}
        className="w-full max-w-md bg-black text-white rounded-full py-3 font-bold tracking-wide mb-6 hover:bg-gray-900"
      >
        + NOVO UTILIZADOR
      </button>

      {error && (
        <p className="w-full max-w-md bg-red-100 text-red-700 rounded-lg p-3 text-sm mb-4">
          {error}
        </p>
      )}

      {info && (
        <p className="w-full max-w-md bg-green-100 text-green-800 rounded-lg p-3 text-sm mb-4 break-all">
          {info}
        </p>
      )}

      {loading ? (
        <p className="text-gray-500">A carregar...</p>
      ) : (
        <div className="w-full max-w-md flex flex-col gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-gray-100 rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{u.username}</p>
                  <p className="text-xs text-gray-600 break-all">{u.email}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    u.role === "SUPER_USER"
                      ? "bg-purple-400 text-white"
                      : "bg-gray-300 text-black"
                  }`}
                >
                  {u.role}
                </span>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => openEdit(u)}
                  className="flex-1 bg-blue-500 text-white text-xs font-bold rounded-full py-2"
                >
                  EDITAR
                </button>
                <button
                  onClick={() => handleReset(u.id)}
                  className="flex-1 bg-yellow-500 text-white text-xs font-bold rounded-full py-2"
                >
                  RESET PW
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="flex-1 bg-red-600 text-white text-xs font-bold rounded-full py-2"
                >
                  APAGAR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criar/editar */}
      {form.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-center">
              {form.mode === "create" ? "NOVO UTILIZADOR" : "EDITAR UTILIZADOR"}
            </h2>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="USER"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="bg-gray-200 rounded-full py-3 px-4 text-center"
              />
              <input
                type="email"
                placeholder="EMAIL"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-gray-200 rounded-full py-3 px-4 text-center"
              />
              <input
                type="password"
                placeholder={
                  form.mode === "edit"
                    ? "PASSWORD (deixe vazio para manter)"
                    : "PASSWORD"
                }
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-gray-200 rounded-full py-3 px-4 text-center"
              />
              {form.mode === "create" && (
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="bg-gray-200 rounded-full py-3 px-4 text-center"
                >
                  <option value="TRANSLATOR">TRANSLATOR</option>
                  <option value="SUPER_USER">SUPER_USER</option>
                </select>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setForm(emptyForm)}
                className="flex-1 bg-gray-300 text-black font-bold rounded-full py-3"
              >
                CANCELAR
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-black text-white font-bold rounded-full py-3"
              >
                GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}

      <Link to="/admin" className="mt-8 text-sm text-gray-600 underline">
        ← Voltar
      </Link>

      <footer className="w-full max-w-md text-center mt-6 text-xs text-gray-500">
        <p className="font-semibold">Versão Beta</p>
        <p>Desenvolvido por Hudson Peres</p>
      </footer>
    </div>
  );
}
