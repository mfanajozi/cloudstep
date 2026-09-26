import React from 'react';
import {
  ArrowRight, Building2, Route, Hammer, BellRing, ScrollText,
  Megaphone, Smartphone, BarChart3, ShieldCheck, MapPin, Users,
  Scale, Landmark, KeyRound, HardHat, FileSignature, Check, Sparkles,
} from 'lucide-react';

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  builtFor: string;
  benefit: string;
};

const FEATURES: Feature[] = [
  {
    icon: <Building2 className="w-5 h-5" />,
    title: 'Business Console (Agent View)',
    description:
      'The office dashboard for your whole book of business. Every active transfer, bond or lease sits on one pipeline with its current stage, days-in-stage, owner and next action. Spot the deals that have gone quiet before a client phones you to ask.',
    builtFor: 'Branch managers, principals and conveyancing attorneys running multiple concurrent matters.',
    benefit: 'You stop chasing spreadsheets and WhatsApp threads — you open one screen and know where every deal stands.',
  },
  {
    icon: <Route className="w-5 h-5" />,
    title: 'Client Journey Pipelines',
    description:
      'Pre-built milestone journeys written around how SA property actually moves: Offer to Purchase signed → FICA documents collected → suspensive conditions met (bond approval, sale of existing property) → transfer and bond costs, including transfer duty, settled → Deeds Office lodgement and queries → registration and commission payout.',
    builtFor: 'Estate agencies, conveyancing secretaries and bond originators who repeat the same 15 steps on every deal.',
    benefit: 'Nothing falls through the cracks. Every deal follows a proven sequence instead of someone\u2019s memory.',
  },
  {
    icon: <Hammer className="w-5 h-5" />,
    title: 'Journey Template Builder',
    description:
      'Build your own milestone sequences without code. Add a step, set the target turnaround in days, choose who is responsible, attach the message that should go out, and reuse it on every future client. Residential sale, sectional title, rental mandate, development — your process, your wording.',
    builtFor: 'Independent agencies and small law firms whose in-house process differs from the industry default.',
    benefit: 'Your firm\u2019s way of working becomes a repeatable product instead of tribal knowledge that walks out the door.',
  },
  {
    icon: <BellRing className="w-5 h-5" />,
    title: 'Notification Presets',
    description:
      'Ready-to-send WhatsApp, SMS and email copy for each milestone — document requests, bond approval updates, compliance certificate reminders, rate-change alerts, registration confirmations. Edit the wording once and it applies to every client on that journey.',
    builtFor: 'Agents and secretaries who currently rewrite the same message twelve times a day.',
    benefit: 'Consistent, professional communication in seconds, written the way SA property clients expect to be spoken to.',
  },
  {
    icon: <ScrollText className="w-5 h-5" />,
    title: 'Communication Audit Log',
    description:
      'A timestamped, searchable record of every message sent to every client — channel, milestone, author and body. When a complaint, dispute or PPRA query lands, you can prove exactly what was said and when.',
    builtFor: 'Firms that need a paper trail: conveyancing practices, franchise heads and compliance officers.',
    benefit: 'Defensible records and POPIA-conscious accountability without keeping a separate filing cabinet.',
  },
  {
    icon: <Megaphone className="w-5 h-5" />,
    title: 'Marketing Hub',
    description:
      'Campaigns built for the property calendar: new listings by area, bond rate change notices, winter and spring listing pushes, transfer-complete congratulations, referral asks and birthday triggers — segmented from your existing client list.',
    builtFor: 'Agents and developers who know they should market but never get around to it.',
    benefit: 'Stay top of mind with past sellers and buyers so the next mandate comes to you, not to the agent down the road.',
  },
  {
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Customer Portal (Client View)',
    description:
      'A branded, mobile-first progress tracker your client opens on their phone. They see where their transfer or bond sits, what is outstanding, what is next and how to reach you — without phoning the office for an update. You decide when to invite them.',
    builtFor: 'Buyers, sellers, landlords and tenants — and the agents who want to stop being a human status line.',
    benefit: 'Clients feel informed and in control, which means fewer anxious calls and better reviews and referrals.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Stats & KPIs',
    description:
      'Live counters for active pipelines, completed milestones, dispatch volume and audit activity, plus turnaround trends across your templates so you can see which stage of your process is actually slowing deals down.',
    builtFor: 'Principals and branch managers who report on team performance.',
    benefit: 'Manage by numbers: fix the stage that costs you weeks, not the stage that feels busiest.',
  },
];

type Persona = {
  icon: React.ReactNode;
  title: string;
  who: string;
  benefit: string;
};

const PERSONAS: Persona[] = [
  {
    icon: <Building2 className="w-5 h-5" />,
    title: 'Estate agencies & franchise branches',
    who: 'From one-agent operations to multi-branch franchises listing across Gauteng, the Western Cape and KwaZulu-Natal.',
    benefit: 'Give every agent the same professional process, see the whole pipeline at a glance, and prove your service level to sellers.',
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: 'Conveyancing attorneys & secretaries',
    who: 'Conveyancing practices and lodgement clerks handling dozens of simultaneous transfers.',
    benefit: 'Cut the "where is my transfer?" phone calls, track Deeds Office queries and cancellations, and keep a clean file history.',
  },
  {
    icon: <Landmark className="w-5 h-5" />,
    title: 'Bond originators & mortgage brokers',
    who: 'Originators taking clients from pre-approval through to bond registration and payout.',
    benefit: 'Keep applicants moving, chase outstanding payslips and FICA packs automatically, and never lose a deal to a lapsed pre-approval.',
  },
  {
    icon: <HardHat className="w-5 h-5" />,
    title: 'Property developers & off-plan sales',
    who: 'Developers selling units off-plan with deposit schedules, defect lists and phased handovers.',
    benefit: 'Track deposits, OTP deadlines and handover milestones across every unit in the release.',
  },
  {
    icon: <KeyRound className="w-5 h-5" />,
    title: 'Rental & body corporate managers',
    who: 'Rental mandates, lease renewals, inspections and deposit administrations.',
    benefit: 'Renewals, inspections and deposit refunds run on a schedule instead of in someone\u2019s diary.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Solo agents & lean teams',
    who: 'Independent practitioners who are the agent, the marketer and the administrator all at once.',
    benefit: 'Look and operate like a much larger practice without hiring an administrator first.',
  },
];

const SA_POINTS = [
  {
    title: 'FICA, built into the journey',
    body: 'Identity documents, proof of address and source-of-funds requests are milestones with deadlines — not a reminder you meant to send.',
  },
  {
    title: 'Deeds Office reality',
    body: 'Lodgement, queries, re-lodgement and cancellation are tracked as their own steps, because that is where SA transfers actually stall.',
  },
  {
    title: 'Suspensive conditions',
    body: 'Bond approval, "subject to the sale of an existing property" and inspection-outcome conditions each get a due date and an owner.',
  },
  {
    title: 'Compliance certificates',
    body: 'Electrical Certificate of Compliance, gas, plumbing and beetle certificates are requested early, not on the eve of registration.',
  },
  {
    title: 'Costs & transfer duty',
    body: 'Transfer duty, transfer costs, bond registration costs and commission are flagged as milestones so nobody is surprised at the table.',
  },
  {
    title: 'WhatsApp-first, POPIA-conscious',
    body: 'SA clients read WhatsApp, not email. Every send is logged so you can answer a PPRA or POPIA question with evidence.',
  },
];

const STEPS = [
  { n: '01', title: 'Pick your journey', body: 'Start from a South African sale, bond, rental or sectional-title template — or build your own in the Template Builder.' },
  { n: '02', title: 'Add the client', body: 'Drop in the buyer, seller or tenant, assign the milestones, and invite them to their own Customer Portal link.' },
  { n: '03', title: 'Let it run', body: 'Notifications fire at each stage, the audit log records everything, and you only step in when a deal needs a human.' },
];

function Logo({ className = 'w-9 h-9' }: { className?: string }) {
  return <img src="/logo.png" alt="CloudSTep" className={`${className} object-contain`} />;
}

function GoldButton({ onClick, children, className = '' }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 bg-blue-600 text-ink-950 font-bold px-6 py-3 rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-100/40 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export default function Landing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-800 font-sans selection:bg-blue-600 selection:text-ink-950 flex flex-col">

      {/* NAV */}
      <nav className="sticky top-0 z-30 bg-ink-950/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <div className="leading-none">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">CloudSTep</span>
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase tracking-widest leading-none">ZA</span>
              </div>
              <p className="text-[9px] uppercase tracking-widest text-blue-600 font-bold mt-1">SineThamsanqa Solutions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#features" className="hidden sm:inline text-xs font-semibold text-slate-500 hover:text-slate-900 px-3 py-2 transition-colors">Features</a>
            <a href="#who" className="hidden sm:inline text-xs font-semibold text-slate-500 hover:text-slate-900 px-3 py-2 transition-colors">Who it's for</a>
            <button
              onClick={onSignIn}
              className="text-xs font-bold bg-blue-600 text-ink-950 px-4 py-2 rounded-lg hover:bg-blue-500 transition-all cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(216,183,92,0.13),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full mb-7">
            <MapPin className="w-3 h-3" /> Built in South Africa, for SA property deals
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-950 leading-[1.05] max-w-4xl">
            Every property deal, tracked from <span className="text-blue-600">offer to registration</span>.
          </h1>

          <p className="mt-6 text-base md:text-lg text-slate-500 max-w-2xl leading-relaxed">
            CloudSTep is the client-journey and communication platform for South African estate agencies,
            conveyancing attorneys and bond originators. Milestone by milestone — Offer to Purchase, FICA,
            bond approval, Deeds Office lodgement, registration — with your clients kept in the loop on
            WhatsApp, SMS and email.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <GoldButton onClick={onSignIn} className="w-full sm:w-auto">
              Sign in to CloudSTep <ArrowRight className="w-4 h-4" />
            </GoldButton>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-800 border border-slate-300 px-6 py-3 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all"
            >
              See every feature
            </a>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {[
              ['8', 'Core workspaces'],
              ['WhatsApp', 'SMS & email delivery'],
              ['Deeds Office', 'Lodgement milestones'],
              ['POPIA', 'Conscious by design'],
            ].map(([big, small]) => (
              <div key={small} className="bg-ink-900 px-5 py-5">
                <p className="text-lg font-black text-blue-600">{big}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">{small}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24 w-full">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">What's inside</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-950">Everything the tool does</h2>
          <p className="mt-4 text-slate-500 leading-relaxed">
            Eight workspaces that cover the full life of a mandate — from the first Offer to Purchase to the
            day the deal registers and the commission lands.
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="bg-slate-150 border border-slate-200 rounded-2xl p-6 hover:border-blue-600/50 transition-colors flex flex-col">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  {f.icon}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{f.title}</h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500 leading-relaxed">{f.description}</p>

              <div className="mt-4 pt-4 border-t border-slate-200 space-y-2.5">
                <p className="text-xs leading-relaxed">
                  <span className="font-bold text-blue-600 uppercase tracking-wide text-[10px] mr-1.5">Built for</span>
                  <span className="text-slate-500">{f.builtFor}</span>
                </p>
                <p className="text-xs leading-relaxed">
                  <span className="font-bold text-emerald-600 uppercase tracking-wide text-[10px] mr-1.5">Benefit</span>
                  <span className="text-slate-500">{f.benefit}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who" className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Who this is built for</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-950">The people who benefit most</h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              CloudSTep is a niche tool on purpose. It is built for the professionals who move property in
              South Africa — not for generic "clients" and "projects".
            </p>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERSONAS.map((p) => (
              <div key={p.title} className="bg-slate-150 border border-slate-200 rounded-2xl p-6">
                <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  {p.icon}
                </span>
                <h3 className="mt-4 font-bold text-slate-900">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{p.who}</p>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-200 pt-3">
                  <span className="text-blue-600 font-bold">→ </span>{p.benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BUILT FOR SA */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24 w-full">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-10 items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Relatable by design</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-950">
              Written for how property actually moves in South Africa
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              Imported tools force your process into somebody else's vocabulary. CloudSTep speaks in Offer to
              Purchase, FICA, compliance certificates, Deeds Office and transfer duty — because that is the
              language your clients and your Fidelity Fund certificate are measured against.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Property Practitioners Act', 'Fidelity Fund Certificate', 'Deeds Office', 'Transfer duty (SARS)', 'ECC & compliance certs', 'WhatsApp delivery'].map((t) => (
                <span key={t} className="text-[11px] font-semibold text-slate-500 bg-slate-150 border border-slate-200 px-3 py-1.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {SA_POINTS.map((s) => (
              <div key={s.title} className="bg-slate-150 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <h3 className="font-bold text-slate-900 text-sm">{s.title}</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">How it works</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-950">Up and running in three steps</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-slate-150 border border-slate-200 rounded-2xl p-6">
                <p className="text-3xl font-black text-blue-600/40">{s.n}</p>
                <h3 className="mt-3 font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-24 w-full">
        <div className="relative overflow-hidden rounded-3xl border border-blue-600/40 bg-gradient-to-br from-blue-50 via-slate-150 to-slate-150 p-8 md:p-14 text-center">
          <Sparkles className="w-6 h-6 text-blue-600 mx-auto" />
          <h2 className="mt-4 text-2xl md:text-4xl font-black tracking-tight text-slate-950">
            Ready to stop chasing updates?
          </h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto leading-relaxed">
            Sign in to open your Business Console, or jump straight into a South African journey template
            and add your first client today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <GoldButton onClick={onSignIn}>
              Sign in to CloudSTep <ArrowRight className="w-4 h-4" />
            </GoldButton>
            <a
              href="https://www.cloudst.co.za"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
            >
              www.cloudst.co.za
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-200 bg-ink-900">
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-10 pb-28 sm:pb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
            <div>
              <p className="text-sm font-bold text-slate-900">CloudSTep</p>
              <p className="text-[11px] text-slate-500">Client journeys & communications for SA property.</p>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 md:text-right space-y-1.5">
            <p className="flex items-center md:justify-end gap-1.5">
              <FileSignature className="w-3.5 h-3.5 text-blue-600" />
              Real Estate &amp; Conveyancing, South Africa
            </p>
            <p>&copy; {new Date().getFullYear()} SineThamsanqa Business Solutions. All rights reserved.</p>
            <p>
              <a href="https://www.cloudst.co.za" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1">
                www.cloudst.co.za <ArrowRight className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Floating mobile CTA */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-ink-900/95 backdrop-blur border-t border-slate-200">
        <button
          onClick={onSignIn}
          className="w-full bg-blue-600 text-ink-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" /> Sign in to CloudSTep
        </button>
      </div>
    </div>
  );
}
