import apiClient from "./apiClient";

export const maintenanceService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/maintenance${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/maintenance/${id}`),
  create: (data) => apiClient.request(`/maintenance`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiClient.request(`/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
