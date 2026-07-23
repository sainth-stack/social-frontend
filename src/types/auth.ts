export type SocialPermissionLevel = "viewer" | "editor" | "publisher" | "admin";

export type PlanTier = "starter" | "growth" | "enterprise";

/** Raw shape returned by the backend (`/auth/login`, `/auth/register`, `/auth/me`). */
export type ApiUser = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  socialPermissionLevel?: SocialPermissionLevel | null;
  plan?: PlanTier | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
};

/** Normalized frontend user shape used throughout the app. */
export type User = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  socialPermissionLevel: SocialPermissionLevel;
  plan: PlanTier;
};
