export interface ProductInsight {
  topic: string;
  score: number;
  explanation: string;
}

export interface ProductHighlight {
  label: string;
  type: 'positive' | 'negative';
  frequency: string;
}

export interface Complaint {
  label: string;
  severity: 'minor' | 'critical';
  frequency: string;
}

export interface Review {
  rating: number;
  title: string;
  text: string;
  verified: boolean;
}

export interface ProductSummary {
  name: string;
  productName?: string;
  imageUrl: string;
  productUrl?: string;
  rating: number;
  reviewCount: number;
  category: string;
  price?: string;
  confidenceScore: number;
  error?: string | null;
  sentiment: {
    overall: string;
    positive: number;
    mixed: number;
    negative: number;
  };
  highlights: ProductHighlight[];
  commonComplaints: Complaint[];
  realUserInsights: {
    durability: string;
    fit_usability: string;
    reliability: string;
    value_for_money: string;
  };
  buyerFit: {
    bestFor: string[];
    notIdealFor: string[];
  };
  aiVerdict: {
    summary: string;
    confidence: 'high' | 'medium' | 'low';
  };
  apifyAiSummary?: {
    summary?: string;
    pros?: string[];
    cons?: string[];
  };
  reviews?: Review[];
}

export interface AnalysisResponse {
  products: ProductSummary[];
}
