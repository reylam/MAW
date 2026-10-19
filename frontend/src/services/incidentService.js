import apiClient from "./apiClient";

export const incidentService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/incidents${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/incidents/${id}`),
  create: (data) => apiClient.request(`/incidents`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiClient.request(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
