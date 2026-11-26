export type ApiFieldErrors = Record<string, string[]>;

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly fields?: ApiFieldErrors;
  readonly status: number;

  constructor(
    message: string,
    options: { code: string; status: number; fields?: ApiFieldErrors },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.fields = options.fields;
  }
}

type CsrfTokenProvider = () => string | undefined;
let csrfTokenProvider: CsrfTokenProvider = readCsrfCookie;
let csrfBootstrap: Promise<string> | undefined;

export function configureCsrfTokenProvider(
  provider: CsrfTokenProvider,
): () => void {
  const previous = csrfTokenProvider;
  csrfTokenProvider = provider;
  return () => {
    csrfTokenProvider = previous;
  };
}

function readCsrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith("qm_csrf="));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice("qm_csrf=".length));
  } catch {
    return undefined;
  }
}

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function getCsrfToken(): Promise<string> {
  const existing = csrfTokenProvider();
  if (existing) return existing;
  csrfBootstrap ??= (async () => {
    let response: Response;
    try {
      response = await fetch("/api/auth/csrf", { credentials: "include" });
    } catch {
      throw new ApiError("Unable to prepare a secure request.", {
        code: "CSRF_UNAVAILABLE",
        status: 0,
      });
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (
      !response.ok ||
      !isRecord(body) ||
      body.success !== true ||
      !isRecord(body.data) ||
      typeof body.data.token !== "string" ||
      !body.data.token
    ) {
      throw new ApiError("Unable to prepare a secure request.", {
        code: "CSRF_UNAVAILABLE",
        status: response.status,
      });
    }
    return body.data.token;
  })().finally(() => {
    csrfBootstrap = undefined;
  });
  return csrfBootstrap;
}

async function apiRequestWithResult<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (unsafeMethods.has(method)) {
    headers.set("x-csrf-token", await getCsrfToken());
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      method,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Unable to reach the service. Check your connection and try again.",
      {
        code: "NETWORK_ERROR",
        status: 0,
      },
    );
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const envelope =
      isRecord(body) && isRecord(body.error) ? body.error : undefined;
    throw new ApiError(
      typeof envelope?.message === "string"
        ? envelope.message
        : "The request could not be completed.",
      {
        code: typeof envelope?.code === "string" ? envelope.code : "INTERNAL",
        status: response.status,
        fields: isFieldErrors(envelope?.fields) ? envelope.fields : undefined,
      },
    );
  }

  if (!isRecord(body) || body.success !== true || !("data" in body)) {
    throw new ApiError("The service returned an invalid response.", {
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }
  return {
    data: body.data as T,
    meta: isRecord(body.meta) ? body.meta : undefined,
  };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const result = await apiRequestWithResult<T>(path, init);
  return result.data;
}

export async function apiRequestWithMeta<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  return apiRequestWithResult<T>(path, init);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFieldErrors(value: unknown): value is ApiFieldErrors {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    )
  );
}
