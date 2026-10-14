import React, { useEffect, useState } from 'react';
import { Plus, Send, Trash2, AlertTriangle, CheckCircle2, Mail, Star, Pencil } from 'lucide-react';
import { useRR } from './store';
import * as data from './data';
import type { RRChannel, RRWebhook, ChannelType } from './types';
import { Button, Card, Field, Input, Modal, Select, SectionTitle, Pill, Empty, Toggle, fmtDateTime } from './ui';
import { CHANNEL_META } from './RenewalForm';

export default function Channels() {
  const { account, channels, entities, plan, canAdmin, run, reload, setAccount, toast } = useRR();
  const [editing, setEditing] = useState<RRChannel | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const extraTypes = [...new Set(channels.filter(c => c.type !== 'email').map(c => c.type))];
  const fnReady = data.functionConfigured();

  const test = async (c: RRChannel) => {
    setBusy(c.id);
    const res = await run(() => data.api.testChannel(c.id));
    setBusy(null);
    if (res) {
      toast(res.ok ? { kind: 'success', title: `Test sent to ${c.label || CHANNEL_META[c.type].label}`, body: 'Confirm it arrived before relying on it.' }
        : { kind: 'error', title: 'Test failed', body: res.error ?? undefined });
      await reload();
    }
  };

  const toggleDefault = async (c: RRChannel) => {
    const ids = account.defaultChannelIds.includes(c.id) ? account.defaultChannelIds.filter(x => x !== c.id) : [...account.defaultChannelIds, c.id];
    const a = await run(() => data.updateAccount(account.id, { defaultChannelIds: ids }), 'Account defaults updated — schedules will follow');
    if (a) setAccount(a);
  };

  return (
    <div className="space-y-5">
      <SectionTitle eyebrow="Delivery" title="Where reminders are delivered">
        {canAdmin && <Button kind="primary" onClick={() => setEditing('new')}><Plus className="w-3.5 h-3.5" /> Add channel</Button>}
      </SectionTitle>

      <Card className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center"><Mail className="w-5 h-5" /></span>
          <div>
            <p className="font-bold text-slate-900">Email <Pill className="ml-1">Always on</Pill></p>
            <p className="text-xs text-slate-500">Every reminder goes by email to the renewal's responsible person, otherwise the entity contact, otherwise <b className="text-slate-700">{account.ownerEmail || 'the account owner'}</b>. Email is also the fallback when another channel fails.</p>
          </div>
        </div>
        {canAdmin && <Button disabled={!fnReady} busy={busy === 'email'} onClick={async () => {
          setBusy('email');
          const res = await run(() => data.api.testEmail(account.id));
          setBusy(null);
          if (res) toast(res.ok ? { kind: 'success', title: `Test email sent to ${account.ownerEmail}` } : { kind: 'error', title: 'Test email failed', body: res.error ?? undefined });
        }}><Send className="w-3.5 h-3.5" /> Test email</Button>}
      </Card>

      <p className="text-xs text-slate-500">
        Your {plan.label} plan includes email plus <b className="text-slate-800">{plan.extraChannels}</b> additional channel type{plan.extraChannels === 1 ? '' : 's'} ({extraTypes.length} in use{extraTypes.length ? `: ${extraTypes.map(t => CHANNEL_META[t].label).join(', ')}` : ''}).
        Default order of delivery is by priority (lowest first). <b className="text-slate-700">Starred</b> channels are the account defaults for new renewals.
      </p>

      {channels.length === 0 ? (
        <Card><Empty icon={<Send className="w-5 h-5" />} title="Only email so far">Add WhatsApp or SMS so reminders reach you where you actually look. They are delivered through your relay webhook (n8n, Make or Zapier) — set that up under Integrations.</Empty></Card>
      ) : (
        <div className="bg-slate-150 border border-slate-200 rounded-2xl divide-y divide-slate-200">
          {channels.map(c => {
            const isDefault = account.defaultChannelIds.includes(c.id);
            return (
              <div key={c.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border ${c.flagged ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{CHANNEL_META[c.type].icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                      {c.label || CHANNEL_META[c.type].label}
                      <Pill>{CHANNEL_META[c.type].label}</Pill>
                      {c.entityId && <Pill>{entities.find(e => e.id === c.entityId)?.name ?? 'Entity'}</Pill>}
                      {!c.enabled && <Pill>Disabled</Pill>}
                      {c.verifiedAt ? <span className="text-[10px] text-emerald-600 inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> tested</span> : <span className="text-[10px] text-amber-700">not tested</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{c.type === 'webhook' ? 'Webhook endpoint' : c.target} · priority {c.priority}{c.lastDeliveryAt ? ` · last delivery ${fmtDateTime(c.lastDeliveryAt)}` : ''}</p>
                    {c.flagged && <p className="text-[11px] text-red-600 flex items-start gap-1 mt-0.5"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> Failing ({c.consecutiveFailures}×): {c.flaggedReason}. Reminders fell back to email.</p>}
                  </div>
                </div>
                {canAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button kind="ghost" onClick={() => toggleDefault(c)} title={isDefault ? 'Remove from account defaults' : 'Make an account default'}>
                      <Star className={`w-3.5 h-3.5 ${isDefault ? 'fill-current text-blue-600' : ''}`} />
                    </Button>
                    <Button disabled={!fnReady} busy={busy === c.id} onClick={() => test(c)}><Send className="w-3.5 h-3.5" /> Test</Button>
                    <Button kind="ghost" onClick={() => setEditing(c)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <p className="text-sm font-bold text-slate-900">Delivery rules</p>
        <ul className="text-xs text-slate-500 mt-2 space-y-1 list-disc pl-4">
          <li><b className="text-slate-700">{account.deliveryMode === 'sequential' ? 'Sequential' : 'Fan-out'}</b>: {account.deliveryMode === 'sequential' ? 'the highest-priority channel fires first; the next one only if not done within 24 hours.' : 'every selected channel receives each reminder.'} Change it in Settings or per renewal.</li>
          <li>Quiet hours: no WhatsApp or SMS outside {String(account.quietStart).padStart(2, '0')}:00–{String(account.quietEnd).padStart(2, '0')}:00{account.quietOverride ? ' (currently overridden)' : ''}. They roll to the next permitted window.</li>
          <li>If a non-email channel fails, the reminder is sent by email straight away and the channel is flagged. After 2 consecutive failures the account owner is told.</li>
          <li>Every dispatch is logged with timestamp, channel and outcome.</li>
        </ul>
      </Card>

      {editing && <ChannelForm channel={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ChannelForm({ channel, onClose }: { channel: RRChannel | null; onClose: () => void }) {
  const { account, entities, channels, plan, run, reload } = useRR();
  const [type, setType] = useState<ChannelType>(channel?.type ?? 'whatsapp');
  const [label, setLabel] = useState(channel?.label ?? '');
  const [target, setTarget] = useState(channel?.target ?? '');
  const [priority, setPriority] = useState(channel?.priority ?? 10 + channels.length * 10);
  const [entityId, setEntityId] = useState<string | null>(channel?.entityId ?? null);
  const [enabled, setEnabled] = useState(channel?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [hooks, setHooks] = useState<RRWebhook[]>([]);

  useEffect(() => { data.fetchWebhooks(account.id).then(setHooks).catch(() => {}); }, [account.id]);

  const usedTypes = new Set(channels.filter(c => c.type !== 'email' && c.id !== channel?.id).map(c => c.type));
  const typeAllowed = (t: ChannelType) => t === 'email' || usedTypes.has(t) || usedTypes.size < plan.extraChannels;

  const valid = (() => {
    if (type === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target);
    if (type === 'whatsapp' || type === 'sms') return /^\+[1-9]\d{7,14}$/.test(target.replace(/\s/g, ''));
    if (type === 'webhook') return !!target;
    return /^https:\/\//.test(target);
  })();

  const save = async () => {
    setBusy(true);
    const clean = type === 'whatsapp' || type === 'sms' ? target.replace(/\s/g, '') : target.trim();
    const ok = await run(() => data.saveChannel({ id: channel?.id, accountId: account.id, type, label: label.trim(), target: clean, priority, entityId, enabled }), channel ? 'Channel saved' : 'Channel added — send a test to verify it');
    setBusy(false);
    if (ok) { await reload(); onClose(); }
  };

  return (
    <Modal title={channel ? 'Edit channel' : 'Add channel'} onClose={onClose} footer={<>
      {channel && <Button kind="danger" onClick={async () => {
        if (!confirm('Remove this channel? Renewals that used it keep email and any other channels.')) return;
        if (await run(() => data.deleteRow('rr_channels', channel.id), 'Channel removed')) { await reload(); onClose(); }
      }}><Trash2 className="w-3.5 h-3.5" /> Remove</Button>}
      <Button onClick={onClose}>Cancel</Button>
      <Button kind="primary" busy={busy} disabled={!valid || !typeAllowed(type)} onClick={save}>Save</Button>
    </>}>
      <div className="space-y-3">
        <Field label="Type">
          <Select value={type} disabled={!!channel} onChange={e => { setType(e.target.value as ChannelType); setTarget(''); }}>
            {(Object.keys(CHANNEL_META) as ChannelType[]).map(t => <option key={t} value={t} disabled={!typeAllowed(t)}>{CHANNEL_META[t].label}{!typeAllowed(t) ? ' (plan limit reached)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Label"><Input value={label} onChange={e => setLabel(e.target.value)} placeholder={type === 'whatsapp' ? "Owner's WhatsApp" : type === 'slack' ? '#compliance' : ''} /></Field>
        {type === 'webhook' ? (
          <Field label="Webhook endpoint" hint={hooks.length ? CHANNEL_META.webhook.hint : 'Create a webhook endpoint under Integrations first.'}>
            <Select value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">Choose an endpoint…</option>
              {hooks.map(h => <option key={h.id} value={h.id}>{h.label} — {h.url}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label={type === 'whatsapp' || type === 'sms' ? 'Phone number' : type === 'email' ? 'Email address' : 'Incoming webhook URL'} hint={CHANNEL_META[type].hint}>
            <Input value={target} onChange={e => setTarget(e.target.value)} placeholder={CHANNEL_META[type].placeholder} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority" hint="Lower fires first in sequential mode"><Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} /></Field>
          {entities.length > 0 && (
            <Field label="Belongs to" hint="Entity channels reach that client">
              <Select value={entityId ?? ''} onChange={e => setEntityId(e.target.value || null)}>
                <option value="">Whole account</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
        {(type === 'whatsapp' || type === 'sms') && (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            WhatsApp and SMS are handed to your <b>relay webhook</b> as a signed <code>reminder.relay</code> event containing the number and message. Your n8n, Make or Zapier flow sends it with whichever provider you already use. No Meta Business onboarding is needed in CloudStep.
          </p>
        )}
      </div>
    </Modal>
  );
}
