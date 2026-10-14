import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Send, Trash2, Copy, Eye, EyeOff, RefreshCw, KeyRound, Webhook, Pencil, AlertTriangle } from 'lucide-react';
import { useRR } from './store';
import * as data from './data';
import type { RRWebhook, RRApiKey } from './types';
import { Button, Card, Field, Input, Modal, SectionTitle, Pill, Empty, Toggle, copyText, fmtDateTime } from './ui';

export const WEBHOOK_EVENTS: { key: string; label: string }[] = [
  { key: 'reminder.sent', label: 'Reminder sent (each nudge, with Mark-as-done link)' },
  { key: 'renewal.completed', label: 'Renewal marked as done' },
  { key: 'renewal.overdue', label: 'Renewal became overdue' },
  { key: 'renewal.created', label: 'Renewal created' },
  { key: 'renewal.updated', label: 'Renewal changed' },
  { key: 'renewal.deleted', label: 'Renewal deleted' },
  { key: 'renewal.snoozed', label: 'Renewal snoozed' },
  { key: 'renewal.reopened', label: 'Renewal reopened' },
  { key: 'watcher.alerted', label: 'Watcher alert fired' },
  { key: 'channel.failed', label: 'A delivery channel is failing' },
  { key: 'entity.created', label: 'Entity created' },
  { key: 'entity.updated', label: 'Entity changed' },
];

export default function Integrations() {
  const { account, plan, canAdmin, run, toast } = useRR();
  const [hooks, setHooks] = useState<RRWebhook[]>([]);
  const [keys, setKeys] = useState<RRApiKey[]>([]);
  const [editing, setEditing] = useState<RRWebhook | 'new' | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyLabel, setKeyLabel] = useState('n8n');
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fnReady = data.functionConfigured();

  const load = useCallback(async () => {
    if (!canAdmin) return;
    const [h, k] = await Promise.all([data.fetchWebhooks(account.id), data.fetchApiKeys(account.id)]);
    setHooks(h); setKeys(k);
  }, [account.id, canAdmin]);
  useEffect(() => { load().catch(e => toast({ kind: 'error', title: 'Could not load integrations', body: e.message })); }, [load, toast]);

  if (!canAdmin) return <Card><Empty icon={<Webhook className="w-5 h-5" />} title="Integrations are managed by the account owner and admins" /></Card>;
  if (!plan.webhooks) return <Card><Empty icon={<Webhook className="w-5 h-5" />} title="Webhooks are not included in the Free plan">Ask your CloudStep administrator to move you to Solo or above.</Empty></Card>;

  const base = data.FUNCTION_URL || 'https://<your-renewals-function-url>';
  const relay = hooks.find(h => h.isRelay && h.enabled);

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle eyebrow="Outbound" title="Webhooks — push events to n8n, Make, Zapier or your CRM">
          <Button kind="primary" onClick={() => setEditing('new')}><Plus className="w-3.5 h-3.5" /> Add endpoint</Button>
        </SectionTitle>
        {!relay && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            No relay endpoint yet. WhatsApp and SMS reminders need one: mark an endpoint as <b>Relay</b> and have your flow send the message it receives.
          </p>
        )}
        {hooks.length === 0 ? (
          <Card><Empty icon={<Webhook className="w-5 h-5" />} title="No endpoints">Create a webhook trigger in n8n (Webhook node), Make (Custom webhook) or Zapier (Webhooks by Zapier → Catch Hook), paste its URL here, and choose the events to send.</Empty></Card>
        ) : (
          <div className="bg-slate-150 border border-slate-200 rounded-2xl divide-y divide-slate-200">
            {hooks.map(h => (
              <div key={h.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                    {h.label}
                    {h.isRelay && <Pill className="text-blue-700 border-blue-200 bg-blue-50">Relay: WhatsApp + SMS</Pill>}
                    {!h.enabled && <Pill>Disabled</Pill>}
                    {h.consecutiveFailures > 0 && <Pill className="text-red-700 border-red-200 bg-red-50">{h.consecutiveFailures} failing</Pill>}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate font-mono">{h.url}</p>
                  <p className="text-[11px] text-slate-400">{h.events.length} event{h.events.length === 1 ? '' : 's'}{h.lastDeliveryAt ? ` · last ${fmtDateTime(h.lastDeliveryAt)} ${h.lastError ? `— ${h.lastError}` : '✓'}` : ''}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button disabled={!fnReady} busy={busy === h.id} onClick={async () => {
                    setBusy(h.id);
                    const res = await run(() => data.api.testWebhook(h.id));
                    setBusy(null);
                    if (res) { toast(res.ok ? { kind: 'success', title: 'test.ping delivered' } : { kind: 'error', title: 'Endpoint did not accept the test', body: res.error ?? undefined }); load(); }
                  }}><Send className="w-3.5 h-3.5" /> Test</Button>
                  <Button kind="ghost" onClick={() => setEditing(h)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle eyebrow="Inbound" title="API keys — let n8n, Make or Zapier create and complete renewals" />
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <Field label="Key name" className="flex-1"><Input value={keyLabel} onChange={e => setKeyLabel(e.target.value)} placeholder="e.g. Make — client onboarding" /></Field>
            <label className="flex items-center gap-2 text-xs text-slate-600 pb-2 cursor-pointer"><input type="checkbox" className="accent-[#d8b75c]" checked={readOnly} onChange={e => setReadOnly(e.target.checked)} /> Read-only</label>
            <Button kind="primary" busy={busy === 'key'} disabled={!keyLabel.trim()} onClick={async () => {
              setBusy('key');
              const res = await run(() => data.createApiKey(account.id, keyLabel.trim(), readOnly ? ['read'] : ['read', 'write']));
              setBusy(null);
              if (res) { setNewKey(res.key); load(); }
            }}><KeyRound className="w-3.5 h-3.5" /> Create key</Button>
          </div>
          {newKey && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs font-bold text-emerald-800">Copy this key now — it will not be shown again.</p>
              <div className="flex gap-2 mt-2">
                <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 break-all text-slate-900">{newKey}</code>
                <Button onClick={async () => { if (await copyText(newKey)) toast({ kind: 'success', title: 'Key copied' }); }}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
              <button className="text-[11px] text-slate-500 underline mt-2 cursor-pointer" onClick={() => setNewKey(null)}>I've stored it safely</button>
            </div>
          )}
          {keys.length > 0 && (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
              {keys.map(k => (
                <div key={k.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">{k.label} {k.revokedAt && <Pill>Revoked</Pill>} {!k.scopes.includes('write') && <Pill>Read-only</Pill>}</p>
                    <p className="text-slate-400 font-mono">{k.prefix}… · created {fmtDateTime(k.createdAt)} · {k.lastUsedAt ? `last used ${fmtDateTime(k.lastUsedAt)}` : 'never used'}</p>
                  </div>
                  {!k.revokedAt && <Button kind="danger" onClick={async () => {
                    if (!confirm(`Revoke "${k.label}"? Anything using it stops working immediately.`)) return;
                    if (await run(() => data.revokeApiKey(k.id), 'Key revoked')) load();
                  }}>Revoke</Button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle eyebrow="Reference" title="How the integration works" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="space-y-3 text-xs text-slate-600">
            <p className="font-bold text-slate-900 text-sm">Outbound events</p>
            <p>Each event is a <code>POST</code> with a JSON body <code>{'{ id, type, created_at, account_id, data }'}</code> and these headers:</p>
            <pre className="bg-ink-900 border border-slate-200 rounded-lg p-3 overflow-x-auto text-[11px] text-slate-800">{`X-CloudStep-Event: reminder.sent
X-CloudStep-Delivery: <unique id — use it to de-duplicate>
X-CloudStep-Timestamp: <unix seconds>
X-CloudStep-Signature: sha256=<hex HMAC-SHA256 of "timestamp.rawBody">`}</pre>
            <p>Verify the signature with the endpoint's secret and reject timestamps older than 5 minutes:</p>
            <pre className="bg-ink-900 border border-slate-200 rounded-lg p-3 overflow-x-auto text-[11px] text-slate-800">{`const crypto = require('crypto');
const ts = headers['x-cloudstep-timestamp'];
const expected = 'sha256=' + crypto.createHmac('sha256', SECRET)
  .update(ts + '.' + rawBody).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(expected),
  Buffer.from(headers['x-cloudstep-signature']))
  && Math.abs(Date.now() / 1000 - Number(ts)) < 300;`}</pre>
            <p><b className="text-slate-800">Relay events</b> (<code>reminder.relay</code>) carry <code>data.channel</code> (<code>whatsapp</code> or <code>sms</code>), <code>data.to</code> (E.164 number), <code>data.message</code> and <code>data.ack_url</code>. Send <code>data.message</code> to <code>data.to</code> with your provider and return any 2xx. A non-2xx reply makes CloudStep fall back to email and flag the channel.</p>
            <p>Failed deliveries are retried 3 times with backoff.</p>
          </Card>
          <Card className="space-y-3 text-xs text-slate-600">
            <p className="font-bold text-slate-900 text-sm">Inbound API</p>
            <p>Base URL <code className="break-all">{base}/v1</code>. Send <code>Authorization: Bearer csr_…</code>.</p>
            <pre className="bg-ink-900 border border-slate-200 rounded-lg p-3 overflow-x-auto text-[11px] text-slate-800">{`GET    /v1/ping
GET    /v1/templates
GET    /v1/entities
POST   /v1/entities            { name, contact_email, … }
GET    /v1/renewals?status=overdue&entity_id=…&due_before=YYYY-MM-DD
POST   /v1/renewals            { name, category, due_date,
                                 recurrence: "annual", entity_id,
                                 template_key, preset, responsible_email }
GET    /v1/renewals/:id
PATCH  /v1/renewals/:id        { due_date, permanent: true, … }
DELETE /v1/renewals/:id
POST   /v1/renewals/:id/complete  { note }
POST   /v1/renewals/:id/snooze
GET    /v1/renewals/:id/deliveries`}</pre>
            <p><code>due_date</code> is always required when creating, even with a <code>template_key</code> — CloudStep never assumes a legal deadline.</p>
            <p className="font-bold text-slate-800 pt-1">Quick recipes</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><b>n8n:</b> Webhook node (POST) → IF <code>{'{{$json.data.channel}}'}</code> = whatsapp → your WhatsApp/Twilio node. Paste the Production URL as a Relay endpoint.</li>
              <li><b>Make:</b> Custom webhook → Router on <code>type</code> → SMS module (e.g. BulkSMS, Clickatell). Use HTTP “Make a request” for the inbound API.</li>
              <li><b>Zapier:</b> Catch Hook → Filter by <code>type</code> → any app. Use “Webhooks by Zapier → POST” to call <code>/v1/renewals</code>.</li>
            </ul>
          </Card>
        </div>
      </section>

      {editing && <WebhookForm hook={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function WebhookForm({ hook, onClose, onSaved }: { hook: RRWebhook | null; onClose: () => void; onSaved: () => void }) {
  const { account, run, toast } = useRR();
  const [label, setLabel] = useState(hook?.label ?? 'n8n');
  const [url, setUrl] = useState(hook?.url ?? '');
  const [events, setEvents] = useState<string[]>(hook?.events ?? ['reminder.sent', 'renewal.completed', 'renewal.overdue']);
  const [isRelay, setIsRelay] = useState(hook?.isRelay ?? false);
  const [enabled, setEnabled] = useState(hook?.enabled ?? true);
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState(hook?.secret ?? '');
  const [busy, setBusy] = useState(false);
  const validUrl = /^https:\/\/[^\s]+$/.test(url);

  const save = async () => {
    setBusy(true);
    const saved = await run(() => data.saveWebhook({ id: hook?.id, accountId: account.id, label: label.trim() || 'Webhook', url: url.trim(), events, isRelay, enabled }), hook ? 'Endpoint saved' : 'Endpoint added');
    setBusy(false);
    if (saved) {
      onSaved();
      if (!hook) { setSecret(saved.secret); toast({ kind: 'info', title: 'Copy the signing secret into your flow to verify requests' }); }
      else onClose();
    }
  };

  return (
    <Modal title={hook ? `Edit ${hook.label}` : 'Add webhook endpoint'} onClose={onClose} footer={<>
      {hook && <Button kind="danger" onClick={async () => {
        if (!confirm('Delete this endpoint?')) return;
        if (await run(() => data.deleteRow('rr_webhooks', hook.id), 'Endpoint deleted')) { onSaved(); onClose(); }
      }}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>}
      <Button onClick={onClose}>{!hook && secret ? 'Done' : 'Cancel'}</Button>
      {!(!hook && secret) && <Button kind="primary" busy={busy} disabled={!validUrl || (!events.length && !isRelay)} onClick={save}>Save</Button>}
    </>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={label} onChange={e => setLabel(e.target.value)} /></Field>
        <Field label="Endpoint URL" hint="Must be a public https:// URL."><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-n8n.example.com/webhook/…" /></Field>
        <Toggle checked={isRelay} onChange={setIsRelay} label="Relay for WhatsApp and SMS" hint="This endpoint receives reminder.relay events and sends the messages on CloudStep's behalf." />
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Events</p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {WEBHOOK_EVENTS.map(ev => (
              <label key={ev.key} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-[#d8b75c]" checked={events.includes(ev.key)} onChange={e => setEvents(e.target.checked ? [...events, ev.key] : events.filter(x => x !== ev.key))} />
                <span><code className="text-[10px] text-blue-600">{ev.key}</code><br />{ev.label}</span>
              </label>
            ))}
          </div>
        </div>
        {secret && (
          <Field label="Signing secret">
            <div className="flex gap-2">
              <Input readOnly value={showSecret ? secret : '•'.repeat(32)} className="font-mono text-xs" />
              <Button kind="ghost" onClick={() => setShowSecret(!showSecret)} aria-label="Show secret">{showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Button>
              <Button kind="ghost" onClick={async () => { if (await copyText(secret)) toast({ kind: 'success', title: 'Secret copied' }); }} aria-label="Copy secret"><Copy className="w-3.5 h-3.5" /></Button>
              {hook && <Button kind="ghost" title="Rotate secret" onClick={async () => {
                if (!confirm('Rotate the secret? Update your flow straight away — old signatures stop verifying.')) return;
                const s = await run(() => data.rotateSecret('rr_webhooks', hook.id), 'Secret rotated');
                if (s) { setSecret(s); setShowSecret(true); onSaved(); }
              }}><RefreshCw className="w-3.5 h-3.5" /></Button>}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}
