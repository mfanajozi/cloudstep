import { Template, Client, Assignment, CommunicationLog } from './types';

export const INITIAL_TEMPLATES: Template[] = [
  // --- REAL ESTATE TEMPLATES (5) ---
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
  },

  // --- LEGAL TEMPLATES (3) ---
  {
    id: 'tmpl-leg-1',
    name: 'High Court Commercial Litigation',
    industry: 'legal',
    description: 'Automates updates for corporate legal cases, managing pleadings exchange.',
    metadata: {
      outstandingItems: [{ id: 'l-1', item: 'Discovery Affidavit', status: 'Requested', assignedTo: 'Client' }],
      currentStatusSummary: 'Awaiting Discovery Index from Defendant'
    },
    milestones: [
      { id: 'leg-1', title: 'Brief Received', dueInDays: 2, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Brief assigned. Reference: {reference}.', status: 'Completed', estimatedDuration: '2 Days' },
      { id: 'leg-2', title: 'Letter of Demand Issued', dueInDays: 14, reminderFrequency: 'Weekly', channels: ['Email', 'SMS'], messageTemplate: 'Letter of Demand served.', status: 'Completed', estimatedDuration: '10 Days' },
      { id: 'leg-3', title: 'Discovery & Indexing', dueInDays: 30, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Preparing discovery index. Upload outstanding items.', status: 'In Progress', estimatedDuration: '20 Days' }
    ]
  },
  {
    id: 'tmpl-leg-2',
    name: 'Debt Collection Workflow',
    industry: 'legal',
    description: 'Track Section 129 notices and summons progression.',
    metadata: { currentStatusSummary: 'Summons out for service with Sheriff' },
    milestones: [
      { id: 'l2-1', title: 'S129 Notice Sent', dueInDays: 3, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Section 129 sent via registered mail.', status: 'Completed', estimatedDuration: '3 Days' },
      { id: 'l2-2', title: 'Summons Issued', dueInDays: 15, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Summons issued at court.', status: 'In Progress', estimatedDuration: '12 Days' }
    ]
  },
  {
    id: 'tmpl-leg-3',
    name: 'Divorce Settlement Tracking',
    industry: 'legal',
    description: 'Family law tracking for settlement agreements and court dates.',
    milestones: [
      { id: 'l3-1', title: 'Draft Settlement', dueInDays: 10, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Drafting agreement.', status: 'In Progress', estimatedDuration: '10 Days' },
      { id: 'l3-2', title: 'Court Date Allocated', dueInDays: 40, reminderFrequency: 'On Event', channels: ['Email', 'WhatsApp'], messageTemplate: 'Uncontested roll date received.', status: 'Pending', estimatedDuration: '30 Days' }
    ]
  },

  // --- FINANCIAL TEMPLATES (3) ---
  {
    id: 'tmpl-fin-1',
    name: 'Wealth Strategy & Investment',
    industry: 'financial',
    description: 'Standardizes FICA compliance and wealth advice planning.',
    metadata: { outstandingItems: [{ id: 'f-1', item: 'Proof of Address', status: 'Pending', assignedTo: 'Client' }] },
    milestones: [
      { id: 'fin-1', title: 'Initial Advice', dueInDays: 2, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Consultation scheduled.', status: 'Completed', estimatedDuration: '2 Days' },
      { id: 'fin-2', title: 'FICA Audit', dueInDays: 5, reminderFrequency: 'Daily', channels: ['Email', 'WhatsApp'], messageTemplate: 'Upload missing FICA items.', status: 'In Progress', estimatedDuration: '3 Days' },
      { id: 'fin-3', title: 'Fund Activation', dueInDays: 14, reminderFrequency: 'On Event', channels: ['Email', 'SMS'], messageTemplate: 'Funds activated.', status: 'Pending', estimatedDuration: '10 Days' }
    ]
  },
  {
    id: 'tmpl-fin-2',
    name: 'Life Insurance Application',
    industry: 'financial',
    description: 'Track underwriting and medical requirements.',
    metadata: { currentStatusSummary: 'Awaiting blood test results from pathology' },
    milestones: [
      { id: 'f2-1', title: 'Quote Accepted', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Quote signed.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 'f2-2', title: 'Medical Underwriting', dueInDays: 10, reminderFrequency: 'Weekly', channels: ['WhatsApp'], messageTemplate: 'Please complete nurse visit.', status: 'In Progress', estimatedDuration: '10 Days' }
    ]
  },
  {
    id: 'tmpl-fin-3',
    name: 'Estate Planning & Wills',
    industry: 'financial',
    description: 'Drafting and signing of last will and testament.',
    milestones: [
      { id: 'f3-1', title: 'Drafting Will', dueInDays: 7, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Drafting in progress.', status: 'In Progress', estimatedDuration: '7 Days' },
      { id: 'f3-2', title: 'Signatures', dueInDays: 14, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Will ready for signature.', status: 'Pending', estimatedDuration: '7 Days' }
    ]
  },

  // --- AUTOMOTIVE TEMPLATES (3) ---
  {
    id: 'tmpl-auto-1',
    name: 'Vehicle Finance & Delivery',
    industry: 'automotive',
    description: 'Speeds up the hand-over experience, tracking bank approvals and licenses.',
    metadata: { currentStatusSummary: 'Approved, awaiting trade-in evaluation' },
    milestones: [
      { id: 'auto-1', title: 'OTP Signed', dueInDays: 1, reminderFrequency: 'On Event', channels: ['WhatsApp'], messageTemplate: 'OTP signed.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 'auto-2', title: 'Finance Lodged', dueInDays: 3, reminderFrequency: 'Daily', channels: ['Email'], messageTemplate: 'Bank feedback expected soon.', status: 'Completed', estimatedDuration: '2 Days' },
      { id: 'auto-3', title: 'Approval & Licensing', dueInDays: 8, reminderFrequency: 'Daily', channels: ['WhatsApp'], messageTemplate: 'Approved. Running licensing and PDI.', status: 'In Progress', estimatedDuration: '5 Days' }
    ]
  },
  {
    id: 'tmpl-auto-2',
    name: 'Major Service & Repair',
    industry: 'automotive',
    description: 'Workshop tracking for parts and labour.',
    metadata: { delayReason: 'Waiting for parts from Germany' },
    milestones: [
      { id: 'a2-1', title: 'Vehicle Booked In', dueInDays: 1, reminderFrequency: 'On Event', channels: ['SMS'], messageTemplate: 'Vehicle received.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 'a2-2', title: 'Awaiting Parts', dueInDays: 5, reminderFrequency: 'Daily', channels: ['WhatsApp'], messageTemplate: 'Parts ordered.', status: 'In Progress', estimatedDuration: '4 Days' }
    ]
  },
  {
    id: 'tmpl-auto-3',
    name: 'Trade-In Evaluation',
    industry: 'automotive',
    description: 'Evaluation and settlement of previous vehicle.',
    milestones: [
      { id: 'a3-1', title: 'Evaluation Done', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Evaluation complete.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 'a3-2', title: 'Bank Settlement', dueInDays: 3, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Settling previous finance.', status: 'In Progress', estimatedDuration: '2 Days' }
    ]
  },

  // --- CONSTRUCTION TEMPLATES (3) ---
  {
    id: 'tmpl-con-1',
    name: 'Residential Extension Build',
    industry: 'construction',
    description: 'Ensures construction milestones are communicated without jargon.',
    metadata: { currentStatusSummary: 'Curing foundation slab, brickwork starts Monday' },
    milestones: [
      { id: 'con-1', title: 'Plans Approved', dueInDays: 10, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Municipal plans approved.', status: 'Completed', estimatedDuration: '10 Days' },
      { id: 'con-2', title: 'Foundation Cast', dueInDays: 20, reminderFrequency: 'On Event', channels: ['WhatsApp'], messageTemplate: 'Slab poured.', status: 'Completed', estimatedDuration: '10 Days' },
      { id: 'con-3', title: 'Brickwork', dueInDays: 45, reminderFrequency: 'Weekly', channels: ['WhatsApp'], messageTemplate: 'Wallplate reached.', status: 'In Progress', estimatedDuration: '25 Days' }
    ]
  },
  {
    id: 'tmpl-con-2',
    name: 'Commercial Fit-Out',
    industry: 'construction',
    description: 'Office drywalling, electrical, and HVAC installation.',
    metadata: { outstandingItems: [{ id: 'c2-1', item: 'HVAC Spec Signoff', status: 'Requested', assignedTo: 'Client' }] },
    milestones: [
      { id: 'c2-1', title: 'Site Handover', dueInDays: 1, reminderFrequency: 'On Event', channels: ['Email'], messageTemplate: 'Site keys received.', status: 'Completed', estimatedDuration: '1 Day' },
      { id: 'c2-2', title: 'First Fix (Elec/Plumb)', dueInDays: 14, reminderFrequency: 'Weekly', channels: ['Email'], messageTemplate: 'Wiring in progress.', status: 'In Progress', estimatedDuration: '14 Days' }
    ]
  },
  {
    id: 'tmpl-con-3',
    name: 'Solar & Backup Installation',
    industry: 'construction',
    description: 'Inverter/battery fitting and CoC issuance.',
    milestones: [
      { id: 'c3-1', title: 'Hardware Delivery', dueInDays: 3, reminderFrequency: 'On Event', channels: ['SMS'], messageTemplate: 'Panels delivered.', status: 'Completed', estimatedDuration: '3 Days' },
      { id: 'c3-2', title: 'Installation & CoC', dueInDays: 7, reminderFrequency: 'Daily', channels: ['WhatsApp'], messageTemplate: 'System live, issuing Certificate of Compliance.', status: 'In Progress', estimatedDuration: '4 Days' }
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
  },
  {
    id: 'cli-david-jacobs',
    name: 'David Jacobs',
    email: 'david@apexholdings.co.za',
    phone: '+27 73 444 8822',
    company: 'Apex Corporate Holdings',
    reference: 'Commercial Claim vs Apex Holdings',
    industry: 'legal',
    status: 'active',
    dateOfBirth: '1978-11-04',
    anniversaryDate: null
  },
  {
    id: 'cli-emily-moore',
    name: 'Emily Moore',
    email: 'e.moore@mweb.co.za',
    phone: '+27 81 999 5011',
    reference: 'Preservation Pension Restructure',
    industry: 'financial',
    status: 'active',
    dateOfBirth: '1992-02-18',
    anniversaryDate: null
  },
  {
    id: 'cli-thembeka-dlamini',
    name: 'Thembeka Dlamini',
    email: 'thembeka.d@live.co.za',
    phone: '+27 79 321 4455',
    reference: 'Kloof Road Deck & Extension',
    industry: 'construction',
    status: 'active',
    dateOfBirth: '1988-09-30',
    anniversaryDate: '2017-06-12'
  },
  {
    id: 'cli-sipho-nkosi',
    name: 'Sipho Nkosi',
    email: 'sipho.nkosi@outlook.com',
    phone: '+27 83 456 7890',
    reference: 'BMW 320d M Sport - CK 82 YT GP',
    industry: 'automotive',
    status: 'active',
    dateOfBirth: '1995-05-25',
    anniversaryDate: null
  }
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-re-1',
    clientId: 'cli-john-sarah',
    templateId: 'tmpl-real-estate',
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
  },
  {
    id: 'asg-leg-1',
    clientId: 'cli-david-jacobs',
    templateId: 'tmpl-legal',
    status: 'Active',
    startedAt: '2026-05-15T08:00:00Z',
    milestones: [
      {
        id: 'asg-leg-1-m1',
        title: 'Brief Received & Team Appointed',
        dueInDays: 2,
        reminderFrequency: 'On Event',
        channels: ['Email'],
        messageTemplate: 'Dear Counsel at {company}, we have received your direct brief. Advocate and associate team have been assigned to review pleadings. Case Reference: {reference}.',
        status: 'Completed',
        completedAt: '2026-05-16T15:40:00Z',
        estimatedDuration: '2 Days'
      },
      {
        id: 'asg-leg-1-m2',
        title: 'Letter of Demand and Pleadings Issued',
        dueInDays: 14,
        reminderFrequency: 'Weekly',
        channels: ['Email', 'SMS'],
        messageTemplate: 'Case Update: The Letter of Demand has been formally drafted and served on the defendants. They have 10 business days to log a Notice of Intention to Defend.',
        status: 'Completed',
        completedAt: '2026-06-01T11:20:00Z',
        estimatedDuration: '5-14 Days'
      },
      {
        id: 'asg-leg-1-m3',
        title: 'Discovery & Document Indexing',
        dueInDays: 30,
        reminderFrequency: 'Weekly',
        channels: ['Email'],
        messageTemplate: 'Hi {name}, we are preparing the discovery index. Please ensure all related correspondence, contracts, bank items, and POPIA declarations are signed and uploaded.',
        status: 'In Progress',
        updatedAt: '2026-06-03T16:00:00Z',
        estimatedDuration: '2-4 Weeks'
      },
      {
        id: 'asg-leg-1-m4',
        title: 'Pre-Trial Conference Structured',
        dueInDays: 60,
        reminderFrequency: 'Weekly',
        channels: ['Email', 'WhatsApp'],
        messageTemplate: 'Reference: {reference}. A Pre-Trial conference with the opposing counsels has been booked. This is to narrow down issues before moving for a specific trial trial date allocution.',
        status: 'Pending',
        estimatedDuration: '3-4 Weeks'
      },
      {
        id: 'asg-leg-1-m5',
        title: 'Court Date Hearing Set',
        dueInDays: 90,
        reminderFrequency: 'On Event',
        channels: ['Email', 'SMS'],
        messageTemplate: 'Mr/Ms {name}, we have received our trial allocation. Court Hearing set down for {reference} represents a formal court setting. Preparation sessions will follow.',
        status: 'Pending',
        estimatedDuration: '1-3 Months'
      }
    ]
  },
  {
    id: 'asg-auto-1',
    clientId: 'cli-sipho-nkosi',
    templateId: 'tmpl-automotive',
    status: 'Active',
    startedAt: '2026-06-01T10:00:00Z',
    milestones: [
      {
        id: 'asg-auto-1-m1',
        title: 'Offer to Purchase Signed',
        dueInDays: 1,
        reminderFrequency: 'On Event',
        channels: ['WhatsApp', 'SMS'],
        messageTemplate: 'Hi {name}, OTP signed for the {reference}! Let\'s get your finance arrangements submitted instantly.',
        status: 'Completed',
        completedAt: '2026-06-01T16:30:00Z',
        estimatedDuration: '1 Day'
      },
      {
        id: 'asg-auto-1-m2',
        title: 'Bank Finance Applications Lodged',
        dueInDays: 3,
        reminderFrequency: 'Daily',
        channels: ['Email', 'SMS'],
        messageTemplate: 'Hello {name}, your finance application for the purchase has been submitted to major South African vehicle finance houses. We expect bank feedback soon.',
        status: 'Completed',
        completedAt: '2026-06-03T11:00:00Z',
        estimatedDuration: '1-3 Days'
      },
      {
        id: 'asg-auto-1-m3',
        title: 'Finance Approval & Deposit Settled',
        dueInDays: 5,
        reminderFrequency: 'Daily',
        channels: ['WhatsApp', 'SMS'],
        messageTemplate: 'Excellent! Your vehicle finance has been APPROVED. Please send through the proof of deposit / trade-in documents to initiate our licensing procedures.',
        status: 'In Progress',
        updatedAt: '2026-06-04T08:00:00Z',
        estimatedDuration: '2 Days'
      },
      {
        id: 'asg-auto-1-m4',
        title: 'Licensing, Plates & Roadworthy',
        dueInDays: 8,
        reminderFrequency: 'On Event',
        channels: ['Email'],
        messageTemplate: 'Hi {name}, we are licensing your vehicle. Standard licensing and number plate registration is in progress. We are also running the 101-point workshop safety check.',
        status: 'Pending',
        estimatedDuration: '2-3 Days'
      },
      {
        id: 'asg-auto-1-m5',
        title: 'Delivery Handover Setup',
        dueInDays: 10,
        reminderFrequency: 'On Event',
        channels: ['Email', 'WhatsApp', 'SMS'],
        messageTemplate: 'Your {reference} is detailed, polished, and ready under our red ribbon! Sipho is ready to capture your handover. Let\'s book your delivery celebration slot.',
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
  },
  {
    id: 'log-4',
    clientId: 'cli-david-jacobs',
    clientName: 'David Jacobs',
    milestoneTitle: 'Brief Received & Team Appointed',
    channel: 'Email',
    message: 'To: david@apexholdings.co.za - Dear Counsel at Apex Corporate Holdings, we have received your direct brief. Advocate and associate team have been assigned to review pleadings. Case Reference: Commercial Claim vs Apex Holdings.',
    timestamp: '2026-05-16T15:40:00Z',
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
  },
  'legal': {
    label: 'Law Firms / Litigation',
    icon: 'Scale',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  },
  'financial': {
    label: 'Financial Advisory',
    icon: 'TrendingUp',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  'automotive': {
    label: 'Automotive Dealerships',
    icon: 'Car',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200'
  },
  'construction': {
    label: 'Construction & Renovation',
    icon: 'Hammer',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200'
  }
};
