import React from 'react';
import { motion } from 'motion/react';
import { ProductSummary } from '../../types';
import { Badge, Card, Button } from '../ui';
import { 
  Star, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Target,
  Sparkles
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export const ProductCard = ({ product }: { product: ProductSummary }) => {
  if (product.error) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 p-12 text-center space-y-6 rounded-[2.5rem]">
        <div className="mx-auto w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center animate-pulse">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <div className="space-y-3 max-w-md mx-auto">
           <h3 className="text-sm font-black text-rose-900 uppercase tracking-[0.2em]">Extraction Error</h3>
           <p className="text-rose-800 text-lg font-bold leading-relaxed">
             {product.error}
           </p>
           <p className="text-rose-600 text-xs font-medium">
             Verify the link is a valid Amazon product page with reviews.
           </p>
        </div>
      </Card>
    );
  }

  const sentimentData = [
    { name: 'Positive', value: product.sentiment.positive, color: '#10b981' },
    { name: 'Mixed', value: product.sentiment.mixed, color: '#f59e0b' },
    { name: 'Negative', value: product.sentiment.negative, color: '#ef4444' },
  ];

  const radarData = [
    { subject: 'Durability', A: 85, fullMark: 100 },
    { subject: 'Fit', A: 90, fullMark: 100 },
    { subject: 'Reliability', A: 75, fullMark: 100 },
    { subject: 'Value', A: 80, fullMark: 100 },
  ];

  return (
    <Card className="group hover:shadow-[0_20px_50px_rgba(255,153,0,0.08)] transition-all duration-500 border-zinc-100">
      <div className="p-8">
        {/* Reviews Summary (Prominent at top) */}
        <div className="relative p-6 bg-[#FEBD69]/10 border-2 border-[#FF9900]/20 rounded-3xl overflow-hidden group/verdict mb-8 shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Zap className="w-24 h-24 text-[#FF9900]" />
          </div>
          <div className="relative z-10 space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#FF9900]">✅ AI Verdict</h4>
                <Badge className="bg-[#FF9900] text-[#232F3E] border-none text-[10px] font-black">DECISION LOGIC</Badge>
             </div>
             <p className="text-lg font-bold leading-relaxed tracking-tight text-[#232F3E]">
                &ldquo;{product.aiVerdict.summary}&rdquo;
             </p>
          </div>
        </div>

        {/* Apify Official AI Summary (Optional) */}
        {product.apifyAiSummary && (
          <div className="mb-8 p-6 bg-zinc-50 border border-zinc-200 rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-400" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Amazon AI Summary (Beta)</h4>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed italic">
              {product.apifyAiSummary.summary}
            </p>
            {(product.apifyAiSummary.pros?.length || 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.apifyAiSummary.pros?.slice(0, 3).map((pro, i) => (
                  <span key={i} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md leading-none lowercase">+{pro}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-52 flex-shrink-0 aspect-square rounded-3xl bg-white border border-zinc-100 p-6 flex items-center justify-center shadow-sm">
            <img
              src={product.imageUrl || "/package-placeholder.png"}
              alt={product.name}
              className="max-h-full w-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <Badge className="bg-[#232F3E] text-white mb-2 font-bold">{product.category}</Badge>
                <h3 className="text-2xl font-bold tracking-tight text-[#232F3E] leading-tight">
                  {product.name}
                </h3>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-[#FF9900]">
                  <Star className="w-5 h-5 fill-current" />
                  <span className="text-lg font-bold text-[#232F3E]">{product.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-400 text-xs font-bold">
                  <Users className="w-3 h-3" /> {product.reviewCount.toLocaleString()} reviews
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button 
                size="sm" 
                className="rounded-xl px-6 bg-[#146eb4] hover:bg-[#0e5a96] text-white font-bold border-none"
                onClick={() => window.open(product.productUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" /> Buy on Amazon
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12 pt-8 border-t border-zinc-100">
          {/* Sentiment Analysis */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
               ⭐ Overall Sentiment
            </h4>
            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <div className="text-2xl font-black text-[#232F3E]">{product.sentiment.positive}%</div>
                <div className="text-[10px] text-zinc-400 uppercase font-black tracking-tight">Positive</div>
              </div>
            </div>
            <p className="text-xs italic text-zinc-500 leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100">
               &ldquo;{product.sentiment.overall}&rdquo;
            </p>
          </div>

          {/* User Insights */}
          <div className="space-y-4">
             <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                🧠 Real User Insights
             </h4>
             <div className="space-y-4">
                {Object.entries(product.realUserInsights || {}).map(([key, value]) => (
                   <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase text-[#232F3E]">{key.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-snug">{value}</p>
                   </div>
                ))}
             </div>
          </div>

          {/* Pros & Cons */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#10b981] flex items-center gap-2">
                👍 What Users Liked
              </h4>
              <ul className="space-y-2">
                {(product.highlights || []).map((h, i) => (
                  <li key={i} className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-medium flex items-center gap-2">
                     <span className="w-1 h-1 bg-emerald-400 rounded-full" /> 
                     <span>{typeof h === 'string' ? h : h.label}</span>
                     {typeof h === 'object' && h.frequency && (
                       <span className="opacity-50 text-[10px] ml-auto">{h.frequency}</span>
                     )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                👎 Common Complaints
              </h4>
              <ul className="space-y-2">
                {(product.commonComplaints || []).map((c, i) => (
                  <li key={i} className="text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg font-medium flex items-center gap-2">
                     <span className="w-1 h-1 bg-rose-400 rounded-full" /> 
                     <span>{typeof c === 'string' ? c : c.label}</span>
                     {typeof c === 'object' && c.frequency && (
                       <span className="opacity-50 text-[10px] ml-auto">{c.frequency}</span>
                     )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Audience Fit */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-zinc-100 pt-8">
           <div className="space-y-4 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
              <h4 className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                 🎯 Best For
              </h4>
              <ul className="space-y-2">
                 {product.buyerFit.bestFor.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                       <ChevronRight className="w-4 h-4 mt-0.5 text-emerald-300 flex-shrink-0" />
                       {item}
                    </li>
                 ))}
              </ul>
           </div>
           <div className="space-y-4 p-6 bg-rose-50/50 rounded-2xl border border-rose-100/50">
              <h4 className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                 ⚠️ Not Ideal For
              </h4>
              <ul className="space-y-2">
                 {product.buyerFit.notIdealFor.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-rose-800">
                       <ChevronRight className="w-4 h-4 mt-0.5 text-rose-300 flex-shrink-0" />
                       {item}
                    </li>
                 ))}
              </ul>
           </div>
        </div>

        {/* Raw Reviews Section */}
        {product.reviews && product.reviews.length > 0 && (
          <div className="mt-12 border-t border-zinc-100 pt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                 📝 Selected Reviews ({product.reviews.length})
              </h4>
              <span className="text-[10px] text-zinc-400 font-medium">Real user descriptions</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {product.reviews.map((review, i) => (
                <div key={i} className="p-5 bg-zinc-50 border border-zinc-100 rounded-3xl space-y-3 hover:bg-white hover:border-[#FF9900]/30 hover:shadow-xl transition-all duration-500 group/review">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, starIdx) => {
                         const rating = Math.round(review.rating);
                         return (
                           <Star 
                             key={starIdx} 
                             className={`w-3 h-3 ${starIdx < rating ? 'fill-[#FF9900] text-[#FF9900]' : 'text-zinc-200'}`} 
                           />
                         );
                      })}
                    </div>
                    {review.verified && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black h-4 px-1 inline-flex items-center uppercase">Verified</Badge>
                    )}
                  </div>
                  {review.title && <h5 className="text-[11px] font-black text-[#232F3E] leading-tight line-clamp-2">{review.title}</h5>}
                  <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-6 group-hover/review:line-clamp-none transition-all duration-300">
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
