import { Client, Template, Assignment, CommunicationLog, ClientStatus } from '../types';

export interface DataClient {
  from: (table: string) => any;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  body?: string;
}

export type PushToast = (t: Omit<Toast, 'id'>) => void;

export interface CloudStepHandlers {
  createClient: (client: Client) => Promise<Client>;
  saveTemplate: (template: Template) => Promise<Template>;
  createAssignment: (assignment: Assignment, initialLog: CommunicationLog) => Promise<Assignment>;
  updateMilestoneStatus: (
    assignmentId: string,
    updatedMilestones: Assignment['milestones'],
    newStatus: 'Active' | 'Completed',
    newLogs: CommunicationLog[]
  ) => Promise<Assignment>;
  archiveClient: (clientId: string) => Promise<Client>;
  restoreClient: (clientId: string) => Promise<Client>;
  softDeleteClient: (clientId: string) => Promise<Client>;
  insertLog: (log: CommunicationLog) => Promise<CommunicationLog>;
  pushToast: PushToast;
}
