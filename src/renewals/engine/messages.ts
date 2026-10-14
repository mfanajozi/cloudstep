import { ISODate, diffDays, formatLongDate } from './dates';
import { Tone, TONE_LABEL } from './schedule';
import { categoryLabel } from './catalog';

// =====================================================
// Reminder copy. One message shape, rendered per channel.
// Notes are deliberately never included: they hold reference numbers
// and login hints that must not travel over WhatsApp or SMS.
// =====================================================

export interface MessageInput {
  brandName: string;
  renewalName: string;
  entityName?: string | null;
  category: string;
  dueDate: ISODate;
  today: ISODate;
  tone: Tone;
  audience: 'recipient' | 'watcher';
  ackUrl?: string;
  snoozeAvailable?: boolean;
  responsibleName?: string | null;
}

export interface RenderedMessage {
  subject: string;
  text: string;        // plain text for SMS / WhatsApp / Slack / Teams
  short: string;       // <= 160 chars for SMS
  html: string;        // email body
}

function lead(m: MessageInput, left: number): string {
  const what = m.entityName ? `${m.renewalName} for ${m.entityName}` : m.renewalName;
  if (m.audience === 'watcher') {
    if (left < 0) return `${what} is ${-left} day${left === -1 ? '' : 's'} overdue and has not been marked done.`;
    if (left === 0) return `${what} is due today and has not been marked done.`;
    return `${what} is due in ${left} days and has not been acknowledged yet.`;
  }
  switch (m.tone) {
    case 'heads_up': return `Heads-up: ${what} is due in ${left} days.`;
    case 'soon': return `${what} is due in ${left} days. Time to start on it.`;
    case 'needed': return `Action needed: ${what} is due in ${left} days.`;
    case 'urgent': return `Urgent: ${what} is due in ${left} day${left === 1 ? '' : 's'}.`;
    case 'final': return left <= 0 ? `Final notice: ${what} is due today.` : `Final notice: ${what} is due tomorrow.`;
    case 'overdue': return `${what} is ${-left} day${left === -1 ? '' : 's'} overdue.`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function renderReminder(m: MessageInput): RenderedMessage {
  const left = diffDays(m.today, m.dueDate);
  const line = lead(m, left);
  const due = formatLongDate(m.dueDate);
  const label = m.audience === 'watcher' ? 'Watcher alert' : TONE_LABEL[m.tone];
  const subject = `[${label}] ${m.renewalName}${m.entityName ? ` · ${m.entityName}` : ''} — due ${due}`;

  const textLines = [
    `${m.brandName} reminder`,
    line,
    `Due: ${due} · ${categoryLabel(m.category)}`,
  ];
  if (m.audience === 'watcher' && m.responsibleName) textLines.push(`Responsible: ${m.responsibleName}`);
  if (m.ackUrl && m.audience === 'recipient') textLines.push(`Mark as done${m.snoozeAvailable ? ' or snooze' : ''}: ${m.ackUrl}`);
  const text = textLines.join('\n');

  const shortBase = `${m.brandName}: ${line}`;
  const short = m.ackUrl && m.audience === 'recipient'
    ? `${shortBase.slice(0, 160 - m.ackUrl.length - 1)} ${m.ackUrl}`
    : shortBase.slice(0, 160);

  const button = m.ackUrl && m.audience === 'recipient'
    ? `<p style="margin:24px 0"><a href="${escapeHtml(m.ackUrl)}" style="background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">Mark as done</a></p>
       <p style="font-size:12px;color:#64748b">One tap, no login.${m.snoozeAvailable ? ' You can also snooze it for 3 days from the same page.' : ''}</p>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb">${escapeHtml(label)}</p>
      <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(m.renewalName)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escapeHtml(line)}</p>
      <table style="font-size:13px;color:#334155;border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0;color:#64748b">Due</td><td><b>${escapeHtml(due)}</b></td></tr>
        ${m.entityName ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Entity</td><td>${escapeHtml(m.entityName)}</td></tr>` : ''}
        <tr><td style="padding:2px 12px 2px 0;color:#64748b">Category</td><td>${escapeHtml(categoryLabel(m.category))}</td></tr>
        ${m.audience === 'watcher' && m.responsibleName ? `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Responsible</td><td>${escapeHtml(m.responsibleName)}</td></tr>` : ''}
      </table>
      ${button}
    </div>
    <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px">Sent by ${escapeHtml(m.brandName)} because this renewal is scheduled to remind you. Every reminder is logged.</p>
  </div></body></html>`;

  return { subject, text, short, html };
}

export { escapeHtml };
