import React, { useState } from 'react';
import { 
  Bell, CheckCircle2, ChevronDown, ChevronUp, Save, Eye, 
  MessageSquare, Settings, AlertTriangle, Sparkles, Smartphone
} from 'lucide-react';
import { Template, Milestone, CommunicationChannel } from '../types';
import { CloudStepHandlers } from '../lib/handlers';

interface NotificationSettingsProps {
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  handlers: CloudStepHandlers;
}

export default function NotificationSettings({ templates, setTemplates, handlers }: NotificationSettingsProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'tmpl-real-estate');
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active template
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Initialize expanded state on load
  React.useEffect(() => {
    if (activeTemplate && activeTemplate.milestones.length > 0 && !expandedMilestoneId) {
      setExpandedMilestoneId(activeTemplate.milestones[0].id);
    }
  }, [selectedTemplateId, activeTemplate, expandedMilestoneId]);

  // Update milestone template-specific preview draft message
  const handleUpdateTemplateSpec = (milestoneId: string, value: string) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== selectedTemplateId) return t;
      return {
        ...t,
        milestones: t.milestones.map(m => {
          if (m.id !== milestoneId) return m;
          return { ...m, messageTemplate: value };
        })
      };
    }));
  };

  // Update reminder frequency specifically
  const handleUpdateFrequency = (milestoneId: string, freq: any) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== selectedTemplateId) return t;
      return {
        ...t,
        milestones: t.milestones.map(m => {
          if (m.id !== milestoneId) return m;
          return { ...m, reminderFrequency: freq };
        })
      };
    }));
  };

  // Toggle active notifications channel
  const handleToggleChannel = (milestoneId: string, channel: CommunicationChannel, active: boolean) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== selectedTemplateId) return t;
      return {
        ...t,
        milestones: t.milestones.map(m => {
          if (m.id !== milestoneId) return m;
          let updatedChannels = [...m.channels];
          if (active && !updatedChannels.includes(channel)) {
            updatedChannels.push(channel);
          } else if (!active) {
            updatedChannels = updatedChannels.filter(c => c !== channel);
          }
          return { ...m, channels: updatedChannels };
        })
      };
    }));
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT COLUMN: Milestone Accordion settings list */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div id="notif-settings-header" className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm font-display">Client Notifications Setup</h3>
            <p className="text-xs text-slate-500">Configure delivery drafts and schedule criteria per milestone step.</p>
          </div>
          <select 
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="text-xs font-bold px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none cursor-pointer"
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSaveAll} className="space-y-3">
          {activeTemplate?.milestones.map((m) => {
            const isExpanded = expandedMilestoneId === m.id;
            const hasWhatsApp = m.channels.includes('WhatsApp');
            const hasSMS = m.channels.includes('SMS');
            const hasEmail = m.channels.includes('Email');

            return (
              <div 
                key={m.id} 
                className={`border rounded-xl transition-all ${
                  isExpanded ? 'border-blue-600/35 shadow-xs bg-slate-50/20' : 'border-slate-200'
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => setExpandedMilestoneId(isExpanded ? null : m.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      m.channels.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                    }`} />
                    <span className="font-bold text-xs text-slate-800">{m.title}</span>
                  </div>

                  <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                    {/* Compact quick indicators (Email/SMS/WhatsApp toggle bullets) */}
                    <div className="flex gap-1 items-center">
                      <button 
                        type="button"
                        onClick={() => handleToggleChannel(m.id, 'WhatsApp', !hasWhatsApp)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                          hasWhatsApp 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-white text-slate-400 border-slate-200 line-through'
                        }`}
                        title="WhatsApp Status"
                      >
                        WA
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleToggleChannel(m.id, 'SMS', !hasSMS)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                          hasSMS 
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200' 
                            : 'bg-white text-slate-400 border-slate-200 line-through'
                        }`}
                        title="SMS Status"
                      >
                        SMS
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleToggleChannel(m.id, 'Email', !hasEmail)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                          hasEmail 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-white text-slate-400 border-slate-200 line-through'
                        }`}
                        title="Email Status"
                      >
                        Mail
                      </button>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setExpandedMilestoneId(isExpanded ? null : m.id)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/50 border-t border-slate-200 rounded-b-xl space-y-3.5">
                    
                    {/* Message Preview field */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Message Preview:</label>
                      <textarea 
                        value={m.messageTemplate}
                        onChange={(e) => handleUpdateTemplateSpec(m.id, e.target.value)}
                        rows={3}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                        placeholder="Type update message..."
                      />
                    </div>

                    {/* Freq selection block */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-600">Reminder Frequency:</span>
                        <select 
                          value={m.reminderFrequency}
                          onChange={(e) => handleUpdateFrequency(m.id, e.target.value as any)}
                          className="text-[11px] font-semibold px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700"
                        >
                          <option value="On Event">On Event (Immediate only)</option>
                          <option value="Daily">Daily status checks</option>
                          <option value="Weekly">Weekly Friday summaries</option>
                          <option value="Fortnightly">Fortnightly updates</option>
                        </select>
                      </div>
                      
                      <span className="text-[10px] text-slate-400 italic">
                        Estimated: {m.estimatedDuration} to complete.
                      </span>
                    </div>

                  </div>
                )}
              </div>
            );
          })}

          <div id="btn-save-settings-container" className="flex items-center justify-between pt-4 border-t border-slate-200">
            {saveSuccess ? (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                ✔ Settings applied successfully!
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                Configure details that fit your South African client workflow.
              </span>
            )}
            <button 
              type="submit"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-105"
            >
              <Save className="w-3.5 h-3.5" /> Save Settings
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: Interactive Smartphone Phone Preview Screen */}
      <div className="lg:col-span-5 flex flex-col justify-center">
        {(() => {
          const activeMilestone = activeTemplate?.milestones.find(m => m.id === expandedMilestoneId) || activeTemplate?.milestones[0];
          
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 px-1 justify-center lg:justify-start">
                <Smartphone className="w-4.5 h-4.5 text-blue-600" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-display">
                  Live Mobile UI Update Review
                </h4>
              </div>

              {activeMilestone ? (
                <div id="simulated-smartphone" className="relative mx-auto w-[280px] h-[540px] bg-slate-950 rounded-[40px] p-3.5 shadow-2xl border-4 border-slate-800">
                  {/* Speaker slot */}
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full z-20 flex justify-center items-center">
                    <div className="w-8 h-1 bg-slate-800 rounded-full" />
                  </div>

                  {/* Inner phone screen contents */}
                  <div className="w-full h-full bg-slate-900 rounded-[28px] overflow-hidden flex flex-col relative pt-7">
                    
                    {/* Mock Status Header */}
                    <div className="flex justify-between items-center px-4 py-1 text-[10px] text-slate-400 font-mono select-none">
                      <span>15:03</span>
                      <div className="flex gap-1 items-center">
                        <span>📶</span>
                        <span>5G</span>
                        <span>🔋 92%</span>
                      </div>
                    </div>

                    {/* WhatsApp Conversation Simulator Interface */}
                    <div className="flex-1 bg-[#ebe5df] flex flex-col justify-between">
                      
                      {/* WA Chat header */}
                      <div className="bg-[#075e54] text-white p-2.5 flex items-center gap-2 shadow-xs">
                        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase select-none">
                          CS
                        </div>
                        <div>
                          <p className="text-[11px] font-bold">CloudSteps Agent</p>
                          <p className="text-[8px] text-emerald-202">Online • POPIA Verified</p>
                        </div>
                      </div>

                      {/* Conversation thread */}
                      <div className="flex-1 p-3 overflow-y-auto space-y-4 flex flex-col justify-end">
                        
                        {/* Interactive date stamp */}
                        <div className="self-center bg-white/70 backdrop-blur-xs px-2 py-0.5 rounded text-[8px] text-slate-500 font-medium font-sans">
                          TODAY
                        </div>

                        {/* Customer representative message bubble */}
                        <div className="self-start max-w-[85%] bg-white rounded-lg p-2.5 shadow-xs text-slate-800 text-[10px] leading-relaxed relative">
                          <p className="font-bold text-[8px] text-[#075e54] mb-0.5">Welcome Greeting</p>
                          <p className="text-slate-600">
                            Hi there! You will receive automated, secure SMS and WhatsApp updates about your project transfer stages here. Let's make it simple.
                          </p>
                          <span className="text-[7px] text-slate-400 text-right block mt-1">15:01 ✓✓</span>
                        </div>

                        {/* Simulated Active Milestone Preview Message Bubble */}
                        <div className="self-start max-w-[85%] bg-[#dcf8c6] rounded-lg p-2.5 shadow-xs text-slate-800 text-[10px] leading-relaxed relative border-l-2 border-emerald-500">
                          <p className="font-bold text-[8px] text-emerald-700 uppercase tracking-wider mb-1">
                            📢 {activeMilestone.title}
                          </p>
                          <p className="text-slate-800 font-medium">
                            {/* Simple replacements of brackets so user sees real values */}
                            {activeMilestone.messageTemplate
                              .replace(/{name}/g, "John & Sarah")
                              .replace(/{reference}/g, "ERF 1245 Bryanston")
                              .replace(/{company}/g, "SineThamsanqa Agency")}
                          </p>
                          <span className="text-[7px] text-slate-400 text-right block mt-1">15:03 ✓✓</span>
                        </div>

                      </div>

                      {/* Mock Chat input bar */}
                      <div className="bg-slate-100 p-2 flex items-center gap-1.5">
                        <div className="flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-slate-400 select-none">
                          Reply securely...
                        </div>
                        <div className="w-6 h-6 bg-[#075e54] text-white rounded-full flex items-center justify-center text-xs">
                          🎤
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
                  Expand a milestone on the left column to view simulated mobile WhatsApp update layout.
                </div>
              )}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
