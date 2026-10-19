import apiClient from "./apiClient";

export const alertService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/alerts${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/alerts/${id}`),
  acknowledge: (id) => apiClient.request(`/alerts/${id}/acknowledge`, { method: 'PATCH' }),
  resolve: (id) => apiClient.request(`/alerts/${id}/resolve`, { method: 'PATCH' }),
};
