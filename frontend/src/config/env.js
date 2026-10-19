/*
  Backend addresses, read once. Vite bakes VITE_* values in at build time, so
  after changing them on Vercel the project must be redeployed.
*/

const configured = import.meta.env.VITE_API_URL;

export const API_URL = configured || "http://localhost:5000/api";

export const WS_URL =
  import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "") + "/ws";

// Problems that make a production build silently useless; shown as a banner.
export function configProblem() {
  if (!import.meta.env.PROD) return null;
  if (!configured) {
    return "VITE_API_URL is not set. Add it in the Vercel project settings (Environment Variables) and redeploy.";
  }
  if (window.location.protocol === "https:" && !API_URL.startsWith("https://")) {
    return "This page is served over https but VITE_API_URL is not. Browsers block that. Use an https:// backend URL (and wss:// for VITE_WS_URL).";
  }
  return null;
}
