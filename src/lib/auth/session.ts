import { AUTH_STORAGE_KEY } from "@/lib/auth/constants";
import type { User } from "@/types/auth";

export type AuthSession = {
  user: User;
  accessToken: string;
};

type LegacySessionShape = Partial<AuthSession> & { email?: string; workspaceId?: string };

export function persistSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LegacySessionShape;
    if (parsed.accessToken && parsed.user?.email) {
      return { user: parsed.user, accessToken: parsed.accessToken };
    }

    // Legacy/malformed session — force re-login
    if (parsed.email) {
      clearSession();
    }
  } catch {
    clearSession();
  }

  return null;
}

export function getStoredAccessToken(): string | null {
  return readSession()?.accessToken ?? null;
}
