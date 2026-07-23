import axios from "axios";

import { clearSession, getStoredAccessToken } from "@/lib/auth/session";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? "");

    if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/register")) {
      clearSession();
    }

    return Promise.reject(error);
  },
);

export default apiClient;
