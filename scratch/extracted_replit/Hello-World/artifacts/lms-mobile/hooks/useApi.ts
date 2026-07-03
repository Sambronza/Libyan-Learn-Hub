import { useAuth } from "@/contexts/AuthContext";

export function useApi() {
  const { token, apiBase } = useAuth();

  async function apiFetch(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${apiBase}${path}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || err.message || "Request failed");
    }
    return res.json();
  }

  return { apiFetch };
}
