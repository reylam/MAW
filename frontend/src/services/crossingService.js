import apiClient from "./apiClient";

export const crossingService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/crossings${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/crossings/${id}`),
};
