import type { AnchorMode, PresetKey, Recurrence } from './schedule';

// =====================================================
// SA-focused categories and the renewal template library.
//
// Guardrail: a template supplies the *shape* of an obligation (category,
// cycle, anchor, ladder). It never supplies a date. Every template forces
// the user to type the actual due date for their entity.
// =====================================================

export type CategoryKey =
  | 'statutory' | 'tax' | 'labour' | 'bbbee' | 'licences'
  | 'insurance' | 'digital' | 'memberships' | 'internal';

export const CATEGORIES: { key: CategoryKey; label: string; examples: string; color: string }[] = [
  { key: 'statutory', label: 'Statutory & CIPC', examples: 'Annual return, beneficial ownership, director changes', color: '#2563eb' },
  { key: 'tax', label: 'Tax & SARS', examples: 'Tax compliance status pin, provisional tax, VAT, PAYE', color: '#dc2626' },
  { key: 'labour', label: 'Labour & COIDA', examples: 'Return of earnings, letter of good standing, UIF', color: '#d97706' },
  { key: 'bbbee', label: 'B-BBEE', examples: 'Certificate renewal, verification cycle, sworn affidavit', color: '#059669' },
  { key: 'licences', label: 'Licences & permits', examples: 'Liquor, municipal business licence, health certificate', color: '#7c3aed' },
  { key: 'insurance', label: 'Insurance & risk', examples: 'Public liability, vehicle, asset cover', color: '#0891b2' },
  { key: 'digital', label: 'Digital assets', examples: 'Domains, hosting, SSL, software subscriptions, trademarks', color: '#db2777' },
  { key: 'memberships', label: 'Industry bodies & memberships', examples: 'Professional registrations, association fees', color: '#65a30d' },
  { key: 'internal', label: 'Internal', examples: 'Contract renewals, lease escalations, policy reviews', color: '#475569' },
];

export function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label ?? key;
}

export function categoryColor(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.color ?? '#475569';
}

export interface RenewalTemplate {
  key: string;
  name: string;
  category: CategoryKey;
  recurrence: Recurrence;
  anchorMode: AnchorMode;
  preset: PresetKey;
  expectsAttachment: boolean;
  description: string;
  dateHint: string; // where to find the real date — never the date itself
}

const year = { unit: 'year', interval: 1 } as const;
const month = { unit: 'month', interval: 1 } as const;
const twoMonths = { unit: 'month', interval: 2 } as const;

export const TEMPLATE_LIBRARY: RenewalTemplate[] = [
  {
    key: 'cipc-annual-return', name: 'CIPC Annual Return', category: 'statutory', recurrence: year, anchorMode: 'fixed', preset: 'standard', expectsAttachment: true,
    description: 'Annual return to the Companies and Intellectual Property Commission, anchored to the incorporation anniversary.',
    dateHint: 'Use your incorporation date as shown on your CIPC registration certificate (CoR14.3).',
  },
  {
    key: 'cipc-beneficial-ownership', name: 'Beneficial Ownership Filing', category: 'statutory', recurrence: year, anchorMode: 'fixed', preset: 'standard', expectsAttachment: true,
    description: 'Beneficial ownership declaration to CIPC, filed alongside the annual return and whenever ownership changes.',
    dateHint: 'Usually aligned to your annual return date — confirm it on the CIPC portal.',
  },
  {
    key: 'bbbee-certificate', name: 'B-BBEE Certificate / Affidavit', category: 'bbbee', recurrence: year, anchorMode: 'completion', preset: 'aggressive', expectsAttachment: true,
    description: 'Renewal of the B-BBEE verification certificate or sworn affidavit. Anchored to the issue date of each new certificate.',
    dateHint: 'Use the expiry date printed on your current certificate or affidavit.',
  },
  {
    key: 'sars-tcs', name: 'SARS Tax Compliance Status (TCS) PIN', category: 'tax', recurrence: year, anchorMode: 'completion', preset: 'standard', expectsAttachment: true,
    description: 'Renew the Tax Compliance Status PIN that tenders and suppliers ask for.',
    dateHint: 'Use the expiry date shown against the PIN on SARS eFiling.',
  },
  {
    key: 'sars-vat', name: 'VAT201 Return', category: 'tax', recurrence: twoMonths, anchorMode: 'fixed', preset: 'short', expectsAttachment: false,
    description: 'Periodic VAT return. Most vendors file every two months; change the cycle if your category differs.',
    dateHint: 'Use the next submission deadline from your SARS VAT notice of registration.',
  },
  {
    key: 'sars-paye-uif', name: 'PAYE / UIF / SDL (EMP201)', category: 'tax', recurrence: month, anchorMode: 'fixed', preset: 'short', expectsAttachment: false,
    description: 'Monthly employer declaration and payment of PAYE, UIF and SDL.',
    dateHint: 'Use the next EMP201 deadline from SARS eFiling.',
  },
  {
    key: 'coida-roe', name: 'COIDA Return of Earnings', category: 'labour', recurrence: year, anchorMode: 'fixed', preset: 'standard', expectsAttachment: true,
    description: 'Annual Return of Earnings to the Compensation Fund.',
    dateHint: 'Use the deadline published by the Compensation Fund for this filing season.',
  },
  {
    key: 'coida-good-standing', name: 'COIDA Letter of Good Standing', category: 'labour', recurrence: year, anchorMode: 'completion', preset: 'standard', expectsAttachment: true,
    description: 'Renew the letter of good standing from the Compensation Fund.',
    dateHint: 'Use the expiry date on your current letter of good standing.',
  },
  {
    key: 'municipal-business-licence', name: 'Municipal Business Licence', category: 'licences', recurrence: year, anchorMode: 'fixed', preset: 'standard', expectsAttachment: true,
    description: 'Business licence issued by your local municipality.',
    dateHint: 'Use the expiry date on your current licence.',
  },
  {
    key: 'liquor-licence', name: 'Liquor Licence Renewal', category: 'licences', recurrence: year, anchorMode: 'fixed', preset: 'aggressive', expectsAttachment: true,
    description: 'Annual renewal fee and documentation for a provincial liquor licence.',
    dateHint: 'Use the renewal date from your provincial liquor authority.',
  },
  {
    key: 'professional-membership', name: 'Professional Body Membership', category: 'memberships', recurrence: year, anchorMode: 'fixed', preset: 'gentle', expectsAttachment: false,
    description: 'Professional registration or association membership fee.',
    dateHint: 'Use the renewal date on your last membership invoice.',
  },
  {
    key: 'domain-renewal', name: 'Domain Name Renewal', category: 'digital', recurrence: year, anchorMode: 'fixed', preset: 'standard', expectsAttachment: false,
    description: 'Registration renewal for a website domain (e.g. .co.za).',
    dateHint: 'Use the expiry date shown by your domain registrar.',
  },
  {
    key: 'trademark', name: 'Trademark Renewal', category: 'digital', recurrence: { unit: 'year', interval: 10 }, anchorMode: 'fixed', preset: 'aggressive', expectsAttachment: true,
    description: 'Trademark registrations in South Africa run for ten years from the filing date.',
    dateHint: 'Use the renewal date on the CIPC trademark register.',
  },
  {
    key: 'public-liability', name: 'Public Liability Insurance', category: 'insurance', recurrence: year, anchorMode: 'fixed', preset: 'standard', expectsAttachment: true,
    description: 'Annual renewal of public liability cover.',
    dateHint: 'Use the renewal date on your policy schedule.',
  },
  {
    key: 'vehicle-licence', name: 'Vehicle Licence Disc', category: 'licences', recurrence: year, anchorMode: 'fixed', preset: 'gentle', expectsAttachment: false,
    description: 'Annual motor vehicle licence renewal.',
    dateHint: 'Use the expiry date on the current licence disc.',
  },
  {
    key: 'lease-renewal', name: 'Lease Renewal / Escalation', category: 'internal', recurrence: year, anchorMode: 'fixed', preset: 'aggressive', expectsAttachment: true,
    description: 'Premises lease renewal or annual escalation date, including notice periods.',
    dateHint: 'Use the renewal or escalation date in your signed lease.',
  },
];

export function findTemplate(key: string | null | undefined): RenewalTemplate | undefined {
  return key ? TEMPLATE_LIBRARY.find(t => t.key === key) : undefined;
}
