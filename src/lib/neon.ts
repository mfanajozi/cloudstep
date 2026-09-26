import { createClient } from '@neondatabase/neon-js';
import type { DataClient } from './data';

// ---------------------------------------------------------------
// Neon access for the browser.
//
// `createClient` takes a single endpoint URL and derives both the
// Neon Managed Better Auth URL and the Data API URL from it, then
// injects a fresh session JWT on every request.
//
//   https://<endpoint>.<region>.aws.neon.tech/<db>
//     -> auth:    https://<endpoint>.neonauth.<region>.aws.neon.tech/<db>/auth
//     -> dataApi: https://<endpoint>.apirest.<region>.aws.neon.tech/<db>/rest/v1
// ---------------------------------------------------------------

const databaseUrl = (import.meta.env.VITE_NEON_DATABASE_URL as string | undefined)?.trim();
const authUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.trim();
const dataApiUrl = (import.meta.env.VITE_NEON_DATA_API_URL as string | undefined)?.trim();

type NeonClient = ReturnType<typeof createClient>;

function buildClient(): NeonClient {
  if (databaseUrl) return createClient(databaseUrl);
  if (authUrl && dataApiUrl) return createClient({ auth: { url: authUrl }, dataApi: { url: dataApiUrl } });
  throw new Error(
    'Missing Neon configuration. Set VITE_NEON_DATABASE_URL to the endpoint URL ' +
      '(`neon connection-string` prints it), or VITE_NEON_AUTH_URL + VITE_NEON_DATA_API_URL.'
  );
}

let client: NeonClient | null = null;

/**
 * Built on first use, never at module load. A missing VITE_NEON_* variable
 * must not blank the marketing page — it surfaces when auth or data is first
 * touched instead, where callers already catch it.
 */
export function getNeon(): NeonClient {
  if (!client) client = buildClient();
  return client;
}

/** Non-auth-typed view of the client, for the data access layer. */
export const getDataClient = (): DataClient => getNeon() as unknown as DataClient;
