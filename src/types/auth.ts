export type SocialPermissionLevel = "viewer" | "editor" | "publisher" | "admin";

export type PlanTier = "starter" | "growth" | "enterprise";

/** Backend `/auth/me` and nested user objects use snake_case. */
export type ApiUserRaw = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  created_at?: string;
};

export type ApiWorkspaceSummary = {
  id: string;
  name: string;
  plan: PlanTier | string;
  role: string;
  social_level: SocialPermissionLevel | string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type MeResponse = {
  user: ApiUserRaw;
  workspaces: ApiWorkspaceSummary[];
};

export type RegisterResponse = {
  access_token: string;
  token_type: string;
  user: ApiUserRaw;
  workspace: ApiWorkspaceSummary;
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
