import { Ctx, tick } from './scheduler';
import { ackGet, ackPost, portalGet, portalPost } from './pages';
import { handleAppApi, handleInboundApi, json } from './api';

// =====================================================
// CloudStep Renewal Reminder — Neon Function `renewals`
//
//   POST /cron          Function Trigger (every 5 minutes): reschedule,
//                       dispatch, events, digests, retention
//   GET|POST /a/:token  Mark as done / snooze (no login)
//   GET|POST /p/:token  Client portal (no login)
//   /api/*              Web app (Neon Auth JWT)
//   /v1/*               Inbound integrations (API key)
//   GET /health
//
// Env: RESEND_API_KEY, EMAIL_FROM, APP_URL, PUBLIC_URL (optional),
//      ALLOWED_ORIGINS (optional, comma-separated, for /api CORS).
// Injected by Neon: DATABASE_URL, NEON_AUTH_JWKS_URL, NEON_AUTH_BASE_URL.
// =====================================================

function ctxFor(req: Request): Ctx {
  const origin = new URL(req.url).origin;
  return {
    publicUrl: (process.env.PUBLIC_URL || origin).replace(/\/+$/, ''),
    appUrl: (process.env.APP_URL || 'https://www.cloudst.co.za').replace(/\/+$/, ''),
    now: new Date(),
  };
}

function cors(req: Request, publicApi: boolean): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const allow = publicApi || !allowed.length || allowed.includes(origin) ? (origin || '*') : '';
  if (!allow) return {};
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

/**
 * A Function Trigger delivery carries `x-neon-trigger-invocation-id`. The
 * Functions proxy strips client-supplied x-neon-* headers, so its presence
 * (matching the body) proves the call came from Neon's scheduler.
 */
async function isTriggerDelivery(req: Request): Promise<boolean> {
  const header = req.headers.get('x-neon-trigger-invocation-id');
  if (!header) return false;
  try {
    const b = (await req.clone().json()) as { invocation_id?: string; trigger?: { type?: string } };
    return b.invocation_id === header && b.trigger?.type === 'schedule';
  } catch {
    return false;
  }
}

async function readForm(req: Request): Promise<FormData> {
  try { return await req.formData(); } catch { return new FormData(); }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const ctx = ctxFor(req);

    try {
      if (path[0] === 'health' || path.length === 0) {
        return json({ ok: true, service: 'cloudstep-renewals', time: ctx.now.toISOString() });
      }

      if (path[0] === 'cron' && req.method === 'POST') {
        if (!(await isTriggerDelivery(req))) return json({ error: 'Forbidden' }, 403);
        return json({ ok: true, ...(await tick(ctx)) });
      }

      if (path[0] === 'a' && path[1]) {
        if (req.method === 'GET') return await ackGet(path[1], ctx);
        if (req.method === 'POST') return await ackPost(path[1], await readForm(req), ctx);
      }

      if (path[0] === 'p' && path[1]) {
        if (req.method === 'GET') return await portalGet(path[1], ctx);
        if (req.method === 'POST') return await portalPost(path[1], await readForm(req), ctx);
      }

      if (path[0] === 'api') {
        const h = cors(req, false);
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
        return withHeaders(await handleAppApi(req, path, ctx), h);
      }

      if (path[0] === 'v1') {
        const h = cors(req, true);
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
        return withHeaders(await handleInboundApi(req, path, ctx), h);
      }

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error('[renewals]', e);
      return json({ error: 'Internal error' }, 500);
    }
  },
};
