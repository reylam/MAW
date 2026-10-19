import apiClient from "./apiClient";

export const telemetryService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/telemetry${query ? `?${query}` : ""}`);
  },
  getLatest: () => apiClient.request(`/telemetry/latest`),
  getById: (id) => apiClient.request(`/telemetry/${id}`),
};
