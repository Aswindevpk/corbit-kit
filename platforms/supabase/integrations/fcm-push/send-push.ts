// Outbox handler for topic 'push.send'.
// payload: { userIds: string[]; title: string; body: string; data?: Record<string, string> }
import type { Handler } from './index.ts';

type ServiceAccount = { client_email: string; private_key: string; project_id: string };
const sa: ServiceAccount = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT')!);

let cachedToken: { value: string; expiresAt: number } | null = null;

const b64url = (data: ArrayBuffer | string) =>
  btoa(typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export const sendPush: Handler = async (payload, { supabase }) => {
  const { userIds, title, body, data } = payload as {
    userIds: string[]; title: string; body: string; data?: Record<string, string>;
  };
  const { data: rows, error } = await supabase.from('device_tokens').select('token').in('user_id', userIds);
  if (error) throw error;
  if (!rows?.length) return;

  const accessToken = await getAccessToken();
  const failures: string[] = [];

  for (const { token } of rows) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
    });
    if (res.ok) continue;
    const text = await res.text();
    if (res.status === 404 || text.includes('UNREGISTERED')) {
      await supabase.from('device_tokens').delete().eq('token', token);
    } else {
      failures.push(`${res.status}: ${text}`);
    }
  }
  // Partial failure retries the whole job; FCM tolerates duplicates poorly, so keep
  // payloads informational ("you have a new message") rather than counters.
  if (failures.length) throw new Error(failures.join('\n'));
};
