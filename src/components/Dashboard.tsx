import React, { useState } from 'react';
import { 
  Users, Plus, Search, Home, Scale, TrendingUp, Car, Hammer, 
  ChevronRight, CheckCircle2, Clock, Mail, MessageSquare, Phone, 
  AlertCircle, ShieldCheck, HeartPulse, Send, Check, Archive, ArchiveRestore,
  Copy, Link2
} from 'lucide-react';
import { Client, Template, Assignment, CommunicationLog, Industry } from '../types';
import { INDUSTRY_META } from '../data';
import { CloudStepHandlers } from '../lib/handlers';

interface DashboardProps {
  clients: Client[];
  templates: Template[];
  assignments: Assignment[];
  logs: CommunicationLog[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  setLogs: React.Dispatch<React.SetStateAction<CommunicationLog[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  selectedAssignmentId: string | null;
  setSelectedAssignmentId: (id: string | null) => void;
  handlers: CloudStepHandlers;
}

export default function Dashboard({
  clients,
  templates,
  assignments,
  logs,
  setAssignments,
  setLogs,
  setClients,
  selectedAssignmentId,
  setSelectedAssignmentId,
  handlers,
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientReference, setNewClientReference] = useState('');
  const [newClientIndustry, setNewClientIndustry] = useState<Industry>('real-estate');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientDOB, setNewClientDOB] = useState('');
  const [newClientAnniversary, setNewClientAnniversary] = useState('');

  const [assignClientId, setAssignClientId] = useState('');
  const [assignTemplateId, setAssignTemplateId] = useState('');

  const [notificationToast, setNotificationToast] = useState<{
    show: boolean;
    channels: string[];
    recipient: string;
    message: string;
    title: string;
  } | null>(null);

  const [inviteToast, setInviteToast] = useState<{
    show: boolean;
    client: Client | null;
  } | null>(null);

  const [archiveConfirm, setArchiveConfirm] = useState<{
    show: boolean;
    client: Client | null;
    action: 'archive' | 'restore';
  } | null>(null);

  const activeAssignment = assignments.find(a => a.id === selectedAssignmentId) || assignments[0];

  React.useEffect(() => {
    if (!selectedAssignmentId && assignments.length > 0) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId, setSelectedAssignmentId]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientEmail || !newClientPhone || !newClientReference) {
      alert('Please fill in all mandatory fields');
      return;
    }

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      name: newClientName,
      email: newClientEmail,
      phone: newClientPhone.startsWith('+27') ? newClientPhone : `+27 ${newClientPhone.replace(/^0/, '')}`,
      reference: newClientReference,
      industry: newClientIndustry,
      company: newClientCompany || undefined,
      status: 'active',
      clerkUserId: null,
      dateOfBirth: newClientDOB || null,
      anniversaryDate: newClientAnniversary || null
    };

    try {
      const saved = await handlers.createClient(newClient);
      setAssignClientId(saved.id);
      
      const matchingTemplate = templates.find(t => t.industry === newClientIndustry);
      if (matchingTemplate) {
        setAssignTemplateId(matchingTemplate.id);
      }

      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientReference('');
      setNewClientCompany('');
      setNewClientDOB('');
      setNewClientAnniversary('');

      setIsNewClientModalOpen(false);
      setInviteToast({ show: true, client: saved });
      handlers.pushToast({ kind: 'success', title: 'Client saved', body: `${saved.name} added to your workspace.` });
    } catch (e: any) {
      console.error('createClient failed:', e);
      handlers.pushToast({ kind: 'error', title: 'Could not save client', body: e?.message ?? 'Unknown error' });
    }
  };

  const confirmArchive = (client: Client, action: 'archive' | 'restore') => {
    setArchiveConfirm({ show: true, client, action });
  };

  const performArchiveAction = async () => {
    if (!archiveConfirm?.client) return;
    const { client, action } = archiveConfirm;
    setArchiveConfirm(null);
    try {
      if (action === 'archive') {
        await handlers.archiveClient(client.id);
        handlers.pushToast({ kind: 'info', title: 'Client archived', body: `${client.name} is hidden from active pipelines.` });
      } else {
        await handlers.restoreClient(client.id);
        handlers.pushToast({ kind: 'success', title: 'Client restored', body: `${client.name} is back in active pipelines.` });
      }
    } catch (e: any) {
      handlers.pushToast({ kind: 'error', title: `Could not ${action} client`, body: e?.message ?? 'Unknown error' });
    }
  };

  const handleAssignTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClientId || !assignTemplateId) {
      alert('Please select both a client and a journey template');
      return;
    }

    const selectedClient = clients.find(c => c.id === assignClientId);
    const selectedTemplate = templates.find(t => t.id === assignTemplateId);

    if (!selectedClient || !selectedTemplate) return;

    const clonedMilestones = selectedTemplate.milestones.map((m, idx) => ({
      ...m,
      id: `asg-${Date.now()}-m${idx}`,
      status: (idx === 0 ? 'In Progress' : 'Pending') as 'Pending' | 'In Progress' | 'Completed',
    }));

    const newAssignment: Assignment = {
      id: `asg-${Date.now()}`,
      clientId: assignClientId,
      templateId: assignTemplateId,
      status: 'Active',
      startedAt: new Date().toISOString(),
      milestones: clonedMilestones
    };

    const firstMilestone = clonedMilestones[0];
    const newLog: CommunicationLog = {
      id: `log-${Date.now()}`,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      milestoneTitle: firstMilestone.title,
      channel: 'Email',
      message: `Started client journey: ${selectedTemplate.name}. Initial stage [${firstMilestone.title}] is active.`,
      timestamp: new Date().toISOString(),
      status: 'Delivered'
    };

    try {
      const saved = await handlers.createAssignment(newAssignment, newLog);
      setSelectedAssignmentId(saved.id);
      setIsAssignModalOpen(false);
      handlers.pushToast({ kind: 'success', title: 'Journey started', body: `${selectedClient.name} is now on ${selectedTemplate.name}.` });
      
      setNotificationToast({
        show: true,
        channels: ['Email'],
        recipient: selectedClient.email,
        title: firstMilestone.title,
        message: firstMilestone.messageTemplate
          .replace('{name}', selectedClient.name)
          .replace('{reference}', selectedClient.reference)
          .replace('{company}', selectedClient.company || '')
      });
    } catch (e: any) {
      handlers.pushToast({ kind: 'error', title: 'Could not start journey', body: e?.message ?? 'Unknown error' });
    }
  };

  const handleToggleMilestone = async (assignmentId: string, milestoneId: string, currentStatus: 'Pending' | 'In Progress' | 'Completed') => {
    const nextStatusMap: Record<string, 'Pending' | 'In Progress' | 'Completed'> = {
      'Pending': 'In Progress',
      'In Progress': 'Completed',
      'Completed': 'Pending'
    };
    const nextStatus = nextStatusMap[currentStatus];

    const parentAsg = assignments.find(a => a.id === assignmentId);
    if (!parentAsg) return;
    const milestone = parentAsg.milestones.find(m => m.id === milestoneId);
    const client = clients.find(c => c.id === parentAsg.clientId);

    const updatedMilestones = parentAsg.milestones.map(m => {
      if (m.id !== milestoneId) return m;
      return {
        ...m,
        status: nextStatus,
        completedAt: nextStatus === 'Completed' ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString()
      };
    });

    const allCompleted = updatedMilestones.every(m => m.status === 'Completed');
    const newStatus: 'Active' | 'Completed' = allCompleted ? 'Completed' : 'Active';

    // Optimistic local update
    setAssignments(prev => prev.map(asg =>
      asg.id === assignmentId ? { ...asg, milestones: updatedMilestones, status: newStatus } : asg
    ));

    let newLogs: CommunicationLog[] = [];
    if (nextStatus === 'Completed' && milestone && client) {
      const renderedMsg = milestone.messageTemplate
        .replace(/{name}/g, client.name)
        .replace(/{reference}/g, client.reference)
        .replace(/{company}/g, client.company || 'Business Solution');

      newLogs = milestone.channels.map((chan, i) => ({
        id: `log-${Date.now()}-${i}`,
        clientId: client.id,
        clientName: client.name,
        milestoneTitle: milestone.title,
        channel: chan,
        message: `${chan === 'Email' ? 'To: ' + client.email : chan + ': ' + client.phone} - ${renderedMsg}`,
        timestamp: new Date().toISOString(),
        status: 'Delivered'
      }));

      setLogs(prev => [...newLogs, ...prev]);

      setNotificationToast({
        show: true,
        channels: milestone.channels,
        recipient: client.name,
        title: milestone.title,
        message: renderedMsg
      });

      setTimeout(() => setNotificationToast(null), 6000);
    }

    try {
      await handlers.updateMilestoneStatus(assignmentId, updatedMilestones, newStatus, newLogs);
    } catch (e: any) {
      handlers.pushToast({ kind: 'error', title: 'Could not save milestone', body: e?.message ?? 'Unknown error' });
    }
  };

  const renderIndustryBadge = (industry: Industry) => {
    const meta = INDUSTRY_META[industry];
    if (!meta) return null;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color} border ${meta.border}`}>
        {meta.label}
      </span>
    );
  };

  const visibleClients = clients.filter(c => 
    showArchived ? c.status === 'archived' : c.status !== 'archived' && c.status !== 'deleted_by_user'
  );

  const filteredAssignments = assignments.filter(asg => {
    const client = visibleClients.find(c => c.id === asg.clientId);
    if (!client) return false;
    
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          client.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.phone.includes(searchTerm);
    
    const matchesIndustry = industryFilter === 'all' || client.industry === industryFilter;
    
    return matchesSearch && matchesIndustry;
  });

  const buildInviteLink = (email: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://www.cloudst.co.za';
    return `${base}/sign-up#/?email=${encodeURIComponent(email)}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Visual Feedback Toast for updates */}
      {notificationToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700/60 p-4 animate-bounce">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <p className="font-bold text-sm text-emerald-400">Automated Dispatch</p>
            </div>
            <button 
              onClick={() => setNotificationToast(null)} 
              className="text-slate-400 hover:text-white transition-colors text-xs px-1.5 py-0.5 border border-slate-700 hover:border-slate-500 rounded"
            >
              dismiss
            </button>
          </div>
          <p className="text-xs text-slate-300 font-semibold mb-1">
            Mailed/Sent to: <span className="text-white font-bold">{notificationToast.recipient}</span>
          </p>
          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700 max-h-36 overflow-y-auto">
            <p className="text-xs font-bold text-slate-200 mb-1">📢 {notificationToast.title}</p>
            <p className="text-[11px] text-slate-300 leading-relaxed italic">{`"${notificationToast.message}"`}</p>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400">
            <span className="font-medium">Triggered Channels: </span>
            {notificationToast.channels.map(chan => (
              <span key={chan} className="px-1.5 py-0.5 bg-slate-800 rounded font-bold text-slate-300 border border-slate-700">
                {chan}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Secure Self-Serve Invite Modal */}
      {inviteToast?.show && inviteToast.client && (
        <InviteLinkModal
          client={inviteToast.client}
          inviteLink={buildInviteLink(inviteToast.client.email)}
          onClose={() => setInviteToast(null)}
          onContinueAssigning={() => {
            setInviteToast(null);
            setIsAssignModalOpen(true);
          }}
        />
      )}

      {/* Archive / Restore Confirmation */}
      {archiveConfirm?.show && archiveConfirm.client && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-md flex items-center gap-2">
                {archiveConfirm.action === 'archive' ? (
                  <Archive className="w-5 h-5 text-amber-600" />
                ) : (
                  <ArchiveRestore className="w-5 h-5 text-emerald-600" />
                )}
                {archiveConfirm.action === 'archive' ? 'Archive Client' : 'Restore Client'}
              </h3>
              <button 
                onClick={() => setArchiveConfirm(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {archiveConfirm.action === 'archive' ? (
                  <>Are you sure you want to archive <strong>{archiveConfirm.client.name}</strong>? 
                  They will be hidden from the active pipelines but their data, milestones and history are preserved for POPIA records.</>
                ) : (
                  <>Restore <strong>{archiveConfirm.client.name}</strong> to the active pipelines?</>
                )}
              </p>

              <div className={`p-3 rounded-lg text-[11px] border ${
                archiveConfirm.action === 'archive' 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <p className="font-bold mb-0.5">{archiveConfirm.action === 'archive' ? '📦 Archived Clients:' : '✅ Restored:'}</p>
                <p>You can view and restore archived clients anytime via the "View Archived" toggle above the client list.</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setArchiveConfirm(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performArchiveAction}
                  className={`px-4 py-2 text-white rounded-lg text-xs font-semibold ${
                    archiveConfirm.action === 'archive'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {archiveConfirm.action === 'archive' ? 'Yes, Archive' : 'Yes, Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Client Sidebar Selection */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            {showArchived ? 'Archived Clients' : 'Client Pipelines'}
          </h3>
          <div className="flex gap-2">
            <button 
              id="btn-add-client"
              onClick={() => setIsNewClientModalOpen(true)}
              title="Add New Client Profile"
              className="p-1.5 text-blue-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              id="btn-assign-template"
              onClick={() => setIsAssignModalOpen(true)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm shadow-blue-100 flex items-center gap-1 cursor-pointer"
            >
              Assign Template
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search clients / references..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
            />
          </div>
          <select 
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-705 focus:outline-none"
          >
            <option value="all">All South African Industries</option>
            <option value="real-estate">Real Estate & Conveyancing</option>
            <option value="legal">Law Firms & Litigation</option>
            <option value="financial">Financial Advisories</option>
            <option value="automotive">Automotive Dealerships</option>
            <option value="construction">Construction & Improvements</option>
          </select>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              {showArchived ? `${clients.filter(c => c.status === 'archived').length} Archived` : `${visibleClients.length} Active`}
            </span>
            <button
              type="button"
              onClick={() => setShowArchived(v => !v)}
              className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-all ${
                showArchived
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              {showArchived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
              {showArchived ? 'View Active' : 'View Archived'}
            </button>
          </div>
        </div>

        {/* Client Assignments List */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredAssignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {showArchived 
                ? 'No archived clients. Click "View Active" to return.' 
                : 'No active client journeys matched. Click upper plus to register.'}
            </div>
          ) : (
            filteredAssignments.map((asg) => {
              const client = visibleClients.find(c => c.id === asg.clientId);
              if (!client) return null;

              const totalMilestones = asg.milestones.length;
              const completedMilestones = asg.milestones.filter(m => m.status === 'Completed').length;
              const percent = Math.round((completedMilestones / totalMilestones) * 100) || 0;
              const isSelected = asg.id === selectedAssignmentId;

              return (
                <div 
                  key={asg.id}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isSelected ? 'border-blue-600 bg-blue-50/20 shadow-xs' : 'border-slate-200 hover:border-slate-350 bg-white'
                  }`}
                >
                  <div 
                    onClick={() => setSelectedAssignmentId(asg.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-slate-800 line-clamp-1">{client.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        asg.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {percent}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono line-clamp-1 mb-2">Ref: {client.reference}</p>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full transition-all duration-300`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2.5 text-[9px] text-slate-400">
                      <span className="font-semibold text-slate-500 uppercase">{client.industry}</span>
                      <span className="flex items-center gap-1">
                        {completedMilestones}/{totalMilestones} steps 
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Archive/Restore action */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    {client.status === 'archived' ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); confirmArchive(client, 'restore'); }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-50"
                      >
                        <ArchiveRestore className="w-3 h-3" /> Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); confirmArchive(client, 'archive'); }}
                        className="text-[10px] font-bold text-slate-500 hover:text-amber-700 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-amber-50"
                      >
                        <Archive className="w-3 h-3" /> Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Active Pipeline Timeline Management */}
      <div className="lg:col-span-8 space-y-6">
        {activeAssignment ? (
          (() => {
            const activeClient = visibleClients.find(c => c.id === activeAssignment.clientId);
            const activeTemplate = templates.find(t => t.id === activeAssignment.templateId);
            
            if (!activeClient) {
              return (
                <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-slate-400 text-xs">
                  Selected client is archived. Restore them to view their active journey.
                </div>
              );
            }

            const totalMilestones = activeAssignment.milestones.length;
            const completedMilestones = activeAssignment.milestones.filter(m => m.status === 'Completed').length;
            const percentComplete = Math.round((completedMilestones / totalMilestones) * 100) || 0;

            return (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
                
                {/* Flow Title and Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h2 className="text-xl font-bold font-display text-slate-900">{activeClient.name}</h2>
                      {renderIndustryBadge(activeClient.industry)}
                      {activeClient.clerkUserId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Portal Linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          Awaiting Sign-Up
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-3">
                      <span>👤 Reference: <strong className="text-slate-800 font-mono">{activeClient.reference}</strong></span>
                      <span>📞 {activeClient.phone}</span>
                    </p>
                    {(activeClient.dateOfBirth || activeClient.anniversaryDate) && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                        {activeClient.dateOfBirth && <span>🎂 {new Date(activeClient.dateOfBirth).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>}
                        {activeClient.anniversaryDate && <span>💍 {new Date(activeClient.anniversaryDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Auto-Journey Progress</span>
                    <div className="flex items-center gap-2.5 justify-end mt-0.5">
                      <span className="text-2xl font-extrabold text-blue-600">{percentComplete}%</span>
                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">({completedMilestones}/{totalMilestones} steps)</span>
                    </div>
                  </div>
                </div>

                {/* ADVANCED METADATA TRACKING (AGENT VIEW) */}
                {activeAssignment.metadata && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-[10px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Delay / Exception Log</h4>
                      {activeAssignment.metadata.delayReason ? (
                        <div className="bg-white border border-red-200 p-3 rounded-lg flex items-start gap-3 shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1 animate-pulse" />
                          <div>
                            <p className="text-xs font-bold text-red-700">Delayed: {activeAssignment.metadata.delayReason}</p>
                            <p className="text-[10px] text-red-500 font-semibold mt-0.5">Assigned to: {activeAssignment.metadata.delayAssignee || 'Unassigned'}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-emerald-200 p-3 rounded-lg flex items-center gap-2 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-700">On Track - No active delays</span>
                        </div>
                      )}
                    </div>

                    <div>
                       <h4 className="font-bold text-[10px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Outstanding Conditions</h4>
                       {activeAssignment.metadata.outstandingItems && activeAssignment.metadata.outstandingItems.length > 0 ? (
                         <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                           {activeAssignment.metadata.outstandingItems.map(item => (
                             <div key={item.id} className="bg-white border border-slate-200 p-2 rounded-lg flex items-center justify-between shadow-sm">
                               <span className="text-xs font-semibold text-slate-700">{item.item}</span>
                               <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{item.status} - {item.assignedTo}</span>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="text-xs text-slate-400 italic bg-white border border-slate-200 p-3 rounded-lg text-center">No conditions logged.</div>
                       )}
                    </div>
                  </div>
                )}

                {/* Milestone settings & toggle triggers */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-5 font-display">
                    Interactive Milestones Progression Flow
                  </h4>

                  <div className="relative pl-8 space-y-6 before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-slate-200">
                    {activeAssignment.milestones.map((m, index) => {
                      const isCompleted = m.status === 'Completed';
                      const isInProgress = m.status === 'In Progress';
                      const isPending = m.status === 'Pending';

                      return (
                        <div key={m.id} className="relative group">
                          {/* Left dot representation */}
                          <button 
                            onClick={() => handleToggleMilestone(activeAssignment.id, m.id, m.status)}
                            className={`absolute -left-[27px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border transition-all z-10 cursor-pointer ${
                              isCompleted 
                                ? 'bg-blue-600 border-blue-650 text-white shadow-md shadow-blue-100' 
                                : isInProgress 
                                  ? 'bg-white border-2 border-blue-600 text-blue-600 font-bold text-[11px] ring-4 ring-blue-50' 
                                  : 'bg-white border-2 border-slate-200 text-slate-350 font-semibold text-[11px] hover:border-slate-400'
                            }`}
                            title={`Toggle from ${m.status}`}
                          >
                            {isCompleted ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <span className="text-[10px] font-extrabold">{index + 1}</span>
                            )}
                          </button>

                          <div className={`p-4.5 rounded-xl border transition-all ${
                            isCompleted 
                              ? 'bg-slate-50/70 border-slate-200' 
                              : isInProgress 
                                ? 'bg-blue-50/20 border-blue-200/80 shadow-xs' 
                                : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                              <div>
                                <h5 className={`text-sm font-bold ${
                                  isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
                                }`}>
                                  {m.title}
                                </h5>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                                  <span className="flex items-center gap-1 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Est: {m.estimatedDuration}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-medium">Freq: {m.reminderFrequency}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Toggle action badge representing current state */}
                                <button
                                  onClick={() => handleToggleMilestone(activeAssignment.id, m.id, m.status)}
                                  className={`text-xs px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                    isCompleted 
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100' 
                                      : isInProgress 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                >
                                  {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Pending'}
                                </button>
                              </div>
                            </div>

                            {/* Message script template info */}
                            <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-650 text-xs italic">
                              <p className="font-bold text-[9px] text-slate-400 uppercase tracking-widest not-italic mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
                                Live Notification Script
                              </p>
                              "{m.messageTemplate
                                .replace('{name}', activeClient.name)
                                .replace('{reference}', activeClient.reference)
                                .replace('{company}', activeClient.company || '')}"
                            </div>

                            {/* Configured South African communication pipeline channels */}
                            <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-slate-100">
                              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Channels:</span>
                              <div className="flex gap-1.5">
                                {m.channels.map(chan => (
                                  <span 
                                    key={chan} 
                                    className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                      chan === 'WhatsApp' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : chan === 'SMS' 
                                          ? 'bg-cyan-50 text-cyan-700 border border-cyan-250' 
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}
                                  >
                                    {chan === 'Email' && <Mail className="w-2.5 h-2.5" />}
                                    {chan === 'WhatsApp' && <MessageSquare className="w-2.5 h-2.5" />}
                                    {chan === 'SMS' && <Phone className="w-2.5 h-2.5" />}
                                    {chan}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated Business Contacts Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">POPIA Compliant Journey</p>
                      <p className="text-[11px] text-slate-500">
                        This client journey matches all South African Information Regulator guidelines. Secure local storage with zero cloud telemetry.
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2.5 py-1 rounded font-bold uppercase tracking-wider select-all border border-blue-105">
                    ID: c03be9ab
                  </div>
                </div>

              </div>
            );
          })()
        ) : (
          <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-slate-400 text-xs">
            Please register and select an active Client Journey.
          </div>
        )}
      </div>

      {/* MODAL: ADD CLIENT PROFILE */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-md">Register South African Client</h3>
              <button 
                onClick={() => setIsNewClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Client Name (individual/s) *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Sipho Nkosi" 
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Email Address *</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. sipho@outlook.com" 
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Phone Number (WhatsApp) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 082 123 4567" 
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Reference Detail / Subject *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. VW Polo Registration or ERF 103 Crawford" 
                  value={newClientReference}
                  onChange={(e) => setNewClientReference(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">South African Industry Sector</label>
                  <select 
                    value={newClientIndustry}
                    onChange={(e) => setNewClientIndustry(e.target.value as Industry)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  >
                    <option value="real-estate">Real Estate & Transfers</option>
                    <option value="legal">Law Firm & Litigation</option>
                    <option value="financial">Financial Advising</option>
                    <option value="automotive">Automotive Handover</option>
                    <option value="construction">Construction Renovations</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Company / Branch</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Apex Corp (optional)" 
                    value={newClientCompany}
                    onChange={(e) => setNewClientCompany(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">🎂 Date of Birth</label>
                  <input 
                    type="date" 
                    value={newClientDOB}
                    onChange={(e) => setNewClientDOB(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">💍 Anniversary Date</label>
                  <input 
                    type="date" 
                    value={newClientAnniversary}
                    onChange={(e) => setNewClientAnniversary(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save & Generate Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MAP TEMPLATE */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-md">Map Client to Active Template</h3>
              <button 
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Registered Client *</label>
                <select 
                  value={assignClientId}
                  onChange={(e) => setAssignClientId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  required
                >
                  <option value="">-- Choose Client --</option>
                  {visibleClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.reference})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Journey Template *</label>
                <select 
                  value={assignTemplateId}
                  onChange={(e) => setAssignTemplateId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  required
                >
                  <option value="">-- Choose Template Flow --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.industry.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 border border-slate-100">
                ⭐ This mappings clones the template's standard timeline milestones so that you can advance them specifically for this client without affecting the master template settings!
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  Initiate Client Journey
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

interface InviteLinkModalProps {
  client: Client;
  inviteLink: string;
  onClose: () => void;
  onContinueAssigning: () => void;
}

function InviteLinkModal({ client, inviteLink, onClose, onContinueAssigning }: InviteLinkModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = inviteLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-md flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Secure Sign-Up Invitation
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-xs font-bold text-emerald-800 mb-1">🔒 Self-Serve Password Setup (via Clerk)</p>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              We've registered <strong>{client.name}</strong> ({client.email}) as a client profile. 
              Send them the secure invite link below. They will set their own password via Clerk and 
              their account will be automatically linked to this profile on first sign-in.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Secure Invite Link</label>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 text-[11px] px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-700"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 italic">
              The client will set their own password via Clerk's secure registration flow.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800">
            <p className="font-bold mb-1">🛡️ Why this is secure:</p>
            <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
              <li>You never handle or see the password</li>
              <li>Clerk enforces strong password rules & 2FA</li>
              <li>If forgotten, the client resets via "Forgot Password"</li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Done
            </button>
            <button
              type="button"
              onClick={onContinueAssigning}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Link2 className="w-3.5 h-3.5" /> Map to Journey Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
