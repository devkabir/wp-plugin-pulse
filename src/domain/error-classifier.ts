import type { AppError, ErrorKind } from './plugin-types';

export class PluginRequestError extends Error implements AppError {
  readonly kind: ErrorKind;
  readonly statusCode?: number;

  constructor(message: string, kind: ErrorKind, statusCode?: number) {
    super(message);
    this.name = 'PluginRequestError';
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export function classifyError(error: unknown): AppError {
  if (error instanceof PluginRequestError) {
    return {
      kind: error.kind,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (typeof error === 'object' && error !== null && 'kind' in error && 'message' in error) {
    const candidate = error as { kind: string; message: unknown; statusCode?: unknown };
    const validKinds: ErrorKind[] = ['network', 'http', 'invalid_response', 'unknown'];
    const kind = validKinds.includes(candidate.kind as ErrorKind) ? (candidate.kind as ErrorKind) : 'unknown';
    return {
      kind,
      message: typeof candidate.message === 'string' ? candidate.message : 'Unable to load plugins. Please try again.',
      statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      kind: 'network',
      message: 'Network connection unavailable. Please check your internet connection and try again.',
    };
  }

  if (error instanceof Error) {
    const msg = error.message;

    // Check for explicit HTTP status codes
    const httpMatch = msg.match(/status (\d+)/i) || msg.match(/HTTP (\d+)/i);
    if (httpMatch) {
      const statusCode = parseInt(httpMatch[1], 10);
      return {
        kind: 'http',
        message: `Plugin request failed with HTTP ${statusCode}. Please try again.`,
        statusCode,
      };
    }

    // Check for malformed / invalid payload issues
    if (
      msg.includes('invalid') ||
      msg.includes('malformed') ||
      msg.includes('pagination metadata') ||
      msg.includes('JSON') ||
      msg.includes('Unexpected token')
    ) {
      return {
        kind: 'invalid_response',
        message: 'Received an invalid or malformed response from the WordPress.org Plugin API.',
      };
    }

    // Check for network / fetch connection failures
    if (
      error.name === 'TypeError' ||
      msg.includes('fetch') ||
      msg.includes('Network') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('ECONNREFUSED')
    ) {
      return {
        kind: 'network',
        message: 'Network connection error. Unable to reach the WordPress.org API.',
      };
    }

    return {
      kind: 'unknown',
      message: msg || 'Unable to load plugins. Please try again.',
    };
  }

  return {
    kind: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
  };
}
