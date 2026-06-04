import React, { useState } from 'react';
import { 
  CheckCircle2, Clock, Calendar, Mail, MessageSquare, Phone, 
  ExternalLink, Sparkles, Building2, UserCheck, Shield, HelpCircle,
  Trash2, AlertTriangle, X
} from 'lucide-react';
import { Client, Assignment, Template } from '../types';

interface ClientPortalProps {
  clients: Client[];
  assignments: Assignment[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
}

export default function ClientPortal({ clients, assignments, setClients }: ClientPortalProps) {
  // Recognize the specific logged-in client (set via auto-linking in App.tsx)
  const activeClient = clients[0];

  // If the active client has soft-deleted themselves, show access revoked screen
  if (activeClient?.status === 'deleted_by_user') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center space-y-3">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Portal access closed</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You have previously requested that your profile be removed from this portal. 
            The business has retained your records for POPIA compliance, but you no longer have access to your journey view.
          </p>
          <p className="text-[11px] text-slate-400">
            Need to reactivate? Please contact your agent directly.
          </p>
        </div>
      </div>
    );
  }

  const activeAssignment = assignments.find(a => a.clientId === activeClient?.id);

  // Client notification preference toggles
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSMS, setPrefSMS] = useState(true);
  const [prefWhatsApp, setPrefWhatsApp] = useState(true);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Render industry info text
  const getIndustryIntro = (ind: string) => {
    switch(ind) {
      case 'real-estate': return 'Home buying is an exciting milestone. CloudSTeps maps your registration transfer from Offer to Ownership so you stay informed every step of the way without manual phone calls.';
      case 'legal': return 'Your corporate litigation proceedings are tracked step-by-step. Get clear, regular milestones regarding file indexes and pleadings.';
      case 'financial': return 'Secure your future. View your portfolio advisory milestones, FICA compliance steps, and fund transfers clearly.';
      case 'automotive': return 'From order signoff to keys celebration! Track your finance approvals, motor vehicle licensing, and preparative quality checks below.';
      case 'construction': return 'Visual progress of your physical expansion. Track structural inspections and wet works stages cleanly.';
      default: return 'Automated milestone journey tracker, powered by CloudSTeps.';
    }
  };

  const handleDeleteProfile = () => {
    if (!activeClient || !setClients) {
      setShowDeleteConfirm(false);
      return;
    }
    // Soft-delete: keep data for POPIA, block client access
    setClients(prev => prev.map(c => c.id === activeClient.id ? { ...c, status: 'deleted_by_user' as const } : c));
    setShowDeleteConfirm(false);
  };

  if (!activeClient) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 text-xs">
          We could not find a client profile linked to your account. Please contact your agent to be registered.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Secure personalised header strip */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm border border-slate-700/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <p className="text-xs text-slate-300 font-bold tracking-tight">SECURELY LINKED TO YOUR PROFILE</p>
        </div>
        <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
          🔐 Authentication: Clerk • POPIA Verified
        </p>
      </div>

      {activeAssignment ? (
        <div className="space-y-6">

           {/* GREETING HERO PANEL */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-36 h-36 bg-blue-50/60 rounded-full blur-3xl opacity-70 -mr-6 -mt-6" />
            
            <div className="relative space-y-2">
              <span className="text-xs text-blue-600 font-extrabold uppercase tracking-wider block">SineThamsanqa Business Solutions</span>
              <h2 className="text-2xl font-black font-display text-slate-900 tracking-tight">Welcome, {activeClient.name}!</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium">
                {getIndustryIntro(activeClient.industry)}
              </p>
              
              <div className="pt-2 flex items-center gap-4 text-xs font-mono text-slate-400">
                <span>📂 Ref: <strong className="text-slate-700">{activeClient.reference}</strong></span>
                <span>•</span>
                <span>📋 Started: {new Date(activeAssignment.startedAt).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* ADVANCED TRACKING SUMMARY (From JSON Mockup) */}
          {activeAssignment.metadata && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAssignment.metadata.currentStatusSummary && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 shadow-sm">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-blue-500 mb-1 block">Live Status</h4>
                  <p className="text-sm font-semibold text-blue-900">{activeAssignment.metadata.currentStatusSummary}</p>
                  {activeAssignment.metadata.nextAction && (
                    <p className="text-xs text-blue-700 mt-2 bg-blue-100/50 p-2 rounded-lg font-medium border border-blue-200/50">
                      <strong className="text-blue-800">Next Step:</strong> {activeAssignment.metadata.nextAction}
                    </p>
                  )}
                </div>
              )}

              {activeAssignment.metadata.outstandingItems && activeAssignment.metadata.outstandingItems.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 shadow-sm">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-amber-600 mb-2 block">Outstanding Actions Required</h4>
                  <div className="space-y-2">
                    {activeAssignment.metadata.outstandingItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-white border border-amber-200/50 p-2 rounded-lg">
                        <span className="text-xs font-semibold text-amber-900">{item.item}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${item.status === 'Requested' || item.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.status} ({item.assignedTo || 'Pending'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HORIZONTAL TIMELINE PROCESS RIBBON */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 overflow-x-auto">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-405 mb-3 block">Timeline Process Roadmap</h4>
            
            <div className="flex items-center gap-2 min-w-[650px] py-1.5 px-0.5">
              {activeAssignment.milestones.map((m, idx) => {
                const isCompleted = m.status === 'Completed';
                const isInProgress = m.status === 'In Progress';
                
                return (
                  <React.Fragment key={m.id}>
                    <div className="flex-1 flex flex-col items-center text-center relative group">
                      
                      {/* Step Indicator Shape */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                          : isInProgress 
                            ? 'bg-amber-400 text-white animate-pulse' 
                            : 'bg-white border-2 border-slate-200 text-slate-400'
                      }`}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>

                      {/* Display title */}
                      <span className={`text-[10px] font-bold mt-2 truncate max-w-[120px] ${
                        isCompleted ? 'text-slate-500 font-medium' : isInProgress ? 'text-blue-600 font-black' : 'text-slate-400'
                      }`}>
                        {m.title}
                      </span>
                      
                      <span className="text-[8px] text-slate-400 font-semibold font-mono mt-0.5">
                        {m.estimatedDuration}
                      </span>
                    </div>

                    {/* Horizontal Connector bar */}
                    {idx < activeAssignment.milestones.length - 1 && (
                      <div className={`h-0.2 w-8 flex-shrink-0 transition-colors ${
                        isCompleted ? 'bg-blue-600' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
                  
          {/* DETAILED ACTIVE MILESTONE CARDS SECTION */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm font-display flex items-center gap-2 px-1">
              <Clock className="w-4 h-4 text-blue-600 font-bold" />
              Detailed Stage Milestones
            </h3>

            <div className="space-y-3">
              {activeAssignment.milestones.map((m) => {
                const isCompleted = m.status === 'Completed';
                const isInProgress = m.status === 'In Progress';
                const isPending = m.status === 'Pending';

                return (
                  <div 
                    key={m.id}
                    className={`bg-white border rounded-2xl p-4 transition-all ${
                      isInProgress 
                        ? 'border-2 border-blue-600 shadow-sm ring-4 ring-blue-50' 
                        : isCompleted 
                          ? 'border-slate-200 bg-slate-50/40 opacity-90' 
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] font-bold ${
                          isCompleted 
                            ? 'bg-blue-50 border-blue-200 text-blue-600' 
                            : isInProgress 
                              ? 'bg-amber-50 border-amber-200 text-amber-700 font-medium' 
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}>
                          {isCompleted ? '✓' : '•'}
                        </div>
                        <h4 className={`text-xs font-bold ${
                          isCompleted ? 'text-slate-400 line-through font-normal' : 'text-slate-805'
                        }`}>
                          {m.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isCompleted 
                            ? 'bg-blue-50 text-blue-650' 
                            : isInProgress 
                              ? 'bg-amber-50 text-amber-700 animate-pulse' 
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                    </div>

                    {/* Progress details */}
                    <div className="mt-3 text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl">
                      <p className="font-semibold text-slate-705 leading-relaxed">
                        {m.messageTemplate
                          .replace('{name}', activeClient.name)
                          .replace('{reference}', activeClient.reference)
                          .replace('{company}', activeClient.company || 'SineThamsanqa Business Solutions')}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 items-center mt-3 pt-3 border-t border-slate-200 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Estimated Duration: <strong className="text-slate-600">{m.estimatedDuration}</strong>
                        </span>
                        {isCompleted && m.completedAt && (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-100 font-bold">
                            Completed Date: {new Date(m.completedAt).toLocaleDateString('en-ZA')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>        

          {/* CLIENT NOTIFICATION PREFERENCES */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-205 pb-2">
              <h4 className="font-bold text-slate-900 text-xs font-display uppercase tracking-wider block">My Update Communication Channels</h4>
              <p className="text-[11px] text-slate-500">Configure your personal channel details for peace of mind notifications.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-200 transition-colors">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" /> Email Updates
                </span>
                <input 
                  type="checkbox" 
                  checked={prefEmail} 
                  onChange={(e) => setPrefEmail(e.target.checked)}
                  className="rounded text-blue-600 cursor-pointer" 
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-650" /> SMS Text
                </span>
                <input 
                  type="checkbox" 
                  checked={prefSMS} 
                  onChange={(e) => setPrefSMS(e.target.checked)}
                  className="rounded text-blue-500 cursor-pointer" 
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Direct
                </span>
                <input 
                  type="checkbox" 
                  checked={prefWhatsApp} 
                  onChange={(e) => setPrefWhatsApp(e.target.checked)}
                  className="rounded text-emerald-500 cursor-pointer" 
                />
              </label>
            </div>
          </div>

          {/* DANGER ZONE: Delete My Profile (POPIA Right to be Forgotten) */}
          <div className="bg-white border border-red-100 rounded-2xl p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-lg text-red-600 flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-xs font-display uppercase tracking-wider">Privacy & Data Management</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  As a POPIA-protected data subject, you may close your portal access at any time. The business 
                  will retain core records for regulatory compliance, but you will no longer be able to view your journey.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete My Profile
                </button>
              </div>
            </div>
          </div>

          {/* PLATFORM VALUE CEMENT AND DEMO INFO */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <h5 className="font-bold text-slate-900 text-sm">Need a smart progress portal for your South African firm?</h5>
              <p className="text-xs text-slate-500 max-w-xl font-medium">
                Deliver custom, automated, POPIA-compliant updates for property transfers, car sales, building milestones or investments under your own white-labeled brand.
              </p>
            </div>
            
            <a 
              href="https://www.cloudst.co.za" 
              target="_blank" 
              rel="noreferrer"
              className="bg-gradient-to-r from-blue-600 to-sky-500 hover:opacity-95 text-white font-bold text-xs px-5 py-3 rounded-xl whitespace-nowrap inline-flex items-center gap-1.5 text-center transition-all shadow-md shadow-blue-100/50 cursor-pointer"
            >
              Contact SineThamsanqa Demo <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 text-xs">
          Your profile is registered, but no active journey has been mapped to you yet. Your agent will set this up shortly.
        </div>
      )}

      {/* CONFIRM DELETE PROFILE MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-red-100">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-md flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete Your Profile?
              </h3>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800">
                <p className="font-bold mb-1">⚠️ What this means:</p>
                <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                  <li>You will lose access to view your active journey</li>
                  <li>The business keeps records for POPIA compliance only</li>
                  <li>You will not be able to recover this view yourself</li>
                  <li>Your agent can re-activate the profile on request</li>
                </ul>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                To permanently delete <strong>all</strong> your data (right to be forgotten), please email 
                your agent directly. This action only closes your portal access.
              </p>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Yes, Close My Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
