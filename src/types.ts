// CloudSTep is scoped to a single niche: Real Estate / Conveyancing.
// The field is retained for storage and badge rendering, but there is
// only one legal value.
export type Industry = 'real-estate';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  username?: string | null;
  role?: 'admin' | 'owner';
  setupComplete?: boolean;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
  avatarUrl?: string | null;
  industry: Industry;
  createdAt?: string;
  updatedAt?: string;
}

export type CommunicationChannel = 'WhatsApp' | 'SMS' | 'Email';

export interface Milestone {
  id: string;
  title: string;
  dueInDays: number;
  reminderFrequency: 'Daily' | 'Weekly' | 'Fortnightly' | 'On Event';
  channels: CommunicationChannel[];
  messageTemplate: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  completedAt?: string;
  updatedAt?: string;
  estimatedDuration: string;
}

export interface OutstandingItem {
  id: string;
  item: string;
  status: 'Requested' | 'Pending' | 'Received' | 'Verified';
  expectedDate?: string | null;
  condition?: string | null;
  assignedTo?: string | null;
}

export interface AutomationTrigger {
  trigger: string;
  action: string;
}

export interface ContactRole {
  role: string;
  firm?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface AdvancedMetadata {
  delayReason?: string | null;
  delayAssignee?: string | null;
  currentStatusSummary?: string;
  nextAction?: string;
  conditionalSaleDetails?: any;
  bondDetails?: any;
  outstandingItems?: OutstandingItem[];
  contacts?: ContactRole[];
  automationTriggers?: AutomationTrigger[];
}

export interface Template {
  id: string;
  name: string;
  industry: Industry;
  description: string;
  milestones: Milestone[];
  metadata?: AdvancedMetadata;
}

export type ClientStatus = 'active' | 'archived' | 'deleted_by_user';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  reference: string; 
  industry: Industry;
  status?: ClientStatus;
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  clientId: string;
  templateId: string;
  status: 'Active' | 'Completed';
  startedAt: string;
  milestones: Milestone[];
  metadata?: AdvancedMetadata;
}

export interface CommunicationLog {
  id: string;
  clientId: string;
  clientName: string;
  milestoneTitle: string;
  channel: CommunicationChannel;
  message: string;
  timestamp: string;
  status: 'Sent' | 'Delivered';
}
