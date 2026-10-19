import apiClient from "./apiClient";

export const authService = {
  // Validate an operator email against the backend authorization list.
  // Returns the operator's public fields on success; throws with a clear
  // message when the email is unauthorized or malformed.
  validateOperator: (email) =>
    apiClient.request("/auth/validate-operator", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};
