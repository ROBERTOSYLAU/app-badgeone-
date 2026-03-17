import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

function apiUrl(path: string) {
  if (API_BASE.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE}${path.slice(4)}`;
  }
  return `${API_BASE}${path}`;
}

async function parseResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (res.status === 204) return null;

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  return text ? { detail: text } : null;
}

async function buildErrorMessage(method: string, path: string, res: Response) {
  let detail = "";

  try {
    const data = await parseResponse(res);
    if (data && typeof data === "object" && "detail" in data && data.detail) {
      detail = String(data.detail);
    } else if (typeof data === "string" && data.trim()) {
      detail = data.trim();
    }
  } catch {}

  return `${method} ${path} falhou${detail ? `: ${detail}` : ""}`;
}

export async function apiGet(path: string) {
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await buildErrorMessage("GET", path, res));
  }

  return parseResponse(res);
}

export async function apiPost(path: string, body: unknown) {
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await buildErrorMessage("POST", path, res));
  }

  return parseResponse(res);
}

export async function apiDelete(path: string) {
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(await buildErrorMessage("DELETE", path, res));
  }

  return parseResponse(res);
}

export async function apiPatch(path: string, body: unknown) {
  const token = getToken();

  const res = await fetch(apiUrl(path), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await buildErrorMessage("PATCH", path, res));
  }

  return parseResponse(res);
}
