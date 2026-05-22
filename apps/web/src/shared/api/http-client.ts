import { API_URL } from '@/shared/config/env';
import { normalizeResponse } from '@/shared/api/errors';

// Импортируем getState без подписки, чтобы не создавать циклических зависимостей.
// Lazy import через функцию — позволяет избежать circular deps между shared/api и features/auth.
let getAccessToken: (() => string | null) | null = null;

/** Регистрирует геттер accessToken (вызывается из features/auth/model/auth-store) */
export function registerTokenGetter(getter: () => string | null) {
  getAccessToken = getter;
}

async function request<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const token = getAccessToken?.();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw await normalizeResponse(response);
  }

  // 204 No Content — нет тела
  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

export const http = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
