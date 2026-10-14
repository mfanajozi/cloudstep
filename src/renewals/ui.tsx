import React, { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { STATUS_META, RenewalStatus } from './engine';

// Small UI kit for the Renewal Reminder console, in the CloudSTep
// dark + gold idiom (slate ramp = dark surfaces, blue ramp = gold).

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-slate-150 border border-slate-200 rounded-2xl p-5 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
      <div>
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">{eyebrow}</p>}
        <h2 className="text-lg font-bold text-slate-900 mt-0.5">{title}</h2>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  kind = 'secondary', busy, children, className = '', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; busy?: boolean }) {
  const styles: Record<BtnKind, string> = {
    primary: 'bg-blue-600 text-ink-950 hover:bg-blue-500 shadow-md shadow-blue-100/30',
    secondary: 'bg-slate-50 text-slate-800 border border-slate-200 hover:border-blue-500 hover:text-blue-600',
    danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
    ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/40',
  };
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={`inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${styles[kind]} ${className}`}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[11px] text-slate-400 mt-1 leading-snug">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-350 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} className={`${inputCls} ${props.className ?? ''}`} />,
);
Input.displayName = 'Input';

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-slate-950 transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
      </button>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function StatusBadge({ status }: { status: RenewalStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${m.tone}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

export function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap ${className}`}>{children}</span>;
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/80 backdrop-blur-sm p-0 sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-slate-100 border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${wide ? 'sm:max-w-4xl' : 'sm:max-w-xl'} max-h-[92vh] flex flex-col animate-fade-in`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-3">{icon}</div>}
      <p className="font-bold text-slate-800">{title}</p>
      {children && <div className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'text-slate-900' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="bg-slate-150 border border-slate-200 rounded-2xl p-4">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------

export function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Opens a print-ready document; the browser's "Save as PDF" produces the PDF. */
export function printDocument(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { alert('Allow pop-ups for this site to export a PDF.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font:12px/1.45 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:32px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}.ok{color:#047857}.bad{color:#b91c1c}
.kpis{display:flex;gap:12px;margin:14px 0}.kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}.kpi b{display:block;font-size:18px}
@media print{body{margin:12mm}.noprint{display:none}}
</style></head><body>
<p class="noprint" style="background:#fef9c3;padding:8px 12px;border-radius:6px">Use your browser's Print → <b>Save as PDF</b> to keep this report.</p>
${bodyHtml}
<p class="muted" style="margin-top:28px">Generated ${escapeHtml(new Date().toLocaleString('en-ZA'))} · CloudStep Renewal Reminder</p>
<script>setTimeout(function(){window.print()},400)</script></body></html>`);
  w.document.close();
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : undefined });
}
