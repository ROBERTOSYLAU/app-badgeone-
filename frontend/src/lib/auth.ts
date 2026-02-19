export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("badgeone_token");
}

export function getRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("badgeone_role");
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("badgeone_token");
  localStorage.removeItem("badgeone_role");
}
