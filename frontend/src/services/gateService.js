import apiClient from "./apiClient";

export const gateService = {
  getStatus: (crossingId) => apiClient.request(`/crossings/${crossingId}/gate`),

  // action: 'open' | 'close' | 'release'
  control: (crossingId, { action, operator, reason }) =>
    apiClient.request(`/crossings/${crossingId}/gate`, {
      method: "POST",
      body: JSON.stringify({ action, operator, reason }),
    }),
};
