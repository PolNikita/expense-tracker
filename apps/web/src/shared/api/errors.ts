export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface NestErrorBody {
  message?: string | string[];
  statusCode?: number;
  error?: string;
}

/** Нормализует стандартный формат Nest.js exception в ApiError */
export async function normalizeResponse(response: Response): Promise<ApiError> {
  let body: NestErrorBody = {};
  try {
    body = (await response.json()) as NestErrorBody;
  } catch {
    // тело не JSON
  }

  const rawMessage = body.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join('; ')
    : (rawMessage ?? response.statusText ?? 'Unknown error');

  return new ApiError(response.status, message, body);
}
