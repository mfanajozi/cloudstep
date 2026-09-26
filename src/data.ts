import { Template, Client, Assignment, CommunicationLog } from './types';

export const INITIAL_TEMPLATES: Template[] = [
  // --- REAL ESTATE / CONVEYANCING TEMPLATES ---
  {
    id: 'tmpl-re-chain',
    name: '1. Conditional Sale & Chain Management',
    industry: 'real-estate',
    description: 'Automate tracking of "subject to sale" clauses, backup offers, and property chains.',
    metadata: {
      currentStatusSummary: 'Awaiting downstream sale',
      nextAction: 'Confirm backup offer status by 18 May',
      conditionalSaleDetails: {
        isSubjectToSale: true,
        backupOfferExists: true,
        chainMap: ['Buyer', 'Buyer’s Sale', 'Downstream Sale']
      },
      delayReason: 'Subject to Sale',
      delayAssignee: 'Agent'
    },
    milestones: [
      { id: 're-1-1', title: 'Offer Signed (Subject to Sale)', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Offer received, waiting for downstream sale.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 're-1-2', title: 'Backup Offer Secured', dueInDays: 5, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Backup offer active without sale conditions.', status: 'In Progress', estimatedDuration: '5 Days' },
      { id: 're-1-3', title: 'Subject Sale Finalized', dueInDays: 30, reminderFrequency: 'Weekly', channels: ['Email', 'WhatsApp'], messageTemplate: 'Condition met. Ready to proceed.', status: 'Pending', estimatedDuration: '30 Days' }
    ]
  },
  {
    id: 'tmpl-re-bond',
    name: '2. Bond & Registration Progress Tracker',
    industry: 'real-estate',
    description: 'Real-time client-facing dashboard that auto-updates from attorney/bank inputs.',
    metadata: {
      currentStatusSummary: 'Ready to lodge, awaiting subject sale transactions',
      nextAction: 'Receive OFT from agent after new purchaser finance approval',
      bondDetails: { type: 'First Bond', debtsCheck: 'Applicable', initiationFeeStatus: 'Paid by Bond' },
      outstandingItems: [
        { id: 'oi-1', item: 'OFT from Buyer', status: 'Pending', expectedDate: '2026-05-25', condition: 'To be sent once finance approved', assignedTo: 'Agent' },
        { id: 'oi-2', item: 'Bond Costs Payment', status: 'Pending', expectedDate: null, assignedTo: 'Transferring Attorney' }
      ],
      automationTriggers: [
        { trigger: 'step = "Costs Paid" AND completed = false AND days > 7', action: 'Escalate to bond originator' }
      ]
    },
    milestones: [
      { id: 're-2-1', title: 'Instruction received', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Instruction loaded.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 're-2-2', title: 'Documents Signed', dueInDays: 7, reminderFrequency: 'Weekly', channels: ['WhatsApp'], messageTemplate: 'Signatures collected.', status: 'Completed', estimatedDuration: '7 Days' },
      { id: 're-2-3', title: 'Costs Paid', dueInDays: 14, reminderFrequency: 'Weekly', channels: ['Email', 'SMS'], messageTemplate: 'Please pay your bond costs to proceed.', status: 'Pending', estimatedDuration: '7 Days' },
      { id: 're-2-4', title: 'Lodged at Deeds Office', dueInDays: 25, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Documents lodged.', status: 'Pending', estimatedDuration: '10 Days' },
      { id: 're-2-5', title: 'Registered', dueInDays: 35, reminderFrequency: 'On Event', channels: ['WhatsApp'], messageTemplate: 'Congratulations, property registered!', status: 'Pending', estimatedDuration: '10 Days' }
    ]
  },
  {
    id: 'tmpl-re-delay',
    name: '3. Delays & Exception Log',
    industry: 'real-estate',
    description: 'Centralize delay reasons and auto-assign resolution tasks to the right party.',
    metadata: {
      delayReason: 'Awaiting OFT from Agent',
      delayAssignee: 'Agent',
      automationTriggers: [
        { trigger: 'delay > 3 days', action: 'Escalation path to manager' }
      ]
    },
    milestones: [
      { id: 're-3-1', title: 'Delay Logged', dueInDays: 1, reminderFrequency: 'Daily', channels: ['Email'], messageTemplate: 'A delay has been logged: {delayReason}', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 're-3-2', title: 'Resolution Follow-up 1', dueInDays: 3, reminderFrequency: 'Daily', channels: ['Email', 'WhatsApp'], messageTemplate: 'We are still waiting on {delayAssignee} for {delayReason}.', status: 'In Progress', estimatedDuration: '2 Days' },
      { id: 're-3-3', title: 'Delay Resolved', dueInDays: 5, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Delay resolved. Back on track.', status: 'Pending', estimatedDuration: '1 Day' }
    ]
  },
  {
    id: 'tmpl-re-docs',
    name: '4. Document & Condition Request Funnel',
    industry: 'real-estate',
    description: 'Track outstanding documents with automated chasing and receipt logging.',
    metadata: {
      outstandingItems: [
        { id: 'doc-1', item: 'FICA Documents', status: 'Requested', assignedTo: 'Client' },
        { id: 'doc-2', item: 'Proof of Sale', status: 'Pending', assignedTo: 'Agent' }
      ],
      automationTriggers: [
        { trigger: 'status = Requested AND time > 48h', action: 'Auto-email reminder' }
      ]
    },
    milestones: [
      { id: 're-4-1', title: 'Requests Sent', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Please submit your required documents.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 're-4-2', title: 'Documents Pending', dueInDays: 3, reminderFrequency: 'Daily', channels: ['WhatsApp'], messageTemplate: 'Reminder: we still need {outstandingItems}.', status: 'In Progress', estimatedDuration: '2 Days' },
      { id: 're-4-3', title: 'Verified', dueInDays: 5, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'All documents received and verified.', status: 'Pending', estimatedDuration: '2 Days' }
    ]
  },
  {
    id: 'tmpl-re-summary',
    name: '5. Client Communication Summary (Non-Legal)',
    industry: 'real-estate',
    description: 'Plain-English "What\'s happening?" update for buyers/sellers.',
    metadata: {
      currentStatusSummary: 'Waiting for the buyer of your buyer’s home to get bond approval',
      nextAction: 'You don’t need to do anything – we’ll update you by 25 May'
    },
    milestones: [
      { id: 're-5-1', title: 'Getting Started', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Welcome! We are getting your file ready.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 're-5-2', title: 'Working in the Background', dueInDays: 15, reminderFrequency: 'Weekly', channels: ['WhatsApp'], messageTemplate: 'We are currently: {currentStatusSummary}. {nextAction}.', status: 'In Progress', estimatedDuration: '14 Days' },
      { id: 're-5-3', title: 'Finalizing', dueInDays: 30, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'All clear! We are wrapping up.', status: 'Pending', estimatedDuration: '5 Days' }
    ]
  }
];



export const DUMMY_CLIENT: Client = {
  id: 'dummy-client-1',
  name: 'John Doe (Demo)',
  email: 'john@example.com',
  phone: '082 555 1234',
  company: 'Demo Company',
  reference: 'DEMO-1001',
  industry: 'real-estate',
  status: 'active',
  dateOfBirth: '1990-06-15',
  anniversaryDate: '2020-12-05'
};

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-john-sarah',
    name: 'John & Sarah Smith',
    email: 'smith.js90@gmail.com',
    phone: '+27 82 555 1234',
    reference: 'ERF 1245 Bryanston Manor (Transfer)',
    industry: 'real-estate',
    status: 'active',
    dateOfBirth: '1985-08-22',
    anniversaryDate: '2015-03-10'
  }
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-re-1',
    clientId: 'cli-john-sarah',
    templateId: 'tmpl-re-bond',
    status: 'Active',
    startedAt: '2026-05-10T14:30:00Z',
    milestones: [
      {
        id: 'asg-re-1-m1',
        title: 'Offer to Purchase (OTP) Accepted',
        dueInDays: 3,
        reminderFrequency: 'On Event',
        channels: ['Email', 'WhatsApp'],
        messageTemplate: 'Congratulations! Your Offer to Purchase for {reference} has been signed and accepted by all parties. Let us proceed to the next steps of your ownership journey.',
        status: 'Completed',
        completedAt: '2026-05-12T10:15:00Z',
        estimatedDuration: '1-3 Days'
      },
      {
        id: 'asg-re-1-m2',
        title: 'Bond Application Submitted',
        dueInDays: 10,
        reminderFrequency: 'Weekly',
        channels: ['Email', 'SMS'],
        messageTemplate: 'Hi {name}, we have submitted your home loan applications to all major South African banks (ABSA, FNB, Nedbank, Standard Bk). We will keep you updated as bank feedback arrives.',
        status: 'Completed',
        completedAt: '2026-05-20T09:00:00Z',
        estimatedDuration: '5-10 Days'
      },
      {
        id: 'asg-re-1-m3',
        title: 'Bond Approval Obtained',
        dueInDays: 14,
        reminderFrequency: 'On Event',
        channels: ['Email', 'WhatsApp', 'SMS'],
        messageTemplate: 'Fantastic news, {name}! Your home loan application has been officially APPROVED. We are waiting on copy of the quote to proceed with transferring attorney instructions.',
        status: 'In Progress',
        updatedAt: '2026-06-02T13:00:00Z',
        estimatedDuration: '7-14 Days'
      },
      {
        id: 'asg-re-1-m4',
        title: 'Transfer & Bond Documents Drafted',
        dueInDays: 20,
        reminderFrequency: 'Weekly',
        channels: ['Email'],
        messageTemplate: 'Hi {name}, the transferring attorneys have drafted the documentation for your purchase. We will set up a meeting for you to sign these documents shortly.',
        status: 'Pending',
        estimatedDuration: '10-14 Days'
      },
      {
        id: 'asg-re-1-m5',
        title: 'Deeds Office Lodgement',
        dueInDays: 45,
        reminderFrequency: 'Weekly',
        channels: ['SMS', 'WhatsApp'],
        messageTemplate: 'Update on {reference}: Your transfer and bond documents have been formally lodged at the Deeds Office. Examination usually takes 10 to 15 working days.',
        status: 'Pending',
        estimatedDuration: '10-15 Days'
      },
      {
        id: 'asg-re-1-m6',
        title: 'Deeds Registration Complete',
        dueInDays: 60,
        reminderFrequency: 'On Event',
        channels: ['Email', 'WhatsApp', 'SMS'],
        messageTemplate: 'WELCOME HOME! Registration is complete at the Deeds Office. You are now officially the registered owner of {reference}. We will contact you for key collection arrangements.',
        status: 'Pending',
        estimatedDuration: '1 Day'
      }
    ]
  }
];

export const INITIAL_LOGS: CommunicationLog[] = [
  {
    id: 'log-1',
    clientId: 'cli-john-sarah',
    clientName: 'John & Sarah Smith',
    milestoneTitle: 'Offer to Purchase (OTP) Accepted',
    channel: 'Email',
    message: 'To: smith.js90@gmail.com - Congratulations! Your Offer to Purchase for ERF 1245 Bryanston Manor (Transfer) has been signed and accepted by all parties. Let us proceed to the next steps of your ownership journey.',
    timestamp: '2026-05-12T10:15:00Z',
    status: 'Delivered'
  },
  {
    id: 'log-2',
    clientId: 'cli-john-sarah',
    clientName: 'John & Sarah Smith',
    milestoneTitle: 'Offer to Purchase (OTP) Accepted',
    channel: 'WhatsApp',
    message: 'WhatsApp: +27 82 555 1234 - Congratulations! Your Offer to Purchase for ERF 1245 Bryanston Manor (Transfer) has been signed and accepted by all parties.',
    timestamp: '2026-05-12T10:15:30Z',
    status: 'Delivered'
  },
  {
    id: 'log-3',
    clientId: 'cli-john-sarah',
    clientName: 'John & Sarah Smith',
    milestoneTitle: 'Bond Application Submitted',
    channel: 'Email',
    message: 'To: smith.js90@gmail.com - Hi John & Sarah Smith, we have submitted your home loan applications to all major South African banks (ABSA, FNB, Nedbank, Standard Bk). We will keep you updated as bank feedback arrives.',
    timestamp: '2026-05-20T09:00:00Z',
    status: 'Delivered'
  }
];

export const INDUSTRY_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  'real-estate': {
    label: 'Real Estate / Conveyancing',
    icon: 'Home',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200'
  }
};
