import apiClient from "./apiClient";

export const deviceService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/devices${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/devices/${id}`),
  health: () => apiClient.request(`/devices/health`),
};
