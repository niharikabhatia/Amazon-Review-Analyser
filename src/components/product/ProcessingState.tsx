import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Brain, Search, Database, Fingerprint, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui';

const STEPS = [
  { id: 'fetch', label: 'Fetching Amazon reviews...', icon: Search },
  { id: 'clean', label: 'Cleaning metadata & verification...', icon: Database },
  { id: 'analyze', label: 'Analyzing qualitative sentiment...', icon: Brain },
  { id: 'clustering', label: 'Clustering common complaints...', icon: Fingerprint },
  { id: 'summary', label: 'Generating Reviews Summary...', icon: ShoppingBag },
];

export const ProcessingState = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-xl mx-auto pt-20 px-6 text-center space-y-12">
      <div className="space-y-4">
        <div className="relative inline-block">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -inset-4 bg-zinc-950/5 rounded-full blur-2xl"
          />
          <div className="relative w-20 h-20 bg-[#ff9900] rounded-3xl flex items-center justify-center shadow-2xl">
            <ShoppingBag className="w-10 h-10 text-[#232f3e] animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-[#232f3e]">Summarizing Insights...</h2>
        <p className="text-zinc-500 font-medium text-sm">Synthesizing thousands of feedback points into a concise verdict.</p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${
                isActive ? 'bg-white border-[#ff9900]/20 shadow-sm' : 'bg-[#f2f2f2]/50 border-transparent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isActive ? 'bg-[#ff9900] text-[#232f3e]' : isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'
              }`}>
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm font-black uppercase tracking-widest ${
                isActive ? 'text-[#232f3e]' : isDone ? 'text-zinc-400' : 'text-zinc-400'
              }`}>
                {step.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="ml-auto flex gap-1"
                >
                  <span className="w-1 h-1 bg-[#ff9900] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-1 bg-[#ff9900] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-1 bg-[#ff9900] rounded-full animate-bounce" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      <Card className="p-6 bg-[#232f3e] text-white border-none space-y-4 shadow-xl rounded-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff9900]">Live Analysis Stream</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm italic leading-relaxed"
          >
            {[
              "\"The battery life exceeded my expectations, but the charging port feels a bit flimsy...\"",
              "\"Initially loved the design, though 15% of users reported durability issues after 3 months.\"",
              "\"Price matches the value considering the premium build materials...\"",
              "\"Power users find the software interface slightly clunky but feature-rich.\"",
              "\"Overall verdict: High quality, premium feel, but watch out for the initial setup complexity.\""
            ][currentStep]}
          </motion.p>
        </AnimatePresence>
      </Card>
    </div>
  );
};
