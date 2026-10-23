export interface AIModelSelection {
  textModel?: string;
  imageModel?: string;
}

export interface AIModelOption {
  id: string;
  label: string;
  provider: string;
  region: string;
  availability: "unknown" | "catalogued";
  invokeAccessVerified: false;
  warning?: string;
}

export interface AIModelCatalog {
  textModels: AIModelOption[];
  imageModels: AIModelOption[];
  defaultTextModelId: string | null;
  defaultImageModelId: string;
  discovery: {
    region: string;
    foundationModels: "ok" | "access_denied" | "unavailable";
    inferenceProfiles: "ok" | "access_denied" | "unavailable";
  }[];
  cacheTtlSeconds: number;
  invokeAccessVerified: false;
  message: string;
}