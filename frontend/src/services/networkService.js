import apiClient from "./apiClient";

export const networkService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/network/nodes${query ? `?${query}` : ""}`);
  },
  getHealth: () => apiClient.request(`/network/health`),
  getLinks: () => apiClient.request(`/network/links`),
  getById: (id) => apiClient.request(`/network/nodes/${id}`),
};
