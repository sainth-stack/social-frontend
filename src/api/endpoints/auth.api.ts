import apiClient from "@/api/client";
import type {
  LoginRequest,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
} from "@/types/auth";

export const authApi = {
  async login(payload: LoginRequest): Promise<TokenResponse> {
    const { data } = await apiClient.post<TokenResponse>("/api/v1/auth/login", payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>("/api/v1/auth/register", {
      email: payload.email,
      password: payload.password,
      full_name: payload.name,
      workspace_name: payload.workspaceName,
    });
    return data;
  },

  async me(accessToken?: string): Promise<MeResponse> {
    const { data } = await apiClient.get<MeResponse>("/api/v1/auth/me", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return data;
  },

  async forgotPassword(email: string): Promise<{ detail: string }> {
    const { data } = await apiClient.post<{ detail: string }>("/api/v1/auth/forgot-password", {
      email,
    });
    return data;
  },

  async resetPassword(token: string, password: string): Promise<{ detail: string }> {
    const { data } = await apiClient.post<{ detail: string }>("/api/v1/auth/reset-password", {
      token,
      password,
    });
    return data;
  },

  async getGoogleAuthUrl(): Promise<{ url: string }> {
    const { data } = await apiClient.get<{ url: string }>("/api/v1/auth/google/url");
    return data;
  },

  async getGoogleAuthStatus(): Promise<{ enabled: boolean }> {
    const { data } = await apiClient.get<{ enabled: boolean }>("/api/v1/auth/google/status");
    return data;
  },
};

export default authApi;
