import { Client, Template, Assignment, CommunicationLog, ClientStatus, Industry, UserProfile } from '../types';

// =====================================================
// CloudSTep: Data Access Layer
// Single source of truth for Neon (PostgREST) reads/writes.
// All field-name translation between camelCase (TS) and
// snake_case (DB) happens here so components stay clean.
// =====================================================

type AnyClient = Client & { [k: string]: any };

function toDbClient(c: AnyClient, agentUserId: string | null) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company ?? null,
    reference: c.reference,
    industry: c.industry,
    status: c.status ?? 'active',
    date_of_birth: c.dateOfBirth ?? null,
    anniversary_date: c.anniversaryDate ?? null,
    agent_user_id: agentUserId,
  };
}

function fromDbClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company ?? undefined,
    reference: row.reference,
    industry: row.industry as Industry,
    status: (row.status as ClientStatus) ?? 'active',
    dateOfBirth: row.date_of_birth ?? null,
    anniversaryDate: row.anniversary_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbTemplate(t: Template, agentUserId: string | null) {
  return {
    id: t.id,
    name: t.name,
    industry: t.industry,
    description: t.description,
    milestones: t.milestones,
    metadata: t.metadata,
    agent_user_id: agentUserId,
  };
}

function fromDbTemplate(row: any): Template {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry as Industry,
    description: row.description,
    milestones: row.milestones ?? [],
    metadata: row.metadata,
  };
}

function toDbAssignment(a: Assignment, agentUserId: string | null) {
  return {
    id: a.id,
    client_id: a.clientId,
    template_id: a.templateId,
    status: a.status,
    started_at: a.startedAt,
    milestones: a.milestones,
    metadata: a.metadata,
    agent_user_id: agentUserId,
  };
}

function fromDbAssignment(row: any): Assignment {
  return {
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id,
    status: row.status,
    startedAt: row.started_at,
    milestones: row.milestones ?? [],
    metadata: row.metadata,
  };
}

function toDbLog(l: CommunicationLog, agentUserId: string | null) {
  return {
    id: l.id,
    client_id: l.clientId,
    client_name: l.clientName,
    milestone_title: l.milestoneTitle,
    channel: l.channel,
    message: l.message,
    timestamp: l.timestamp,
    status: l.status,
    agent_user_id: agentUserId,
  };
}

function fromDbLog(row: any): CommunicationLog {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    milestoneTitle: row.milestone_title,
    channel: row.channel,
    message: row.message,
    timestamp: row.timestamp,
    status: row.status,
  };
}

// =====================================================
// Public API
// =====================================================

export interface DataClient {
  from: (table: string) => any;
}

export async function fetchClients(db: DataClient): Promise<Client[]> {
  const { data, error } = await db
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchClients: ${error.message}`);
  return (data || []).map(fromDbClient);
}

export async function upsertClient(
  db: DataClient,
  client: Client,
  agentUserId: string | null
): Promise<Client> {
  const payload = toDbClient(client, agentUserId);
  const { data, error } = await db
    .from('clients')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(`upsertClient: ${error.message}`);
  return fromDbClient(data);
}

export async function updateClientStatus(
  db: DataClient,
  clientId: string,
  status: ClientStatus,
  agentUserId: string | null
): Promise<Client> {
  const { data, error } = await db
    .from('clients')
    .update({ status, agent_user_id: agentUserId })
    .eq('id', clientId)
    .select('*')
    .single();
  if (error) throw new Error(`updateClientStatus: ${error.message}`);
  return fromDbClient(data);
}

// =====================================================
// Users (owner workspaces)
// The row in `users` is what provisions a signed-in account as
// a business owner of the tool. `setup_complete` gates first login.
// =====================================================

function toDbProfile(p: UserProfile) {
  const payload: Record<string, unknown> = {
    id: p.id,
    full_name: p.fullName,
    email: p.email,
    phone: p.phone ?? null,
    company: p.company ?? null,
    position: p.position ?? null,
    avatar_url: p.avatarUrl ?? null,
    industry: p.industry,
    setup_complete: true,
  };
  // `username` is only writable when the caller actually supplies it, so a
  // profile save never blanks the handle chosen at sign-up.
  if (p.username) payload.username = p.username;
  return payload;
}

function fromDbProfile(row: any): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    username: row.username ?? null,
    role: row.role === 'admin' ? 'admin' : 'owner',
    setupComplete: row.setup_complete === true,
    phone: row.phone ?? null,
    company: row.company ?? null,
    position: row.position ?? null,
    avatarUrl: row.avatar_url ?? null,
    industry: (row.industry as Industry) ?? 'real-estate',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchUserProfile(db: DataClient, userId: string): Promise<UserProfile | null> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchUserProfile: ${error.message}`);
  return data ? fromDbProfile(data) : null;
}

/**
 * First-login gate: does this account already have a finished workspace?
 * Reads a narrow projection so it works before any profile exists.
 */
export async function fetchUserSetupState(
  db: DataClient,
  userId: string
): Promise<{ exists: boolean; setupComplete: boolean }> {
  const { data, error } = await db
    .from('users')
    .select('id, setup_complete')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchUserSetupState: ${error.message}`);
  return { exists: !!data, setupComplete: data?.setup_complete === true };
}

export async function upsertUserProfile(db: DataClient, profile: UserProfile): Promise<UserProfile> {
  const payload = toDbProfile(profile);
  const { data, error } = await db
    .from('users')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(`upsertUserProfile: ${error.message}`);
  return fromDbProfile(data);
}

export async function fetchTemplates(db: DataClient): Promise<Template[]> {
  const { data, error } = await db
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchTemplates: ${error.message}`);
  return (data || []).map(fromDbTemplate);
}

export async function upsertTemplate(
  db: DataClient,
  template: Template,
  agentUserId: string | null
): Promise<Template> {
  const payload = toDbTemplate(template, agentUserId);
  const { data, error } = await db
    .from('templates')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(`upsertTemplate: ${error.message}`);
  return fromDbTemplate(data);
}

export async function fetchAssignments(db: DataClient): Promise<Assignment[]> {
  const { data, error } = await db
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchAssignments: ${error.message}`);
  return (data || []).map(fromDbAssignment);
}

export async function upsertAssignment(
  db: DataClient,
  assignment: Assignment,
  agentUserId: string | null
): Promise<Assignment> {
  const payload = toDbAssignment(assignment, agentUserId);
  const { data, error } = await db
    .from('assignments')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw new Error(`upsertAssignment: ${error.message}`);
  return fromDbAssignment(data);
}

export async function fetchLogs(db: DataClient): Promise<CommunicationLog[]> {
  const { data, error } = await db
    .from('communication_logs')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) throw new Error(`fetchLogs: ${error.message}`);
  return (data || []).map(fromDbLog);
}

export async function insertLog(
  db: DataClient,
  log: CommunicationLog,
  agentUserId: string | null
): Promise<CommunicationLog> {
  const payload = toDbLog(log, agentUserId);
  const { data, error } = await db
    .from('communication_logs')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(`insertLog: ${error.message}`);
  return fromDbLog(data);
}
