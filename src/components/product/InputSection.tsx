import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '../ui';
import { Link, ShieldCheck } from 'lucide-react';

export const InputSection = ({ onAnalyze }: { onAnalyze: (products: string[]) => void }) => {
  const [url, setUrl] = useState<string>('');

  const handleSubmit = () => {
    if (url.trim() !== '') {
      onAnalyze([url]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pt-10 px-6">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#232F3E]">Add Product Link</h2>
          <p className="text-zinc-500 font-medium">Paste the Amazon product URL below to begin AI analysis.</p>
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="group relative flex items-center gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#146eb4] group-focus-within:text-[#ff9900] transition-colors">
                  <Link className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste Amazon Product URL here..."
                  className="w-full pl-12 pr-4 py-5 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#ff9900]/10 focus:border-[#ff9900] transition-all text-sm font-medium"
                />
              </div>
            </div>
          </motion.div>

          <div className="pt-8 text-center">
            <Button 
              size="lg" 
              className="px-12 py-7 text-lg w-full bg-[#146eb4] hover:bg-[#0e5a96] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg border-none" 
              onClick={handleSubmit}
              disabled={!url.trim()}
            >
              Analyze Product Reviews
            </Button>
            <div className="mt-6 p-4 bg-[#f2f2f2] rounded-xl border border-zinc-100">
               <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-2 font-black uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4 text-[#ff9900]" /> 
                  Premium Unbiased Data Extraction
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
