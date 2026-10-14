// =====================================================
// Packaging: plan limits and feature gates.
//
// The same table is mirrored in SQL (public.rr_plan_limits) so the
// database refuses inserts over the limit even if the UI is bypassed.
// Keep the two in step.
//
// Channel limit wording (brief §14): "email + up to N additional".
// =====================================================

export type PlanKey = 'free' | 'solo' | 'business' | 'provider' | 'provider_wl';

export interface PlanLimits {
  label: string;
  entities: number;
  renewals: number;        // Infinity = unlimited
  extraChannels: number;   // channels beyond email
  users: number;
  watchers: boolean;       // watcher alerts + delegated setup
  providerDashboard: boolean;
  bulkActions: boolean;
  auditExport: boolean;
  proofOfReminder: boolean;
  whiteLabel: boolean;
  webhooks: boolean;
}

export const PLANS: Record<PlanKey, PlanLimits> = {
  free: {
    label: 'Free', entities: 1, renewals: 3, extraChannels: 0, users: 1,
    watchers: false, providerDashboard: false, bulkActions: false, auditExport: false, proofOfReminder: false, whiteLabel: false, webhooks: false,
  },
  solo: {
    label: 'Solo', entities: 1, renewals: 15, extraChannels: 1, users: 1,
    watchers: false, providerDashboard: false, bulkActions: false, auditExport: false, proofOfReminder: false, whiteLabel: false, webhooks: true,
  },
  business: {
    label: 'Business', entities: 3, renewals: Infinity, extraChannels: 3, users: 10,
    watchers: true, providerDashboard: false, bulkActions: false, auditExport: true, proofOfReminder: true, whiteLabel: false, webhooks: true,
  },
  provider: {
    label: 'Provider', entities: 200, renewals: Infinity, extraChannels: 3, users: 25,
    watchers: true, providerDashboard: true, bulkActions: true, auditExport: true, proofOfReminder: true, whiteLabel: false, webhooks: true,
  },
  provider_wl: {
    label: 'Provider White-Label', entities: 500, renewals: Infinity, extraChannels: 3, users: 50,
    watchers: true, providerDashboard: true, bulkActions: true, auditExport: true, proofOfReminder: true, whiteLabel: true, webhooks: true,
  },
};

export function planOf(key: string | null | undefined): PlanLimits {
  return PLANS[(key as PlanKey) ?? 'business'] ?? PLANS.business;
}

export function formatLimit(n: number): string {
  return Number.isFinite(n) ? String(n) : 'Unlimited';
}
