import apiClient from "@/api/client";
import type { ApiUser, AuthResponse, LoginRequest, RegisterRequest } from "@/types/auth";

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/api/v1/auth/login", payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/api/v1/auth/register", payload);
    return data;
  },

  async me(): Promise<ApiUser> {
    const { data } = await apiClient.get<ApiUser>("/api/v1/auth/me");
    return data;
  },
};

export default authApi;
