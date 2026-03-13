import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

function apiUrl(path: string) {
  if (API_BASE.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE}${path.slice(4)}`;
  }
  return `${API_BASE}${path}`;
}

export async function apiGet(path: string) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export async function apiPost(path: string, body: unknown) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.detail ? `: ${data.detail}` : "";
    } catch {}
    throw new Error(`POST ${path} failed${detail}`);
  }
  return res.json();
}

export async function apiDelete(path: string) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.detail ? `: ${data.detail}` : "";
    } catch {}
    throw new Error(`DELETE ${path} failed${detail}`);
  }
  return res.json();
}

export async function apiPatch(path: string, body: unknown) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.detail ? `: ${data.detail}` : "";
    } catch {}
    throw new Error(`PATCH ${path} failed${detail}`);
  }
  return res.json();
}
