import React, { useState } from 'react';
import { 
  Plus, Trash2, ArrowRight, Save, Play, RefreshCw, 
  Settings, Mail, MessageSquare, Phone, Info, LayoutList
} from 'lucide-react';
import { Template, Milestone, Industry, CommunicationChannel } from '../types';
import { INDUSTRY_META } from '../data';
import { CloudStepHandlers } from '../lib/handlers';

interface TemplateBuilderProps {
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  handlers: CloudStepHandlers;
}

export default function TemplateBuilder({ templates, setTemplates, handlers }: TemplateBuilderProps) {
  // State variables
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tmpl-real-estate');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  
  // Create / Clone New template state
  const [isCreatingNewTemplate, setIsCreatingNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateIndustry, setNewTemplateIndustry] = useState<Industry>('real-estate');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  // Debounced auto-save: any change to a template is persisted to Supabase after 1s of idle
  React.useEffect(() => {
    const timer = setTimeout(() => {
      templates.forEach(t => {
        handlers.saveTemplate(t).catch(e => {
          handlers.pushToast({ kind: 'error', title: 'Could not save template', body: e?.message ?? 'Unknown error' });
        });
      });
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  // Active template lookup
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Auto-select first milestone of template on change
  React.useEffect(() => {
    if (activeTemplate && activeTemplate.milestones.length > 0) {
      setSelectedMilestoneId(activeTemplate.milestones[0].id);
    } else {
      setSelectedMilestoneId(null);
    }
  }, [selectedTemplateId, activeTemplate]);

  // Selected milestone details mapping
  const activeMilestone = activeTemplate?.milestones.find(m => m.id === selectedMilestoneId) || activeTemplate?.milestones[0];

  // Update a field on the current active milestone of the active template
  const handleUpdateMilestoneField = (field: keyof Milestone, value: any) => {
    if (!activeTemplate || !selectedMilestoneId) return;

    setTemplates(prev => prev.map(tmpl => {
      if (tmpl.id !== activeTemplate.id) return tmpl;
      return {
        ...tmpl,
        milestones: tmpl.milestones.map(m => {
          if (m.id !== selectedMilestoneId) return m;
          return { ...m, [field]: value };
        })
      };
    }));
  };

  // Toggle communication channel checkbox
  const handleToggleChannel = (chan: CommunicationChannel) => {
    if (!activeMilestone) return;

    let nextChannels = [...activeMilestone.channels];
    if (nextChannels.includes(chan)) {
      nextChannels = nextChannels.filter(c => c !== chan);
    } else {
      nextChannels.push(chan);
    }

    handleUpdateMilestoneField('channels', nextChannels);
  };

  // Add a new milestone step onto the active template flow sequence
  const handleAddMilestoneStep = () => {
    if (!activeTemplate) return;

    const newMilestone: Milestone = {
      id: `m-step-${Date.now()}`,
      title: 'New Milestones Stage',
      dueInDays: 7,
      reminderFrequency: 'Weekly',
      channels: ['Email'],
      messageTemplate: 'Hi {name}, we are happy to report that we have reached the stage of {reference}. We will contact you with further details.',
      status: 'Pending',
      estimatedDuration: '5-7 Days'
    };

    setTemplates(prev => prev.map(tmpl => {
      if (tmpl.id !== activeTemplate.id) return tmpl;
      return {
        ...tmpl,
        milestones: [...tmpl.milestones, newMilestone]
      };
    }));

    setSelectedMilestoneId(newMilestone.id);
  };

  // Remove a milestone step from the sequence
  const handleDeleteMilestoneStep = (mId: string) => {
    if (!activeTemplate) return;
    if (activeTemplate.milestones.length <= 1) {
      alert('A workflow must maintain at least one milestone step');
      return;
    }

    setTemplates(prev => prev.map(tmpl => {
      if (tmpl.id !== activeTemplate.id) return tmpl;
      return {
        ...tmpl,
        milestones: tmpl.milestones.filter(m => m.id !== mId)
      };
    }));

    // Auto balance selected milestone index
    const remaining = activeTemplate.milestones.filter(m => m.id !== mId);
    setSelectedMilestoneId(remaining[0]?.id || null);
  };

  // Master Template Creater
  const handleCreateTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName) return;

    const newTmpl: Template = {
      id: `tmpl-${Date.now()}`,
      name: newTemplateName,
      industry: newTemplateIndustry,
      description: newTemplateDesc || 'Custom workspace automated workflow.',
      milestones: [
        {
          id: `m-step-${Date.now()}-1`,
          title: 'Initial Registration',
          dueInDays: 3,
          reminderFrequency: 'On Event',
          channels: ['Email', 'WhatsApp'],
          messageTemplate: 'Hello {name}, your process {reference} has successfully completed initial sign-off.',
          status: 'In Progress',
          estimatedDuration: '2-4 Days'
        }
      ]
    };

    setTemplates(prev => [newTmpl, ...prev]);
    setSelectedTemplateId(newTmpl.id);
    setSelectedMilestoneId(newTmpl.milestones[0].id);

    // Reset 
    setNewTemplateName('');
    setNewTemplateDesc('');
    setIsCreatingNewTemplate(false);
  };

  return (
    <div className="space-y-6">

      {/* Selector and Main template metadata */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-blue-600 animate-spin-slow" />
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm">Select Workflow Template to View/Customize</h3>
            <div className="flex gap-2">
              <select 
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-705 outline-none cursor-pointer"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.industry.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <button 
            id="btn-new-template"
            onClick={() => setIsCreatingNewTemplate(true)}
            className="text-xs bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Custom Master Template
          </button>
        </div>
      </div>

      {isCreatingNewTemplate && (
        <form onSubmit={handleCreateTemplateSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="font-bold text-slate-850 text-sm">Initialize New Automated Business Workflow</h4>
            <button 
              type="button" 
              onClick={() => setIsCreatingNewTemplate(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Master Scheme Name *</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Sectional Title Registration or Bond Approval Process" 
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">South African Industry Sector</label>
              <select 
                value={newTemplateIndustry}
                onChange={(e) => setNewTemplateIndustry(e.target.value as Industry)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white cursor-pointer"
              >
                <option value="real-estate">Real Estate & Conveyancing</option>
                <option value="legal">Law Firm Corporate litigation</option>
                <option value="financial">Wealth Advisory Onboarding</option>
                <option value="automotive">Automotive Dealership Finance</option>
                <option value="construction">Construction Wet-works Stages</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Master Description</label>
              <input 
                type="text" 
                placeholder="Brief purpose of this template" 
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none bg-white focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => setIsCreatingNewTemplate(false)}
              className="px-3.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Blueprint Setup & Start
            </button>
          </div>
        </form>
      )}

      {/* FLOW TIMELINE GRAPH / HORIZONTAL FLOW */}
      <div id="flow-timeline-container" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-bold text-slate-900 text-sm font-display">Client Journey Interactive Flow</h4>
            <p className="text-xs text-slate-500">Visual mapping sequence. Click any box to customize step parameters below.</p>
          </div>
          <button 
            type="button"
            onClick={handleAddMilestoneStep}
            className="text-xs text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 font-bold flex items-center gap-1 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Add Step Box
          </button>
        </div>

        {/* Outer scrolling content */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-center gap-4 min-w-max px-2 py-4">
            {activeTemplate?.milestones.map((m, index) => {
              const isActive = m.id === selectedMilestoneId;
              return (
                <React.Fragment key={m.id}>
                  {/* Step block */}
                  <div 
                    onClick={() => setSelectedMilestoneId(m.id)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all relative w-48 hover:-translate-y-1 ${
                      isActive 
                        ? 'bg-gradient-to-br from-blue-50/20 to-white border-2 border-blue-600 shadow-md ring-4 ring-blue-50' 
                        : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Circle badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {index + 1}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMilestoneStep(m.id);
                        }}
                        className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                        title="Delete this milestone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h5 className="font-bold text-xs text-slate-800 line-clamp-1 mb-1">{m.title}</h5>
                    <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      ⌛ {m.estimatedDuration}
                    </p>

                    <div className="mt-2.5 flex gap-1 justify-end flex-wrap">
                      {m.channels.map(chan => (
                        <span key={chan} className="text-[8px] bg-white border border-slate-200 px-1 py-0.2 rounded font-bold text-slate-600 uppercase">
                          {chan}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Connector arrow */}
                  {index < activeTemplate.milestones.length - 1 && (
                    <div className="flex items-center text-slate-300">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* MILESTONE SETTINGS DIALOG (Bottom layout) */}
      {activeMilestone ? (
        <div id="milestone-settings-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h4 className="font-bold text-slate-900 font-display text-sm flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-blue-600" />
              Settings for Selected Step: "{activeMilestone.title}"
            </h4>
            <span className="text-xs font-mono text-slate-400">ID Reference: {activeMilestone.id}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Form details input (Left Column) */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Milestone Step Title *</label>
                <input 
                  type="text" 
                  value={activeMilestone.title}
                  onChange={(e) => handleUpdateMilestoneField('title', e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Complete Due In (Expected) *</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={activeMilestone.dueInDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        handleUpdateMilestoneField('dueInDays', val);
                        handleUpdateMilestoneField('estimatedDuration', val <= 1 ? '1 Day' : val < 7 ? `${val} Days` : `${Math.round(val/7)} Weeks`);
                      }}
                      className="w-16 text-xs px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                    />
                    <select 
                      value={activeMilestone.estimatedDuration}
                      onChange={(e) => handleUpdateMilestoneField('estimatedDuration', e.target.value)}
                      className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-slate-700 bg-slate-50 cursor-pointer"
                    >
                      <option value="1 Day">1 Day</option>
                      <option value="2-4 Days">2-4 Days</option>
                      <option value="5-7 Days">5-7 Days</option>
                      <option value="1-2 Weeks">1-2 Weeks</option>
                      <option value="2-3 Weeks">2-3 Weeks</option>
                      <option value="4-6 Weeks">4-6 Weeks</option>
                      <option value="1-3 Months">1-3 Months</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Reminder Alerts Engine Freq</label>
                  <select 
                    value={activeMilestone.reminderFrequency}
                    onChange={(e) => handleUpdateMilestoneField('reminderFrequency', e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none text-slate-700 bg-slate-50 cursor-pointer"
                  >
                    <option value="On Event">On Event (Immediate only)</option>
                    <option value="Daily">Daily Status Sweep</option>
                    <option value="Weekly font">Weekly Standard Progress</option>
                    <option value="Fortnightly">Fortnightly Audit Update</option>
                  </select>
                </div>
              </div>

              {/* Message text area */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Automated Updates Script Template
                </label>
                <textarea 
                  value={activeMilestone.messageTemplate}
                  onChange={(e) => handleUpdateMilestoneField('messageTemplate', e.target.value)}
                  rows={3}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 font-sans"
                  placeholder="Insert placeholders: {name} (Client Name), {reference} (ERF Property or vehicle) or {company}"
                />
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
                  <Info className="w-3.5 h-3.5" />
                  <span>Insert bracket items: <code className="bg-slate-150 text-slate-700 px-1 py-0.5 rounded font-bold font-mono text-[9px]">{`{name}`}</code>, <code className="bg-slate-150 text-slate-700 px-1 py-0.5 rounded font-bold font-mono text-[9px]">{`{reference}`}</code> for macro replacement.</span>
                </div>
              </div>
            </div>

            {/* Automation communication channels (Right Column) */}
            <div className="md:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
              <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Trigger Notification Channels</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Choose the communication integrations for automated SA delivery. Clients will only be pinged across the enabled lines.
              </p>

              <div className="space-y-2.5">
                {/* Whatsapp */}
                <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                      <MessageSquare className="w-1.5 h-1.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">WhatsApp South Africa</p>
                      <p className="text-[9px] text-slate-400 font-medium">Deliver progress update directly to WhatsApp conversations</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={activeMilestone.channels.includes('WhatsApp')}
                    onChange={() => handleToggleChannel('WhatsApp')}
                    className="rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                  />
                </label>

                {/* SMS */}
                <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-cyan-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-cyan-50 text-cyan-600 rounded">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Automated SMS</p>
                      <p className="text-[9px] text-slate-400 font-medium">Direct carrier text delivery for simple offline updates</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={activeMilestone.channels.includes('SMS')}
                    onChange={() => handleToggleChannel('SMS')}
                    className="rounded text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                </label>

                {/* Email */}
                <label className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Standard Email</p>
                      <p className="text-[9px] text-slate-400 font-medium">Sends beautiful comprehensive HTML briefs & pdf attachments</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={activeMilestone.channels.includes('Email')}
                    onChange={() => handleToggleChannel('Email')}
                    className="rounded text-blue-500 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-105 flex items-start gap-2 text-[10px] text-slate-650">
                <span>🛡️</span>
                <span>Both WhatsApp and SMS trigger automatic local South African telecom network checks to preserve secure FICA and POPIA integrity.</span>
              </div>
            </div>

          </div>

          {/* Master save indicators */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-250">
            <span className="text-[11px] text-emerald-750 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              ✔ Autoload Saved — changes carry for all new clients assigned to {activeTemplate?.name}.
            </span>
          </div>

        </div>
      ) : (
        <div id="milestone-settings-placeholder" className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs">
          Select or add a milestone box in the flow map above to configure parameters.
        </div>
      )}

    </div>
  );
}
