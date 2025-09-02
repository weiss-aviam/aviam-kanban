/**
 * Error handling utilities for the Kanban application
 */

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

export class KanbanError extends Error implements AppError {
  code?: string;
  statusCode?: number;
  details?: any;

  constructor(message: string, code?: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'KanbanError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Parse error from API response
 */
export function parseApiError(error: any): AppError {
  if (error instanceof KanbanError) {
    return error;
  }

  if (error?.response) {
    // Axios-style error
    return {
      message: error.response.data?.error || error.response.statusText || 'An error occurred',
      code: error.response.data?.code,
      statusCode: error.response.status,
      details: error.response.data?.details,
    };
  }

  if (error?.message) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: any): string {
  const appError = parseApiError(error);

  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    'UNAUTHORIZED': 'You are not authorized to perform this action',
    'FORBIDDEN': 'Access denied',
    'NOT_FOUND': 'The requested resource was not found',
    'VALIDATION_ERROR': 'Please check your input and try again',
    'NETWORK_ERROR': 'Network error. Please check your connection',
    'SERVER_ERROR': 'Server error. Please try again later',
    'RATE_LIMITED': 'Too many requests. Please wait and try again',
  };

  if (appError.code && errorMessages[appError.code]) {
    return errorMessages[appError.code];
  }

  if (appError.statusCode) {
    switch (appError.statusCode) {
      case 400:
        return 'Invalid request. Please check your input';
      case 401:
        return 'Please sign in to continue';
      case 403:
        return 'You do not have permission to perform this action';
      case 404:
        return 'The requested item was not found';
      case 409:
        return 'This action conflicts with the current state';
      case 422:
        return 'Please check your input and try again';
      case 429:
        return 'Too many requests. Please wait and try again';
      case 500:
        return 'Server error. Please try again later';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later';
      default:
        return appError.message;
    }
  }

  return appError.message;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on client errors (4xx)
      const appError = parseApiError(error);
      if (appError.statusCode && appError.statusCode >= 400 && appError.statusCode < 500) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  const appError = parseApiError(error);
  
  // Network errors are retryable
  if (!appError.statusCode) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (appError.statusCode >= 500) {
    return true;
  }

  // Rate limiting is retryable
  if (appError.statusCode === 429) {
    return true;
  }

  // Client errors (4xx) are not retryable
  return false;
}

/**
 * Log error for debugging
 */
export function logError(error: any, context?: string): void {
  const appError = parseApiError(error);
  
  console.error('Application Error:', {
    context,
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    details: appError.details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create error boundary fallback component props
 */
export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * Default error boundary fallback
 */
export function DefaultErrorFallback({ error, resetError }: ErrorBoundaryFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 text-center mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 text-center mb-6">
          {getErrorMessage(error)}
        </p>
        <button
          onClick={resetError}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
