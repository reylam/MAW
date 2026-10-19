/*
  Backend addresses, read once. Vite bakes VITE_* values in at build time, so
  after changing them on Vercel the project must be redeployed.

  Values are forgiving: "maw-backend.example.com" becomes
  "https://maw-backend.example.com/api" (https in production, http in dev).
*/

const configured = import.meta.env.VITE_API_URL;
const scheme = import.meta.env.PROD ? "https" : "http";

function normalizeApiUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `${scheme}://${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/" || parsed.pathname === "") url = `${parsed.origin}/api`;
  } catch {
    /* leave as is, the request will fail visibly */
  }
  return url;
}

function normalizeWsUrl(raw, apiUrl) {
  if (!raw) return apiUrl.replace(/^http/, "ws").replace(/\/api\/?$/, "") + "/ws";
  let url = String(raw).trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(url)) url = url.replace(/^http/i, "ws");
  else if (!/^wss?:\/\//i.test(url)) url = `${scheme === "https" ? "wss" : "ws"}://${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/" || parsed.pathname === "") url = `${parsed.origin}/ws`;
  } catch {
    /* leave as is */
  }
  return url;
}

export const API_URL = normalizeApiUrl(configured) || "http://localhost:5000/api";
export const WS_URL = normalizeWsUrl(import.meta.env.VITE_WS_URL, API_URL);

// Problems that make a production build silently useless; shown as a banner.
export function configProblem() {
  if (!import.meta.env.PROD) return null;
  if (!configured) {
    return "VITE_API_URL is not set. Add it in the Vercel project settings (Environment Variables) and redeploy.";
  }
  if (window.location.protocol === "https:" && !API_URL.startsWith("https://")) {
    return "This page is served over https but the backend URL is not. Browsers block that. Use an https:// backend URL (and wss:// for VITE_WS_URL).";
  }
  return null;
}
