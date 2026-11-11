import { AppError } from './contracts';

// Core codes from shared/standards/error-codes.md. Features add their own in messages.ts.
const coreMessages: Record<string, string> = {
  PERMISSION_DENIED: "You don't have permission to do this.",
  NOT_AUTHENTICATED: 'Your session has ended. Sign in again.',
  SESSION_REPLACED: 'You signed in on another device, so this session was closed.',
  NOT_FOUND: 'This item no longer exists. Refresh the page.',
  VALIDATION_FAILED: 'Some details are not valid. Check the highlighted fields.',
  DUPLICATE: 'This already exists.',
  NETWORK_ERROR: "Can't reach the server. Check your connection and try again.",
  UNKNOWN: 'Something went wrong. Try again, and contact support if it keeps happening.',
};

export function getErrorMessage(error: unknown, featureMessages: Record<string, string> = {}): string {
  const code = error instanceof AppError ? error.code : 'UNKNOWN';
  return featureMessages[code] ?? coreMessages[code] ?? coreMessages.UNKNOWN!;
}
