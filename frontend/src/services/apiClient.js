const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
