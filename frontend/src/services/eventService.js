import apiClient from "./apiClient";

export const eventService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.request(`/events${query ? `?${query}` : ""}`);
  },
  getById: (id) => apiClient.request(`/events/${id}`),
  byCrossing: (crossingId) => apiClient.request(`/events?crossing_id=${crossingId}`),
};
