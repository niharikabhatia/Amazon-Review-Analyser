/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/layout/Header';
import { Hero } from './components/landing/Hero';
import { InputSection } from './components/product/InputSection';
import { ProcessingState } from './components/product/ProcessingState';
import { ProductCard } from './components/product/ProductCard';
import { ProductSummary } from './types';
import { Button } from './components/ui';
import { ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';

type AppState = 'LANDING' | 'INPUT' | 'PROCESSING' | 'DASHBOARD';

export default function App() {
  const [state, setState] = useState<AppState>('LANDING');
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = async (products: string[]) => {
    setState('PROCESSING');
    setError(null);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: products.map(p => ({ name: p })) }),
      });

      if (!response.ok) throw new Error('Analysis failed');
      
      const data = await response.json();
      setResults(data.products);
      setState('DASHBOARD');
    } catch (err) {
      console.error(err);
      setError('Something went wrong during analysis. Please check your links and try again.');
      setState('INPUT');
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] font-sans text-[#232f3e] selection:bg-[#ff9900] selection:text-[#232f3e]">
      <Header onStart={() => setState('INPUT')} />
      
      <main className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {state === 'LANDING' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Hero onStart={() => setState('INPUT')} />
            </motion.div>
          )}

          {state === 'INPUT' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pb-20"
            >
              <div className="pt-24 px-6">
                 <button 
                   onClick={() => setState('LANDING')}
                   className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-950 transition-colors text-sm font-medium"
                 >
                   <ArrowLeft className="w-4 h-4" /> Back to Home
                 </button>
                 <InputSection onAnalyze={startAnalysis} />
                 {error && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="max-w-2xl mx-auto mt-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 text-rose-700 text-sm"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p>{error}</p>
                      <Button variant="ghost" size="sm" className="ml-auto text-rose-700 hover:bg-rose-100" onClick={() => setError(null)}>
                        Dismiss
                      </Button>
                    </motion.div>
                 )}
              </div>
            </motion.div>
          )}

          {state === 'PROCESSING' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProcessingState />
            </motion.div>
          )}

          {state === 'DASHBOARD' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-24 px-6 pb-20 space-y-12"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                   <h2 className="text-2xl font-black uppercase tracking-tight text-[#232F3E]">Review Analysis</h2>
                   <p className="text-zinc-500 font-medium text-sm">Verified insights for &ldquo;{results[0]?.name || 'Product'}&rdquo;</p>
                </div>
              </div>

              <div className="space-y-12">
                 {results.map((product, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                       <ProductCard product={product} />
                    </motion.div>
                 ))}
              </div>

              <div className="pt-12 border-t border-zinc-100 text-center space-y-6">
                 <p className="text-zinc-500 text-sm italic">&ldquo;AI models can occasionally hallucinate specific minor details. Always verify critical safety specifications.&rdquo;</p>
                 <Button variant="secondary" onClick={() => setState('INPUT')}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Analyze New Product
                 </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Subtle Bottom Glow for Dashboard */}
      {state === 'DASHBOARD' && (
         <div className="fixed bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-white to-transparent -z-10 pointer-events-none" />
      )}
    </div>
  );
}

