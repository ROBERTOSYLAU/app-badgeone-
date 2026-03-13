export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "issuer";
  status?: "active" | "inactive";
  organization_id?: number | null;
  organization_name?: string | null;
  permissions?: string[];
};

const SESSION_KEY = "badgeone_session_user";
const TOKEN_KEY = "badgeone_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(data: { access_token?: string; user?: SessionUser; role?: string }) {
  if (typeof window === "undefined") return;
  if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
  if (data.user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
    localStorage.setItem("badgeone_role", data.user.role);
  } else if (data.role) {
    localStorage.setItem("badgeone_role", data.role);
  }
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function getRole() {
  const u = getSessionUser();
  if (u?.role) return u.role;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("badgeone_role");
}

export function getOrganizationId() {
  const u = getSessionUser();
  return u?.organization_id ?? null;
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("badgeone_role");
  localStorage.removeItem(SESSION_KEY);
}
