import React from 'react';
import { ProductSummary } from '../../types';
import { Card, Badge } from '../ui';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, DollarSign, Zap, Package } from 'lucide-react';

export const ComparisonView = ({ products }: { products: ProductSummary[] }) => {
  const validProducts = products.filter(p => !p.error);

  if (validProducts.length === 0) {
    return (
      <Card className="p-12 text-center border-zinc-100 bg-zinc-50/50 rounded-[2.5rem]">
        <AlertCircle className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-zinc-900">No valid products to compare</h3>
        <p className="text-zinc-500 max-w-sm mx-auto mt-2 italic">
          Try analyzing valid Amazon product links to see a side-by-side comparison.
        </p>
      </Card>
    );
  }

  const getInsightText = (product: ProductSummary, topic: string) => {
    const insights = product.realUserInsights;
    if (!insights) return '';
    if (topic === 'Durability') return insights.durability;
    if (topic === 'Usability') return insights.fit_usability;
    if (topic === 'Reliability') return insights.reliability;
    if (topic === 'Value') return insights.value_for_money;
    return '';
  };

  const attributeLabels = ['Durability', 'Usability', 'Reliability', 'Value'];

  return (
    <div className="w-full space-y-8 overflow-x-auto pb-8">
      <div className="min-w-[800px] space-y-6">
        <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-4 items-end px-4">
          <div className="pb-4">
            <h3 className="text-xl font-black tracking-tight text-[#232F3E]">Comparison Matrix</h3>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black mt-1">Direct Side-by-Side</p>
          </div>
          {validProducts.map((p, i) => (
            <div key={i} className="space-y-4 text-center">
              <div className="aspect-square bg-white rounded-2xl p-4 flex items-center justify-center border border-zinc-100 mx-auto w-32 relative group shadow-sm">
                {p.imageUrl ? (
                  <img 
                    src={p.imageUrl} 
                    className="max-h-full object-contain group-hover:scale-105 transition-all mix-blend-multiply" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Package className="w-8 h-8 text-zinc-300" />
                )}
                {i === 0 && (
                   <div className="absolute -top-3 -right-3 bg-[#FF9900] text-[#232F3E] p-2 rounded-xl shadow-xl z-20">
                     <Zap className="w-4 h-4 fill-[#232F3E] text-[#232F3E]" />
                   </div>
                )}
              </div>
              <h4 className="text-sm font-bold text-[#232F3E] flex-shrink-0 line-clamp-2 px-2 h-10">{p.name}</h4>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {/* Sentiment Row */}
          <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-4 p-4 rounded-2xl bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all items-center">
             <div className="flex items-center gap-2 font-black text-zinc-400 uppercase tracking-tighter text-[10px]">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Sentiment Range
             </div>
             {validProducts.map((p, i) => (
                <div key={i} className="text-center">
                   <div className="text-lg font-black text-emerald-600">{p.sentiment.positive}%</div>
                </div>
             ))}
          </div>

          {attributeLabels.map((attr, idx) => (
             <div 
               key={idx}
               className={`grid grid-cols-[200px_repeat(5,1fr)] gap-4 p-4 rounded-2xl transition-all items-start border border-transparent hover:border-zinc-100 hover:bg-zinc-50 ${idx % 2 === 0 ? '' : 'bg-zinc-50'}`}
             >
                <div className="flex items-center gap-2 font-black text-zinc-400 uppercase tracking-tighter text-[10px] mt-1">
                   {attr} Insight
                </div>
                {validProducts.map((p, i) => {
                  const text = getInsightText(p, attr);
                  return (
                    <div key={i} className="text-[11px] text-zinc-600 leading-snug px-2 text-center h-full flex items-center justify-center italic">
                       {text}
                    </div>
                  );
                })}
             </div>
          ))}

          {/* AI Verdict Winner */}
          <div className="grid grid-cols-[200px_repeat(5,1fr)] gap-4 p-6 rounded-3xl bg-[#232F3E] text-white mt-4 items-center shadow-lg">
             <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF9900]">Amazon Choice</span>
                <span className="font-bold italic">Top Verdict</span>
             </div>
             {validProducts.map((p, i) => (
                <div key={i} className="text-center space-y-2">
                   {i === 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#FF9900] text-[#232F3E] text-[10px] font-black uppercase rounded-md tracking-tighter">
                        <Zap className="w-3 h-3 fill-[#232F3E] text-[#232F3E]" /> Best Choice
                      </div>
                   ) : (
                      <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Alternative</div>
                   )}
                   <p className="text-[11px] leading-relaxed text-zinc-300 line-clamp-3 italic">
                      &ldquo;{p.aiVerdict.summary}&rdquo;
                   </p>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};
