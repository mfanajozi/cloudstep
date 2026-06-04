import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { SignedIn, SignedOut, SignIn, useAuth, useUser, UserButton } from '@clerk/clerk-react';
import Onboarding from './components/Onboarding';
import { createClerkSupabaseClient } from './lib/supabase';

import { Client, Template, Assignment, CommunicationLog } from './types';
import { INITIAL_TEMPLATES, DUMMY_CLIENT } from './data';

import StatsOverview from './components/StatsOverview';
import Dashboard from './components/Dashboard';
import TemplateBuilder from './components/TemplateBuilder';
import NotificationSettings from './components/NotificationSettings';
import ClientPortal from './components/ClientPortal';
import MarketingHub from './components/MarketingHub';

function DashboardApp({ userIndustry }: { userIndustry: string }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [supabase] = useState(() => {
    return {
      getClient: async () => {
        const token = await getToken({ template: 'supabase' });
        return createClerkSupabaseClient(token);
      }
    };
  });

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const db = await supabase.getClient();
        
        const [resClients, resTemplates, resAssignments, resLogs] = await Promise.all([
          db.from('clients').select('*').order('created_at', { ascending: false }),
          db.from('templates').select('*').order('created_at', { ascending: false }),
          db.from('assignments').select('*').order('created_at', { ascending: false }),
          db.from('communication_logs').select('*').order('timestamp', { ascending: false })
        ]);

        if (resAssignments.data) setAssignments(resAssignments.data);
        if (resLogs.data) setLogs(resLogs.data);

        if (resTemplates.data && resTemplates.data.length > 0) {
          setTemplates(resTemplates.data);
        } else {
          const industryTemplates = INITIAL_TEMPLATES.filter(t => t.industry === userIndustry);
          setTemplates(industryTemplates);
        }

        if (resClients.data && resClients.data.length > 0) {
          setClients(resClients.data);
        } else {
          setClients([{ ...DUMMY_CLIENT, industry: userIndustry as any }]);
        }

      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, userIndustry, supabase]);

  useEffect(() => {
    if (loading || !user || clients.length === 0) return;
    async function syncClients() {
      const db = await supabase.getClient();
      const payload = clients.map(c => ({ ...c, user_id: user?.id }));
      await db.from('clients').upsert(payload);
    }
    syncClients();
  }, [clients, user, loading, supabase]);

  useEffect(() => {
    if (loading || !user || templates.length === 0) return;
    async function syncTemplates() {
      const db = await supabase.getClient();
      const payload = templates.map(t => ({ ...t, user_id: user?.id }));
      await db.from('templates').upsert(payload);
    }
    syncTemplates();
  }, [templates, user, loading, supabase]);

  useEffect(() => {
    if (loading || !user || assignments.length === 0) return;
    async function syncAssignments() {
      const db = await supabase.getClient();
      const payload = assignments.map(a => ({ ...a, user_id: user?.id }));
      await db.from('assignments').upsert(payload);
    }
    syncAssignments();
  }, [assignments, user, loading, supabase]);

  useEffect(() => {
    if (loading || !user || logs.length === 0) return;
    async function syncLogs() {
      const db = await supabase.getClient();
      const payload = logs.map(l => ({ ...l, user_id: user?.id }));
      await db.from('communication_logs').upsert(payload);
    }
    syncLogs();
  }, [logs, user, loading, supabase]);


  const [activePerspective, setActivePerspective] = useState<'business' | 'portal'>('business');
  const [businessTab, setBusinessTab] = useState<'dashboard' | 'builder' | 'notifications' | 'logs' | 'marketing'>('dashboard');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">Loading workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      <nav id="sleek-header" className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm relative z-20">
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
                ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
            }`}
          >
            🏢 Business Console (Agent)
          </button>
          <button
            onClick={() => setActivePerspective('portal')}
            className={`flex-1 md:flex-initial text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activePerspective === 'portal' 
                ? 'bg-slate-950 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
            }`}
          >
            📱 Customer Portal (Client)
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-1 hidden sm:block">
            <p className="text-sm font-semibold text-slate-950">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5 uppercase">{userIndustry}</p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center">
            <UserButton />
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {activePerspective === 'business' ? (
          <div className="space-y-6 animate-fade-in">
            <StatsOverview assignments={assignments} logs={logs} />
            <div className="flex border-b border-slate-200 overflow-x-auto p-1.5 no-scrollbar bg-white rounded-xl shadow-sm gap-1">
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
                onClick={() => setBusinessTab('logs')}
                className={`text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  businessTab === 'logs' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Communication Audits ({logs.length})
              </button>
            </div>

            <div className="min-h-[450px]">
              {businessTab === 'dashboard' && (
                <Dashboard 
                  clients={clients} 
                  templates={templates} 
                  assignments={assignments} 
                  logs={logs}
                  setAssignments={setAssignments}
                  setLogs={setLogs}
                  setClients={setClients}
                  selectedAssignmentId={selectedAssignmentId}
                  setSelectedAssignmentId={setSelectedAssignmentId}
                />
              )}
              {businessTab === 'builder' && <TemplateBuilder templates={templates} setTemplates={setTemplates} />}
              {businessTab === 'notifications' && <NotificationSettings templates={templates} setTemplates={setTemplates} />}
              {businessTab === 'marketing' && (
                <MarketingHub clients={clients} setClients={setClients} setLogs={setLogs} />
              )}
              {businessTab === 'logs' && (
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-4">
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
            <ClientPortal clients={clients} assignments={assignments} setClients={setClients} />
          </div>
        )}
      </main>

      <footer className="mt-auto bg-white border-t border-slate-200 px-8 py-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 font-medium gap-3">
        <div className="text-center md:text-left">
          &copy; {new Date().getFullYear()} SineThamsanqa Business Solutions. All rights reserved. • <a href="https://www.cloudst.co.za" target="_blank" rel="noreferrer" className="text-blue-650 hover:underline inline-flex items-center gap-0.5 font-bold">www.cloudst.co.za <ExternalLink className="w-3 h-3" /></a>
        </div>
      </footer>
    </div>
  );
}

function AuthenticatedApp() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [userIndustry, setUserIndustry] = useState<string | null>(null);
  const [linkedClient, setLinkedClient] = useState<Client | null>(null);
  const [resolutionState, setResolutionState] = useState<'resolving' | 'agent' | 'client'>('resolving');

  useEffect(() => {
    let isMounted = true;
    async function resolveRole() {
      if (!user) return;
      try {
        const token = await getToken({ template: 'supabase' });
        const supabase = createClerkSupabaseClient(token);

        const { data, error } = await supabase.from('users').select('industry').single();
        if (!isMounted) return;
        
        if (data?.industry) {
          setUserIndustry(data.industry);
          setOnboardingComplete(true);
        } else {
          setOnboardingComplete(false);
          setResolutionState('agent');
          return;
        }

        const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
        const clerkUserId = user.id;

        const { data: clerkMatch } = await supabase
          .from('clients')
          .select('*')
          .eq('clerk_user_id', clerkUserId)
          .neq('status', 'deleted_by_user')
          .maybeSingle();

        if (clerkMatch) {
          if (isMounted) {
            setLinkedClient(clerkMatch as Client);
            setResolutionState('client');
          }
          return;
        }

        if (email) {
          const { data: emailMatch } = await supabase
            .from('clients')
            .select('*')
            .ilike('email', email)
            .is('clerk_user_id', null)
            .neq('status', 'deleted_by_user')
            .maybeSingle();

          if (emailMatch) {
            const { data: linked } = await supabase
              .from('clients')
              .update({ clerk_user_id: clerkUserId, status: 'active' })
              .eq('id', emailMatch.id)
              .select('*')
              .single();

            if (isMounted) {
              setLinkedClient((linked || emailMatch) as Client);
              setResolutionState('client');
            }
            return;
          }
        }

        if (isMounted) setResolutionState('agent');
      } catch(e) {
        console.error("Auth resolve error:", e);
        if (isMounted) setResolutionState('agent');
      }
    }
    resolveRole();
    return () => { isMounted = false; };
  }, [getToken, user]);

  if (onboardingComplete === null || resolutionState === 'resolving') {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">Loading your profile...</div>;
  }

  if (!onboardingComplete) return <Onboarding onComplete={() => { setOnboardingComplete(true); setResolutionState('agent'); }} />;

  if (resolutionState === 'client' && linkedClient) {
    return <ClientOnlyPortal client={linkedClient} />;
  }

  return <DashboardApp userIndustry={userIndustry!} />;
}

function ClientOnlyPortal({ client }: { client: Client }) {
  const { getToken } = useAuth();
  const [supabase] = React.useState(() => ({
    getClient: async () => {
      const token = await getToken({ template: 'supabase' });
      return createClerkSupabaseClient(token);
    }
  }));
  const [clients, setClients] = useState<Client[]>([client]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const db = await supabase.getClient();
        const { data: asg } = await db
          .from('assignments')
          .select('*')
          .eq('clientId', client.id)
          .order('created_at', { ascending: false });
        if (isMounted) {
          setAssignments(asg || []);
          setLoading(false);
        }
      } catch (e) {
        console.error("Client portal load error:", e);
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [client.id, supabase]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">Loading your journey...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="CloudSTep" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">CloudSTep</h1>
            <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold leading-none mt-0.5">Customer Portal</p>
          </div>
        </div>
        <UserButton afterSignOutUrl="/" />
      </nav>
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in">
        <ClientPortal clients={clients} assignments={assignments} setClients={setClients} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
            <div className="flex justify-center mb-6">
               <img src="/favicon.png" alt="CloudSTep Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-8 text-slate-900">Sign in to CloudSTep</h1>
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  );
}
