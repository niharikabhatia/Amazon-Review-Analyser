import React from 'react';
import { motion } from 'motion/react';
import { Button, Card } from '../ui';
import { ArrowRight, Star, ShoppingBag, ShieldCheck, Package } from 'lucide-react';

export const Hero = ({ onStart }: { onStart: () => void }) => {
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-full h-full max-w-6xl">
        <div className="absolute top-20 left-10 w-96 h-96 bg-amber-50/50 rounded-full blur-[120px]" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-yellow-50/50 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#146eb4]/10 text-[#146eb4] text-[10px] font-black uppercase tracking-[0.2em] mb-6 border border-[#146eb4]/20">
            <ShieldCheck className="w-3 h-3 fill-current" /> Trusted Amazon Review Analyzer
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#232F3E] leading-[1.1] uppercase">
            Amazon Review <br />
            <span className="text-[#ff9900]">Summariser</span>
          </h1>
          <p className="mt-8 text-lg text-zinc-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Stop reading thousands of reviews. Get instant AI summaries, sentiment insights, and verified buyer clusters for any Amazon product.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg" onClick={onStart}>
            Analyze Reviews <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>

        {/* Social Proof / Visuals */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="pt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="p-6 text-left border-zinc-100 flex flex-col gap-4 group hover:border-[#ff9900]/30 transition-all bg-white rounded-3xl shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-[#ff9900] fill-current" />
            </div>
            <div>
              <h3 className="font-black text-[#232F3E] uppercase text-xs tracking-widest leading-none">Accurate Sentiment</h3>
              <p className="text-xs text-zinc-500 mt-2 font-medium">Clustered insights from thousands of real buyer perspectives.</p>
            </div>
          </Card>
          <Card className="p-6 text-left border-zinc-100 flex flex-col gap-4 group hover:border-[#ff9900]/30 transition-all bg-white rounded-3xl shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black text-[#232F3E] uppercase text-xs tracking-widest leading-none">Verified First</h3>
              <p className="text-xs text-zinc-500 mt-2 font-medium">Prioritizes verified purchase feedback for maximum truth.</p>
            </div>
          </Card>
          <Card className="p-6 text-left border-zinc-100 flex flex-col gap-4 group hover:border-[#ff9900]/30 transition-all bg-white rounded-3xl shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#146eb4]" />
            </div>
            <div>
              <h3 className="font-black text-[#232F3E] uppercase text-xs tracking-widest leading-none">Deep Analysis</h3>
              <p className="text-xs text-zinc-500 mt-2 font-medium">Extracting up to 50 top reviews for the most comprehensive summary possible.</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};
