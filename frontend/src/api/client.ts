const API_URL = "http://localhost:8080";

export interface User {
  id: number;
  username: string;
  email: string;
  role: "TRANSLATOR" | "SUPER_USER";
}

export interface LoginResponse {
  token: string;
  user: User;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || "Falha no login");
  }

  return res.json();
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("Não autenticado");
  return res.json();
}

export async function listUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erro ao listar utilizadores");
  return res.json();
}

export async function createUser(
  token: string,
  data: { username: string; email: string; password: string; role: string },
): Promise<User> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao criar utilizador");
  }
  return res.json();
}

export async function updateUser(
  token: string,
  id: number,
  data: { username?: string; email?: string; password?: string },
): Promise<User> {
  const res = await fetch(`${API_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao atualizar");
  }
  return res.json();
}

export async function deleteUser(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao apagar");
  }
}

export async function resetPassword(
  token: string,
  id: number,
): Promise<{ new_password: string; email: string }> {
  const res = await fetch(`${API_URL}/api/users/${id}/reset-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao resetar password");
  }
  return res.json();
}
