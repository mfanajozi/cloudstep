import React, { useState, useMemo } from 'react';
import {
  Cake, Heart, Sparkles, Send, Mail, MessageSquare, Phone,
  Calendar, Gift, ChevronRight, Copy, Check, Users
} from 'lucide-react';
import { Client, CommunicationLog, Industry } from '../types';
import { INDUSTRY_META } from '../data';
import { CloudStepHandlers } from '../lib/handlers';

interface MarketingHubProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setLogs: React.Dispatch<React.SetStateAction<CommunicationLog[]>>;
  handlers: CloudStepHandlers;
}

type EventType = 'birthday' | 'anniversary';

interface UpcomingEvent {
  client: Client;
  type: EventType;
  date: Date;
  daysUntil: number;
  displayDate: string;
}

const INDUSTRY_TEMPLATES: Record<Industry, { birthday: string; anniversary: string }> = {
  'real-estate': {
    birthday: 'Happy Birthday, {name}! 🎂 Wishing you a beautiful year ahead. May it bring you closer to your dream home — we are always here to help with your property journey.',
    anniversary: 'Happy Anniversary, {name}! 💍 Another year of love, laughter and memories. If you are ever ready for your next chapter, we are here to guide your family home.',
  },
  'legal': {
    birthday: 'Happy Birthday, {name}! 🎂 Wishing you a wonderful year ahead. Thank you for trusting us with {reference} — we remain at your service.',
    anniversary: 'Happy Anniversary, {name}! 💍 Celebrating this special day with you. Thank you for the trust you place in our team.',
  },
  'financial': {
    birthday: 'Happy Birthday, {name}! 🎂 Wishing you a prosperous year. May your investments grow and your future remain secure. — Your advisory team',
    anniversary: 'Happy Anniversary, {name}! 💍 Wishing you a joyful celebration. As you mark another year, may your financial plans continue to secure what matters most.',
  },
  'automotive': {
    birthday: 'Happy Birthday, {name}! 🎂 Have an amazing day from all of us at the dealership. Wishing you smooth roads and happy kilometres ahead!',
    anniversary: 'Happy Anniversary, {name}! 💍 Cheers to another great year. Should you ever consider an upgrade, we have a fresh fleet waiting for you.',
  },
  'construction': {
    birthday: 'Happy Birthday, {name}! 🎂 Wishing you a solid, joyful year ahead — built on happiness. Thanks for trusting us with {reference}.',
    anniversary: 'Happy Anniversary, {name}! 💍 Many happy returns of the day. We are proud to build alongside clients who value quality and craft.',
  },
};

const DEFAULT_TEMPLATE = {
  birthday: 'Happy Birthday, {name}! 🎂 Wishing you a wonderful year ahead from all of us at SineThamsanqa Business Solutions.',
  anniversary: 'Happy Anniversary, {name}! 💍 Wishing you a beautiful day of celebration. Thank you for being a valued client.',
};

function getDaysUntil(target: Date, now: Date = new Date()): number {
  const currentYear = now.getFullYear();
  const eventThisYear = new Date(currentYear, target.getMonth(), target.getDate());
  if (eventThisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    eventThisYear.setFullYear(currentYear + 1);
  }
  const diff = eventThisYear.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export default function MarketingHub({ clients, setClients, setLogs, handlers }: MarketingHubProps) {
  const [activeTab, setActiveTab] = useState<EventType>('birthday');
  const [filter, setFilter] = useState<'all' | 'today' | 'this-week' | 'this-month'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeClients = useMemo(
    () => clients.filter(c => c.status === 'active' || !c.status),
    [clients]
  );

  const events = useMemo<UpcomingEvent[]>(() => {
    const list: UpcomingEvent[] = [];
    activeClients.forEach(c => {
      if (c.dateOfBirth) {
        const d = new Date(c.dateOfBirth);
        const days = getDaysUntil(d);
        list.push({
          client: c,
          type: 'birthday',
          date: d,
          daysUntil: days,
          displayDate: d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
        });
      }
      if (c.anniversaryDate) {
        const d = new Date(c.anniversaryDate);
        const days = getDaysUntil(d);
        list.push({
          client: c,
          type: 'anniversary',
          date: d,
          daysUntil: days,
          displayDate: d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
        });
      }
    });
    return list
      .filter(e => e.type === activeTab)
      .filter(e => {
        if (filter === 'today') return e.daysUntil === 0;
        if (filter === 'this-week') return e.daysUntil <= 7;
        if (filter === 'this-month') return e.daysUntil <= 30;
        return true;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [activeClients, activeTab, filter]);

  const buildMessage = (event: UpcomingEvent): string => {
    const templates = INDUSTRY_TEMPLATES[event.client.industry] || DEFAULT_TEMPLATE;
    const template = event.type === 'birthday' ? templates.birthday : templates.anniversary;
    return template
      .replace(/{name}/g, event.client.name)
      .replace(/{reference}/g, event.client.reference || 'your matter')
      .replace(/{company}/g, event.client.company || 'SineThamsanqa Business Solutions');
  };

  const dispatchMessage = async (event: UpcomingEvent, channel: 'Email' | 'WhatsApp' | 'SMS') => {
    const message = buildMessage(event);
    const recipient = channel === 'Email' ? event.client.email : event.client.phone;

    const newLog: CommunicationLog = {
      id: `log-mkt-${Date.now()}`,
      clientId: event.client.id,
      clientName: event.client.name,
      milestoneTitle: `${event.type === 'birthday' ? '🎂 Birthday' : '💍 Anniversary'} — ${event.displayDate}`,
      channel,
      message: `${channel === 'Email' ? 'To: ' + recipient : channel + ': ' + recipient} - ${message}`,
      timestamp: new Date().toISOString(),
      status: 'Delivered',
    };

    // Optimistic local update so the toast renders instantly
    setLogs(prev => [newLog, ...prev]);
    setClients(prev => prev.map(c => 
      c.id === event.client.id 
        ? { ...c, updatedAt: new Date().toISOString() } 
        : c
    ));

    try {
      const saved = await handlers.insertLog(newLog);
      setLogs(prev => prev.map(l => l.id === newLog.id ? saved : l));
      handlers.pushToast({
        kind: 'success',
        title: `${channel} message logged`,
        body: `${event.client.name} — ${event.type === 'birthday' ? 'Birthday' : 'Anniversary'} reminder recorded.`,
      });
    } catch (e: any) {
      handlers.pushToast({
        kind: 'error',
        title: 'Could not save log',
        body: e?.message ?? 'The message was not persisted to the database.',
      });
    }
  };

  const copyMessage = async (event: UpcomingEvent) => {
    const message = buildMessage(event);
    const key = `${event.client.id}-${event.type}`;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const birthdaysToday = activeClients.filter(c => c.dateOfBirth && getDaysUntil(new Date(c.dateOfBirth)) === 0).length;
    const anniversariesToday = activeClients.filter(c => c.anniversaryDate && getDaysUntil(new Date(c.anniversaryDate)) === 0).length;
    const birthdaysThisWeek = activeClients.filter(c => c.dateOfBirth && getDaysUntil(new Date(c.dateOfBirth)) <= 7).length;
    const anniversariesThisWeek = activeClients.filter(c => c.anniversaryDate && getDaysUntil(new Date(c.anniversaryDate)) <= 7).length;
    return { birthdaysToday, anniversariesToday, birthdaysThisWeek, anniversariesThisWeek };
  }, [activeClients]);

  const renderMeta = (industry: Industry) => {
    const meta = INDUSTRY_META[industry];
    if (!meta) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${meta.bg} ${meta.color} border ${meta.border}`}>
        {meta.label.split(' ')[0]}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-pink-50 rounded-lg text-pink-600">
              <Cake className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Birthdays Today</p>
              <p className="text-lg font-bold text-slate-900">{stats.birthdaysToday}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <Heart className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Anniversaries Today</p>
              <p className="text-lg font-bold text-slate-900">{stats.anniversariesToday}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-pink-50/60 rounded-lg text-pink-700">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Birthdays This Week</p>
              <p className="text-lg font-bold text-slate-900">{stats.birthdaysThisWeek}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50/60 rounded-lg text-rose-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Anniversaries This Week</p>
              <p className="text-lg font-bold text-slate-900">{stats.anniversariesThisWeek}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1">
            <button
              onClick={() => setActiveTab('birthday')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'birthday'
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
              }`}
            >
              <Cake className="w-3.5 h-3.5" /> Birthdays
            </button>
            <button
              onClick={() => setActiveTab('anniversary')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'anniversary'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
              }`}
            >
              <Heart className="w-3.5 h-3.5" /> Anniversaries
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Upcoming</option>
              <option value="today">Today</option>
              <option value="this-week">This Week (7 days)</option>
              <option value="this-month">This Month (30 days)</option>
            </select>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs space-y-2">
              <Gift className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold">No upcoming {activeTab === 'birthday' ? 'birthdays' : 'anniversaries'} matched.</p>
              <p>Capture Date of Birth and/or Anniversary Date when registering a new client to see them here.</p>
            </div>
          ) : (
            events.map(event => {
              const key = `${event.client.id}-${event.type}`;
              const isToday = event.daysUntil === 0;
              const isSoon = event.daysUntil > 0 && event.daysUntil <= 7;
              const isCopied = copiedId === key;

              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 transition-all ${
                    isToday
                      ? 'border-pink-300 bg-pink-50/40 shadow-sm'
                      : isSoon
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activeTab === 'birthday' ? 'bg-pink-100 text-pink-600' : 'bg-rose-100 text-rose-600'
                      }`}>
                        {activeTab === 'birthday' ? <Cake className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900">{event.client.name}</h4>
                          {renderMeta(event.client.industry)}
                          {isToday && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-600 text-white animate-pulse">
                              TODAY
                            </span>
                          )}
                          {isSoon && !isToday && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              IN {event.daysUntil} DAY{event.daysUntil > 1 ? 'S' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          📂 {event.client.reference} • 📞 {event.client.phone}
                        </p>

                        {/* Quick message preview */}
                        <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600 italic leading-relaxed">
                          <p className="font-bold text-[9px] text-slate-400 uppercase tracking-widest not-italic mb-1">
                            Clever {activeTab === 'birthday' ? 'Birthday' : 'Anniversary'} Message Preview
                          </p>
                          "{buildMessage(event)}"
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 md:items-end md:min-w-[160px]">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        {event.displayDate} ({isToday ? 'today' : `in ${event.daysUntil}d`})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => dispatchMessage(event, 'Email')}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1"
                          title="Send via Email"
                        >
                          <Mail className="w-3 h-3" /> Email
                        </button>
                        <button
                          onClick={() => dispatchMessage(event, 'WhatsApp')}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                          title="Send via WhatsApp"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </button>
                        <button
                          onClick={() => dispatchMessage(event, 'SMS')}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 flex items-center gap-1"
                          title="Send via SMS"
                        >
                          <Phone className="w-3 h-3" /> SMS
                        </button>
                        <button
                          onClick={() => copyMessage(event)}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 flex items-center gap-1"
                          title="Copy message text"
                        >
                          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 p-3 bg-slate-50/40 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Messages are tailored to each client's industry sector for authentic, on-brand engagement.
          </p>
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {activeClients.length} active client{activeClients.length === 1 ? '' : 's'} tracked
          </p>
        </div>
      </div>
    </div>
  );
}
