import { toast } from "sonner";

import { authApi } from "@/api/endpoints/auth.api";
import { toApiError } from "@/api/errors";

export async function startGoogleAuth(): Promise<void> {
  try {
    const { url } = await authApi.getGoogleAuthUrl();
    window.location.href = url;
  } catch (error) {
    toast.error(toApiError(error).message);
  }
}
