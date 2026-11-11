import { supabase } from './client';
import { unwrap } from './errors';

export async function uploadFile(bucket: string, path: string, file: File): Promise<{ path: string }> {
  const data = await unwrap(supabase.storage.from(bucket).upload(path, file, { upsert: false }));
  return { path: data.path };
}

/** Keep expiry short for anything access-controlled: a signed URL ignores later RLS changes. */
export async function getSignedUrl(bucket: string, path: string, expiresInSec = 300): Promise<string> {
  const data = await unwrap(supabase.storage.from(bucket).createSignedUrl(path, expiresInSec));
  return data.signedUrl;
}
