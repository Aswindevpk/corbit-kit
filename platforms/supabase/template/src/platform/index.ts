// The platform boundary. App-level code imports from '@/platform' only.
// Feature api/ folders may also import { supabase } from '@/platform/client'.
export { AuthProvider, useAuth, type AuthUser } from './auth';
export { fetchMyPermissions } from './permissions';
export { toAppError, unwrap } from './errors';
export { uploadFile, getSignedUrl } from './storage';
