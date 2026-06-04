import React, { useState } from 'react';
import { INDUSTRY_META } from '../data';
import { createClerkSupabaseClient } from '../lib/supabase';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Building2 } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!selectedIndustry || !user) return;
    
    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        alert("Failed to get authentication token. Please check your Clerk JWT template configuration.");
        setLoading(false);
        return;
      }

      const supabase = createClerkSupabaseClient(token);
      
      const { error } = await supabase
        .from('users')
        .upsert({ 
          id: user.id, 
          industry: selectedIndustry 
        });

      if (error) {
        console.error("Error saving profile:", error);
        alert(`Failed to save profile: ${error.message}`);
      } else {
        onComplete();
      }
    } catch (err: any) {
      console.error("Onboarding error:", err);
      alert(`An error occurred: ${err.message || 'Check console for details'}. Ensure your Supabase environment variables are prefixed with VITE_ in .env.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-lg w-full">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden bg-slate-50 border border-slate-100 shadow-sm p-1">
            <img src="/favicon.png" alt="CloudSTep Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Welcome to CloudSTep</h1>
        <p className="text-center text-slate-500 mb-8">
          To tailor your workspace, please select your primary industry focus.
        </p>

        <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto pr-2">
          {Object.entries(INDUSTRY_META).map(([key, meta]) => (
            <div 
              key={key}
              onClick={() => setSelectedIndustry(key)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedIndustry === key 
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                  : 'border-slate-100 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg} ${meta.color}`}>
                  {/* Icon component mapping normally goes here, but using placeholder for simplicity */}
                  <div className="font-bold text-xl">{meta.label[0]}</div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{meta.label}</h3>
                  <p className="text-xs text-slate-500">Customized templates for {key}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!selectedIndustry || loading}
          className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all shadow-md ${
            !selectedIndustry || loading
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
          }`}
        >
          {loading ? 'Setting up workspace...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}
