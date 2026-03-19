import "server-only";

type BackendFetchOptions = RequestInit & {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getBackendApiBaseUrl(): string | null {
  const raw =
    process.env.BACKEND_API_URL ??
    process.env.INTERNAL_BACKEND_API_URL ??
    "";

  if (!raw.trim()) {
    return null;
  }

  return normalizeBaseUrl(raw);
}

export function isBackendApiConfigured(): boolean {
  return getBackendApiBaseUrl() !== null;
}

function buildBackendUrl(path: string): string {
  const baseUrl = getBackendApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Backend API URL is not configured.");
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function fetchBackendJson<T>(
  path: string,
  options?: BackendFetchOptions,
): Promise<T> {
  const url = buildBackendUrl(path);
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Backend request failed (${response.status}) for ${path}: ${body.slice(0, 300)}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

