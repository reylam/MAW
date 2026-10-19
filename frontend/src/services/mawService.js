import apiClient from "./apiClient";

export const mawService = {
  getConfig: () => apiClient.request(`/maw/config`),
  getStates: () => apiClient.request(`/maw/crossings`),
  getState: (crossingId) => apiClient.request(`/crossings/${crossingId}/state`),
  getEvents: (crossingId) => apiClient.request(`/crossings/${crossingId}/events?date=today`),
};
