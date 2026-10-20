export const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const KEY = "intellmeet";

export const getSession = () => JSON.parse(localStorage.getItem(KEY) || "null");
export const setSession = (s) => (s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY));

const send = (path, method, body, token) =>
  fetch(`${API}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

// Calls the backend. If the 15-minute access token expired, refreshes it once and retries.
export async function api(path, { method = "GET", body } = {}) {
  const s = getSession();
  let res = await send(path, method, body, s?.accessToken);

  if (res.status === 401 && s?.refreshToken && !path.startsWith("/auth/")) {
    const r = await send("/auth/refresh", "POST", { refreshToken: s.refreshToken });
    if (r.ok) {
      const tokens = await r.json();
      setSession({ ...s, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      res = await send(path, method, body, tokens.accessToken);
    } else {
      setSession(null);
      location.reload();
    }
  }

  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
