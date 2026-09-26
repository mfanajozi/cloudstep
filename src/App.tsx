import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, AlertCircle, X, CheckCircle2, UserRound, LogOut } from 'lucide-react';
import TemplateSetup from './components/TemplateSetup';
import ProfileScreen from './components/ProfileScreen';
import { Avatar } from './components/Avatar';
import { getDataClient } from './lib/neon';
import { useAuth, setupFlagKey } from './lib/auth';
import {
  fetchClients, fetchTemplates, fetchAssignments, fetchLogs,
  upsertClient, upsertTemplate, upsertAssignment, insertLog,
  updateClientStatus, fetchUserProfile, fetchUserSetupState,
  DataClient,
} from './lib/data';
import { CloudStepHandlers, Toast, PushToast } from './lib/handlers';

import { Client, Template, Assignment, CommunicationLog, UserProfile } from './types';
import { INITIAL_TEMPLATES, DUMMY_CLIENT } from './data';

import StatsOverview from './components/StatsOverview';
import Dashboard from './components/Dashboard';
import TemplateBuilder from './components/TemplateBuilder';
import NotificationSettings from './components/NotificationSettings';
import ClientPortal from './components/ClientPortal';
import MarketingHub from './components/MarketingHub';
import Landing from './components/Landing';
import AuthGate, { AuthMode } from './components/AuthGate';

// ---------------------------------------------------------------
// In-app member menu. Profile editing and sign-out both live here.
// ---------------------------------------------------------------
function MemberMenu({
  onOpenProfile,
  name,
  email,
  photoUrl,
}: {
  onOpenProfile: () => void;
  name?: string;
  email?: string;
  photoUrl?: string;
}) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const displayName = name || user?.name || user?.email || 'Member';
  const displayEmail = email || user?.email || '';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 hover:border-blue-500 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        title={displayName}
      >
        <Avatar src={photoUrl ?? user?.image ?? undefined} alt={displayName} initials={initials} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-slate-150 border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
            <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
          </div>
          <button
            onClick={() => { setOpen(false); onOpenProfile(); }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-2"
          >
            <UserRound className="w-4 h-4" /> My profile
          </button>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 border-t border-slate-200 transition-colors cursor-pointer flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardApp() {
  const { user } = useAuth();
  const dataRef = useRef<{ getClient: () => Promise<DataClient> } | null>(null);
  if (!dataRef.current) {
    dataRef.current = {
      getClient: async () => getDataClient(),
    };
  }
  const data = dataRef.current;

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activePerspective, setActivePerspective] = useState<'business' | 'portal'>('business');
  const [businessTab, setBusinessTab] = useState<'dashboard' | 'builder' | 'notifications' | 'logs' | 'marketing' | 'profile'>('dashboard');

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 5000);
  }, []);

  const agentUserId = user?.id ?? null;

  // One-shot initial fetch
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!user) return;
      setLoading(true);
      try {
        const db = await data.getClient();

        const [resProfile, resClients, resTemplates, resAssignments, resLogs] = await Promise.all([
          fetchUserProfile(db, user.id).catch(() => null),
          fetchClients(db),
          fetchTemplates(db),
          fetchAssignments(db),
          fetchLogs(db),
        ]);

        if (resProfile && isMounted) setProfile(resProfile);

        if (!isMounted) return;

        setAssignments(resAssignments);
        setLogs(resLogs);

        if (resTemplates.length > 0) {
          setTemplates(resTemplates);
        } else {
          setTemplates(INITIAL_TEMPLATES);
        }

        if (resClients.length > 0) {
          setClients(resClients);
        } else {
          // Seed a demo client so the agent has something to work with.
          try {
            const saved = await upsertClient(db, DUMMY_CLIENT, agentUserId);
            setClients([saved]);
          } catch (e) {
            console.error('Seed client save failed:', e);
            setClients([DUMMY_CLIENT]);
          }
        }
      } catch (err: any) {
        console.error('Error loading data:', err);
        pushToast({ kind: 'error', title: 'Failed to load workspace', body: err?.message });
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Explicit save helpers, surfaced to children via props
  const handlers = {
    createClient: async (client: Client) => {
      const db = await data.getClient();
      const saved = await upsertClient(db, client, agentUserId);
      setClients(prev => {
        const without = prev.filter(c => c.id !== saved.id);
        return [saved, ...without];
      });
      return saved;
    },
    saveTemplate: async (template: Template) => {
      const db = await data.getClient();
      const saved = await upsertTemplate(db, template, agentUserId);
      setTemplates(prev => {
        const without = prev.filter(t => t.id !== saved.id);
        return [saved, ...without];
      });
      return saved;
    },
    createAssignment: async (assignment: Assignment, newLog: CommunicationLog) => {
      const db = await data.getClient();
      const [savedAsg, savedLog] = await Promise.all([
        upsertAssignment(db, assignment, agentUserId),
        insertLog(db, newLog, agentUserId),
      ]);
      setAssignments(prev => [savedAsg, ...prev.filter(a => a.id !== savedAsg.id)]);
      setLogs(prev => [savedLog, ...prev]);
      return savedAsg;
    },
    updateMilestoneStatus: async (
      assignmentId: string,
      updatedMilestones: Assignment['milestones'],
      newStatus: 'Active' | 'Completed',
      newLogs: CommunicationLog[]
    ) => {
      const db = await data.getClient();
      const next = assignments.find(a => a.id === assignmentId);
      if (!next) return;
      const updated: Assignment = { ...next, milestones: updatedMilestones, status: newStatus };
      const [savedAsg, ...savedLogs] = await Promise.all([
        upsertAssignment(db, updated, agentUserId),
        ...newLogs.map(l => insertLog(db, l, agentUserId)),
      ]);
      setAssignments(prev => prev.map(a => a.id === savedAsg.id ? savedAsg : a));
      savedLogs.forEach(sl => setLogs(prev => [sl, ...prev]));
      return savedAsg;
    },
    archiveClient: async (clientId: string) => {
      const db = await data.getClient();
      const updated = await updateClientStatus(db, clientId, 'archived', agentUserId);
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
      return updated;
    },
    restoreClient: async (clientId: string) => {
      const db = await data.getClient();
      const updated = await updateClientStatus(db, clientId, 'active', agentUserId);
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
      return updated;
    },
    softDeleteClient: async (clientId: string) => {
      const db = await data.getClient();
      const updated = await updateClientStatus(db, clientId, 'deleted_by_user', agentUserId);
      setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
      return updated;
    },
    insertLog: async (log: CommunicationLog) => {
      const db = await data.getClient();
      const saved = await insertLog(db, log, agentUserId);
      setLogs(prev => {
        const without = prev.filter(l => l.id !== saved.id);
        return [saved, ...without];
      });
      return saved;
    },
    pushToast,
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-ink-950">Loading workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-ink-950 text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      <nav id="sleek-header" className="bg-slate-150 border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer">
            <img src="/favicon.png" alt="CloudSTep" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CloudSTep</h1>
              <span className="text-[9px] font-bold text-blue-650 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-widest leading-none">ZA</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold leading-none mt-0.5">SineThamsanqa Solutions</p>
          </div>
        </div>

        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1.5 self-stretch md:self-auto">
          <button
            onClick={() => setActivePerspective('business')}
            className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activePerspective === 'business' 
                ? 'bg-blue-600 text-ink-950 shadow-md shadow-blue-100' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
            }`}
          >
            🏢 Business Console (Agent)
          </button>
          <button
            onClick={() => setActivePerspective('portal')}
            className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activePerspective === 'portal' 
                ? 'bg-ink-700 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
            }`}
          >
            📱 Customer Portal (Client)
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-1 hidden sm:block">
            <p className="text-sm font-semibold text-slate-950">{profile?.fullName || user?.name || user?.email}</p>
            <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5 uppercase">Real Estate &amp; Conveyancing</p>
          </div>
          <MemberMenu
            onOpenProfile={() => { setActivePerspective('business'); setBusinessTab('profile'); }}
            name={profile?.fullName}
            email={profile?.email}
            photoUrl={profile?.avatarUrl ?? undefined}
          />
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {activePerspective === 'business' ? (
          <div className="space-y-6 animate-fade-in">
            {businessTab !== 'profile' && <StatsOverview assignments={assignments} logs={logs} />}
            <div className="flex border-b border-slate-200 overflow-x-auto p-1.5 no-scrollbar bg-slate-150 rounded-xl shadow-sm gap-1">
              <button
                onClick={() => setBusinessTab('dashboard')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Active Pipelines ({assignments.length})
              </button>

              <button
                onClick={() => setBusinessTab('builder')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'builder' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Journey Template Builder
              </button>

              <button
                onClick={() => setBusinessTab('notifications')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'notifications' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Notification Presets
              </button>

              <button
                onClick={() => setBusinessTab('marketing')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'marketing' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                🎂 Marketing Hub
              </button>

              <button
                onClick={() => setBusinessTab('profile')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                My Profile
              </button>

              <button
                onClick={() => setBusinessTab('logs')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'logs' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Communication Audits ({logs.length})
              </button>
            </div>

            <div className="min-h-[450px]">
              {businessTab === 'profile' && (
                <ProfileScreen onBack={() => setBusinessTab('dashboard')} onSaved={setProfile} />
              )}
              {businessTab === 'dashboard' && (
                <Dashboard 
                  clients={clients} 
                  templates={templates} 
                  assignments={assignments} 
                  logs={logs}
                  setClients={setClients}
                  setAssignments={setAssignments}
                  setLogs={setLogs}
                  selectedAssignmentId={selectedAssignmentId}
                  setSelectedAssignmentId={setSelectedAssignmentId}
                  handlers={handlers}
                />
              )}
              {businessTab === 'builder' && <TemplateBuilder templates={templates} setTemplates={setTemplates} handlers={handlers} />}
              {businessTab === 'notifications' && <NotificationSettings templates={templates} setTemplates={setTemplates} handlers={handlers} />}
              {businessTab === 'marketing' && (
                <MarketingHub clients={clients} setClients={setClients} setLogs={setLogs} handlers={handlers} />
              )}
              {businessTab === 'logs' && (
                <div className="bg-slate-150 border border-slate-100 rounded-xl shadow-sm p-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-850 text-base">Communication Dispatch Logs</h3>
                  </div>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200">{log.channel}</span>
                            <span className="text-[11px] font-bold">{log.clientName}</span>
                            <span className="text-[10px] text-slate-450">• {log.milestoneTitle}</span>
                          </div>
                          <p className="text-xs text-slate-600 italic font-medium">{log.message}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] text-slate-500 font-semibold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <ClientPortal clients={clients} assignments={assignments} setClients={setClients} handlers={handlers} />
          </div>
        )}
      </main>

      <footer className="mt-auto bg-slate-150 border-t border-slate-200 px-8 py-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 font-medium gap-3">
        <div className="text-center md:text-left">
          &copy; {new Date().getFullYear()} SineThamsanqa Business Solutions. All rights reserved. • <a href="https://www.cloudst.co.za" target="_blank" rel="noreferrer" className="text-blue-650 hover:underline inline-flex items-center gap-0.5 font-bold">www.cloudst.co.za <ExternalLink className="w-3 h-3" /></a>
        </div>
      </footer>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`rounded-xl shadow-2xl border p-3 flex items-start gap-2 animate-fade-in ${
              t.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
              t.kind === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
              'bg-ink-900 border-ink-700 text-white'
            }`}
          >
            <div className="mt-0.5">
              {t.kind === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {t.kind === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
              {t.kind === 'info' && <AlertCircle className="w-4 h-4 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold">{t.title}</p>
              {t.body && <p className="text-[11px] mt-0.5 opacity-90 break-words">{t.body}</p>}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    const currentUser = user;
    if (!currentUser) return;
    let isMounted = true;

    (async () => {
      try {
        const { exists, setupComplete } = await fetchUserSetupState(getDataClient(), currentUser.id);
        if (!isMounted) return;
        setOnboardingComplete(exists && setupComplete);
      } catch (e) {
        console.error('Workspace resolve failed:', e);
        if (!isMounted) return;
        // Workspace unreachable: trust the local setup flag so an owner who
        // has already completed setup is never stranded on the loading screen.
        let done = false;
        try { done = localStorage.getItem(setupFlagKey(currentUser.id)) === '1'; } catch { /* private mode */ }
        setOnboardingComplete(done);
      }
    })();

    return () => { isMounted = false; };
  }, [user]);

  if (!user || onboardingComplete === null) {
    return <div className="min-h-screen flex items-center justify-center bg-ink-950">Loading your profile...</div>;
  }

  if (!onboardingComplete) {
    return <TemplateSetup onComplete={() => setOnboardingComplete(true)} />;
  }

  return <DashboardApp />;
}


type Route = 'landing' | AuthMode;

function routeFromHash(): Route {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  if (hash.includes('sign-up')) return 'sign-up';
  if (hash.includes('sign-in')) return 'sign-in';
  return 'landing';
}

export default function App() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState<Route>(() => routeFromHash());

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Signing in leaves #/sign-in in the URL — drop it once the session lands.
  useEffect(() => {
    if (user && window.location.hash.includes('sign-')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setRoute('landing');
    }
  }, [user]);

  const goRoute = useCallback((next: Route) => {
    if (next === 'landing') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      window.location.hash = next === 'sign-up' ? '/sign-up' : '/sign-in';
    }
    setRoute(next);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 text-slate-400 text-sm font-semibold">
        Loading CloudSTep…
      </div>
    );
  }

  if (user) return <AuthenticatedApp />;

  if (route === 'sign-in' || route === 'sign-up') {
    return <AuthGate mode={route} onBack={() => goRoute('landing')} onModeChange={m => goRoute(m)} />;
  }

  return <Landing onSignIn={() => goRoute('sign-in')} />;
}
