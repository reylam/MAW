import apiClient from "./apiClient";

export const sensorService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/sensors${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/sensors/${id}`),
};
