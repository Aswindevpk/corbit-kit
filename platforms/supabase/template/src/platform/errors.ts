import { AppError } from '@/lib/contracts';

type PostgrestLike = { code: string; message: string; details?: string | null; hint?: string | null };

function isPostgrestError(e: unknown): e is PostgrestLike {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

/**
 * Normalises every Supabase error into AppError.
 * Contract with the database (platforms/supabase/docs/rpc-guide.md):
 *   raise exception using errcode = 'P0001', message = 'CODE', hint = 'formField';
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isPostgrestError(error)) {
    switch (error.code) {
      case 'P0001':
        return new AppError(error.message, { field: error.hint || undefined });
      case '42501':
        return new AppError('PERMISSION_DENIED');
      case '23505':
        return new AppError('DUPLICATE', { detail: error.details ?? undefined });
      case 'PGRST301':
      case 'PGRST303':
        return new AppError('NOT_AUTHENTICATED');
      default:
        return new AppError('UNKNOWN', { detail: `${error.code}: ${error.message}` });
    }
  }

  if (error instanceof Error && error.name.startsWith('Auth')) {
    return new AppError('AUTH_FAILED', { detail: error.message });
  }
  if (error instanceof TypeError) return new AppError('NETWORK_ERROR');
  return new AppError('UNKNOWN', { detail: String(error) });
}

/** Awaits a Supabase call and returns data, or throws AppError. */
export async function unwrap<T>(call: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let result: { data: T | null; error: unknown };
  try {
    result = await call;
  } catch (e) {
    throw toAppError(e);
  }
  if (result.error) throw toAppError(result.error);
  return result.data as T;
}
