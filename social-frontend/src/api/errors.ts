import type { AxiosError } from "axios";

/** Normalized API error for UI toasts and AsyncBoundary messages. */
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const axiosError = error as AxiosError<{ message?: string; detail?: string | Array<{ msg?: string }> }>;
  if (axiosError?.isAxiosError) {
    const status = axiosError.response?.status;
    const body = axiosError.response?.data;
    const message = formatApiDetail(body?.detail) ?? body?.message ?? axiosError.message ?? "Request failed. Please try again.";
    return new ApiError(message, status, axiosError.code);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError("Something went wrong.");
}

function formatApiDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item)))
      .filter(Boolean);
    return messages.length ? messages.join(". ") : undefined;
  }
  return undefined;
}
