import type { AnchorMode, PresetKey, RecurrenceUnit, CategoryKey, PlanKey } from './engine';

// Row shapes for the Renewal Reminder tables, in the app's camelCase.
// Translation to/from snake_case happens only in ./data.ts.

export type RRRole = 'owner' | 'admin' | 'contributor' | 'viewer' | 'watcher';
export type ChannelType = 'email' | 'whatsapp' | 'sms' | 'slack' | 'teams' | 'webhook';

export interface RRAccount {
  id: string;
  ownerUserId: string;
  name: string;
  plan: PlanKey;
  timezone: string;
  sendHour: number;
  quietStart: number;
  quietEnd: number;
  quietOverride: boolean;
  defaultPreset: Exclude<PresetKey, 'custom'>;
  defaultChannelIds: string[];
  deliveryMode: 'fanout' | 'sequential';
  overdueAlerts: boolean;
  holidayShift: boolean;
  consolidate: boolean;
  digestEnabled: boolean;
  digestWeekday: number;
  retentionYears: number;
  ownerEmail: string;
  brandName: string | null;
  brandLogoUrl: string | null;
  brandColor: string | null;
  replyToEmail: string | null;
}

export interface RREntity {
  id: string;
  accountId: string;
  name: string;
  registrationNumber: string | null;
  groupName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  portalEnabled: boolean;
  portalToken: string;
  notes: string | null;
  archived: boolean;
}

export interface Watcher { name?: string; email?: string }

export interface RRRenewal {
  id: string;
  accountId: string;
  entityId: string | null;
  name: string;
  category: CategoryKey;
  templateKey: string | null;
  dueDate: string;
  seriesDue: string | null;
  anchorDate: string | null;
  recurrenceUnit: RecurrenceUnit;
  recurrenceInterval: number;
  anchorMode: AnchorMode;
  preset: PresetKey;
  customOffsets: number[] | null;
  channelIds: string[] | null;
  deliveryMode: 'fanout' | 'sequential' | null;
  overdueAlerts: boolean | null;
  holidayShift: boolean | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  responsiblePhone: string | null;
  watchers: Watcher[];
  notes: string | null;
  state: 'active' | 'paused' | 'archived';
  expectsAttachment: boolean;
  cycleNo: number;
  ackToken: string;
  snoozeCount: number;
  snoozedUntil: string | null;
  lastCompletedAt: string | null;
  completedOneOff: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RRChannel {
  id: string;
  accountId: string;
  entityId: string | null;
  type: ChannelType;
  label: string;
  target: string;
  priority: number;
  enabled: boolean;
  verifiedAt: string | null;
  consecutiveFailures: number;
  flagged: boolean;
  flaggedReason: string | null;
  lastDeliveryAt: string | null;
}

export interface RRMember {
  id: string;
  accountId: string;
  userId: string | null;
  email: string;
  name: string;
  role: Exclude<RRRole, 'owner'>;
  entityIds: string[] | null;
  status: 'invited' | 'active' | 'revoked';
  inviteToken?: string;
  prefs: { digest?: boolean; watcherAlerts?: boolean };
  createdAt: string;
  acceptedAt: string | null;
}

export interface RRWebhook {
  id: string;
  accountId: string;
  label: string;
  url: string;
  secret: string;
  events: string[];
  isRelay: boolean;
  enabled: boolean;
  consecutiveFailures: number;
  lastStatus: number | null;
  lastError: string | null;
  lastDeliveryAt: string | null;
}

export interface RRApiKey {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface RRJob {
  id: string;
  renewalId: string;
  cycleNo: number;
  kind: string;
  offsetDays: number | null;
  tone: string;
  fireAt: string;
  status: string;
  sentAt: string | null;
  lastError: string | null;
}

export interface RRDelivery {
  id: string;
  renewalId: string | null;
  cycleNo: number | null;
  channelId: string | null;
  channelType: string;
  target: string;
  audience: string;
  status: 'sent' | 'failed' | 'fallback' | 'skipped';
  subject: string | null;
  error: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface RRCompletion {
  id: string;
  renewalId: string;
  cycleNo: number;
  dueDate: string;
  completedAt: string;
  completedBy: string | null;
  method: 'app' | 'link' | 'portal' | 'api' | 'skipped';
  onTime: boolean;
  note: string | null;
  nextDueDate: string | null;
  reopenedAt: string | null;
}

export interface RRAttachment {
  id: string;
  renewalId: string;
  completionId: string | null;
  cycleNo: number | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface RRChange {
  id: number;
  renewalId: string | null;
  objectType: string;
  objectId: string;
  action: string;
  actor: string;
  changes: Record<string, any>;
  createdAt: string;
}

export interface RRTemplate {
  id: string;
  name: string;
  category: CategoryKey;
  description: string;
  recurrenceUnit: RecurrenceUnit;
  recurrenceInterval: number;
  anchorMode: AnchorMode;
  preset: PresetKey;
  customOffsets: number[] | null;
  expectsAttachment: boolean;
}

export interface MyAccount { accountId: string; name: string; role: RRRole; plan: PlanKey }
