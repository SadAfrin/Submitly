const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export type Role = "STUDENT" | "MENTOR";
export type User = { id: number; name: string; email: string; role: Role };

export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];
  constructor(status: number, message: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",   // cookie pathao ar nao
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? "Request failed", data.errors);
  }
  return data as T;
}

export const getMe = () =>
  api<{ user: User }>("/auth/me").then((r) => r.user).catch(() => null);

export const logout = () => api("/auth/logout", { method: "POST" });