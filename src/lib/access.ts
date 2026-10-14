import { getDataClient } from './neon';

// =====================================================
// Per-user access to CloudStep's systems (multi-tenant SaaS).
// Granted by a platform administrator; enforced again in Postgres RLS
// (public.has_product / is_member), so these checks only shape the UI.
// =====================================================

export type Product = 'journeys' | 'renewals';

export const PRODUCTS: { key: Product; label: string; short: string; route: string }[] = [
  { key: 'journeys', label: 'Business Console (Client Journeys)', short: 'Business Console', route: '' },
  { key: 'renewals', label: 'Renewal Reminder', short: 'Renewal Reminder', route: '#/renewals' },
];

export interface Access {
  exists: boolean;
  role: 'admin' | 'owner';
  status: 'active' | 'suspended';
  suspendedReason: string | null;
  products: Product[];
  mustChangePassword: boolean;
  setupComplete: boolean;
}

export async function fetchAccess(userId: string): Promise<Access> {
  const { data, error } = await (getDataClient() as any)
    .from('users')
    .select('id, role, status, suspended_reason, products, must_change_password, setup_complete')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return { exists: false, role: 'owner', status: 'active', suspendedReason: null, products: ['journeys', 'renewals'], mustChangePassword: false, setupComplete: false };
  }
  return {
    exists: true,
    role: data.role === 'admin' ? 'admin' : 'owner',
    status: data.status === 'suspended' ? 'suspended' : 'active',
    suspendedReason: data.suspended_reason ?? null,
    products: (data.products ?? []) as Product[],
    mustChangePassword: data.must_change_password === true,
    setupComplete: data.setup_complete === true,
  };
}

export const canUse = (a: Access | null, p: Product) => !!a && a.status === 'active' && (a.role === 'admin' || a.products.includes(p));
