import { API_URL as BASE_URL } from "../config/env.js";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export default { request };
