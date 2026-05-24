import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { ApifyClient } from 'apify-client';

dotenv.config();

// Initialize clients lazily to prevent crash if keys are missing on startup
let genAI: any = null;
const getGenAI = () => {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is missing in environment variables.");
        genAI = new GoogleGenAI({ 
            apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build'
                }
            }
        });
    }
    return genAI;
};

let apifyClient: any = null;
const getApifyClient = () => {
    if (!apifyClient) {
        const token = process.env.APIFY_API_TOKEN;
        if (!token) throw new Error("APIFY_API_TOKEN is missing. Please set it in your environment/secrets.");
        apifyClient = new ApifyClient({ token });
    }
    return apifyClient;
};

// --- Helpers ---
function extractAsin(url: string): string | null {
    // Standard ASIN pattern
    const match = url.match(/(?:\/dp\/|gp\/product\/|asin\/|product\/|dp\/)([A-Z0-9]{10})/i);
    if (match) return match[1];
    
    // Short link pattern (amzn.in/d/CODE or amzn.com/ASIN)
    // For amzn.in/d/..., it might be a code that needs resolving, not an ASIN.
    // We'll let the actor handle it.
    return null;
}

function normalizeUrl(url: string): string {
    let clean = url.trim();
    if (!clean.startsWith('http')) {
        clean = 'https://' + clean;
    }
    try {
        const u = new URL(clean);
        // Special handling for amzn.in or amzn.to short links - keep them intact as they are short identifiers
        if (u.hostname.includes('amzn.in') || u.hostname.includes('amzn.to')) {
            return clean;
        }
        // Remove tracking params while keeping pathname which contains ASIN
        return `${u.origin}${u.pathname}`;
    } catch {
        return clean;
    }
}

async function resolveRedirect(url: string): Promise<string> {
    try {
        // Use GET instead of HEAD as some Amazon servers block HEAD requests
        const response = await fetch(url, { 
            method: 'GET', 
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        return response.url;
    } catch (err) {
        console.error("Error resolving redirect:", err);
        return url;
    }
}

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // API Routes
    app.post("/api/analyze", async (req, res) => {
        const { products } = req.body;

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: "No products provided" });
        }

        try {
            const results = await Promise.all(products.map(async (p: any) => {
                let rawUrl = p.name || p.url; 
                let normalizedUrl = normalizeUrl(rawUrl);
                
                // STEP 2: URL VALIDATION & REDIRECT RESOLUTION
                if (normalizedUrl.includes('amzn.in') || normalizedUrl.includes('amzn.to') || normalizedUrl.includes('a.co')) {
                    normalizedUrl = await resolveRedirect(normalizedUrl);
                }
                
                const inputAsin = extractAsin(normalizedUrl);

                try {
                    // STEP 3: APIFY REVIEW EXTRACTION
                    const client = getApifyClient();
                    
                    const isUrl = normalizedUrl.startsWith('http');
                    const input: any = {
                        maxReviews: 50,
                        proxyConfiguration: { useApifyProxy: true },
                        location: normalizedUrl.includes('.in') ? 'IN' : 'US'
                    };

                    if (isUrl) {
                        input.productUrls = [{ url: normalizedUrl }];
                    } else {
                        // User provided a product name instead of a URL
                        input.searchKeywords = normalizedUrl;
                    }

                    console.log(`Launching Junglee Review Scraper for: ${normalizedUrl} (isUrl: ${isUrl})`);
                    const run = await client.actor("junglee/amazon-reviews-scraper").call(input);
                    const { items } = await client.dataset(run.defaultDatasetId).listItems();
                    
                    if (!items || items.length === 0) {
                        console.error(`No items found for: ${normalizedUrl}`);
                        return {
                            name: rawUrl,
                            error: "Extraction Error: No data found. Verify the product link is accessible or try a more specific search term."
                        };
                    }

                    // Extract product info from the first item (apify/amazon-reviews-scraper carries metadata in items)
                    const firstItem = items[0];
                    const productTitle = firstItem.productTitle || firstItem.title || rawUrl;
                    const productImageUrl = firstItem.productImage || firstItem.thumbnail || firstItem.image || "/package-placeholder.png";
                    const productRating = firstItem.productRating || (firstItem.ratingScore || firstItem.rating) || 0;
                    const productReviewCount = firstItem.productReviewsCount || items.length;
                    
                    // Requirement: Extract Apify's internal AI summary if available
                    // The official scraper might provide this in metadata or per-product context
                    const apifyAiSummary = firstItem.aiReviewSummary || firstItem.aiReviewsSummary;

                    // Requirement: Capture ONLY extracted reviews (specifically reviewDescription)
                    let reviews = items.map(r => ({
                        rating: r.ratingScore || r.rating || r.reviewRating || 0,
                        title: r.reviewTitle || r.title || r.reviewHeader || "",
                        text: r.reviewDescription || r.text || r.reviewText || r.reviewBody || "",
                        verified: r.isVerified || r.verified || r.verifiedPurchase || false
                    }));

                    // Filter and De-duplicate
                    const seen = new Set();
                    reviews = reviews.filter(r => {
                        if (!r.text || r.text.length < 5) return false;
                        const fingerprint = r.text.substring(0, 100).toLowerCase();
                        if (seen.has(fingerprint)) return false;
                        seen.add(fingerprint);
                        return true;
                    }).slice(0, 50); // Capture exactly 50 if possible

                    if (reviews.length === 0) {
                        return {
                            name: productTitle || rawUrl,
                            error: "No written reviews found for this product. AI analysis requires text reviews."
                        };
                    }

                    // STEP 4: GEMINI AI ANALYSIS
                    // Requirement: Pass ONLY the extracted reviews to Gemini API
                    const reviewsContext = reviews.map((r: any) => 
                        `[Rating: ${r.rating}/5 | ${r.verified ? 'Verified' : 'Unverified'}] ${r.title}: ${r.text}`
                    ).join('\n\n');

                    const prompt = `Act as an expert consumer analyst. Summarize the Amazon product reviews for the product below.
                    
                    PRODUCT: ${productTitle}
                    OVERALL RATING: ${productRating} / 5
                    TOTAL REVIEWS: ${productReviewCount}
                    
                    REVIEWS TO ANALYZE (Captured 50 reviews):
                    ${reviewsContext}
                    
                    MANDATORY CONSTRAINTS:
                    - GROUNDING: Base your entire analysis ONLY on the provided reviews. Use quotes if helpful.
                    - SENTIMENT: Provide breakdown percentages (0-100) for Positive, Mixed, and Negative.
                    - HIGHLIGHTS/COMPLAINTS: Identify specific labels for what users liked and complained about.
                    - INSIGHTS: Give specific details for Durability, Usability, Reliability, and Value.
                    - VERDICT: A 3-4 sentence final buying recommendation.
                    
                    OUTPUT FORMAT: JSON ONLY
                    {
                        "productName": "Identify the precise, concise product name (under 10 words, e.g. 'Philips 10-watt LED Bulb') based on the reviews and product info",
                        "sentiment": { "overall": "...", "positive": 80, "mixed": 10, "negative": 10 },
                        "highlights": [ { "label": "Text", "type": "positive", "frequency": "..." } ],
                        "commonComplaints": [ { "label": "Text", "severity": "critical", "frequency": "..." } ],
                        "realUserInsights": { "durability": "...", "fit_usability": "...", "reliability": "...", "value_for_money": "..." },
                        "buyerFit": { "bestFor": ["..."], "notIdealFor": ["..."] },
                        "aiVerdict": { "summary": "...", "confidence": "high" }
                    }`;

                    const ai = getGenAI();
                    const response = await ai.models.generateContent({ 
                        model: "gemini-3-flash-preview",
                        contents: prompt,
                        config: { 
                            responseMimeType: "application/json",
                            // Using a higher level of thinking for better analysis
                            thinkingConfig: { thinkingLevel: "HIGH" }
                        }
                    });

                    const aiSummary = JSON.parse(response.text);

                    return {
                        name: aiSummary?.productName || productTitle || rawUrl,
                        productName: aiSummary?.productName || productTitle || rawUrl,
                        imageUrl: productImageUrl,
                        productUrl: isUrl ? normalizedUrl : (firstItem.url || firstItem.productUrl || "https://amazon.com"),
                        rating: productRating,
                        reviewCount: productReviewCount,
                        category: firstItem.category || "General",
                        price: firstItem.price?.value ? `${firstItem.price.currency}${firstItem.price.value}` : (firstItem.price || "N/A"),
                        confidenceScore: reviews.length >= 10 ? 95 : 70,
                        apifyAiSummary: apifyAiSummary ? {
                            summary: apifyAiSummary.summary || apifyAiSummary.text,
                            pros: apifyAiSummary.pros || [],
                            cons: apifyAiSummary.cons || []
                        } : undefined,
                        reviews: reviews,
                        ...aiSummary,
                        error: null
                    };

                } catch (scrapeErr: any) {
                    console.error("Scraping/AI Error for product:", scrapeErr);
                    return {
                        name: rawUrl,
                        error: "Unable to find or analyze reviews for this product right now."
                    };
                }
            }));

            res.json({ products: results });
        } catch (error: any) {
            console.error("General API Error:", error);
            res.status(500).json({ error: "Failed to process request" });
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
