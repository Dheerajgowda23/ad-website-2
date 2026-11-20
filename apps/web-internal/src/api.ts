export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Every call is same-origin through the Vite proxy, so the session cookie is
 * sent without CORS and without a token in JavaScript.
 */
export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? 'The request could not be completed',
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
    );
  }
  return body as T;
};
