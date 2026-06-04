import React from 'react';
import { ShieldCheck, MessageSquare, Briefcase, CheckCircle2 } from 'lucide-react';
import { Assignment, CommunicationLog } from '../types';

interface StatsOverviewProps {
  assignments: Assignment[];
  logs: CommunicationLog[];
}

export default function StatsOverview({ assignments, logs }: StatsOverviewProps) {
  const activeCount = assignments.filter(a => a.status === 'Active').length;
  const completedCount = assignments.filter(a => a.status === 'Completed').length;
  const totalLogs = logs.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div id="stat-active" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600 shadow-sm shadow-blue-100">
          <Briefcase className="w-5.5 h-5.5" />
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Active Journeys</span>
          <span className="text-xl font-bold text-slate-900">{activeCount} Clients</span>
        </div>
      </div>

      <div id="stat-deliveries" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="p-3.5 bg-[#ECFDF5] rounded-xl text-[#059669] shadow-sm shadow-emerald-50">
          <MessageSquare className="w-5.5 h-5.5" />
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Updates Dispatched</span>
          <span className="text-xl font-bold text-slate-900">{totalLogs} Sent</span>
        </div>
      </div>

      <div id="stat-completed" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="p-3.5 bg-[#EFF6FF] rounded-xl text-blue-600 shadow-sm shadow-blue-50">
          <CheckCircle2 className="w-5.5 h-5.5" />
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Completed Deals</span>
          <span className="text-xl font-bold text-slate-900">{completedCount} Finished</span>
        </div>
      </div>

      <div id="stat-popia" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className="p-3.5 bg-[#F0FDFA] rounded-xl text-[#0d9488] shadow-sm shadow-teal-50">
          <ShieldCheck className="w-5.5 h-5.5" />
        </div>
        <div>
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">POPIA Protection</span>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100 inline-block mt-0.5">
            POPIA Compliant
          </span>
        </div>
      </div>
    </div>
  );
}
