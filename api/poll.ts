import { ApifyClient } from 'apify-client';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!apifyToken) return res.status(500).json({ error: 'APIFY_API_TOKEN not configured' });
    if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const { runs } = req.body;
    if (!runs || !Array.isArray(runs)) {
        return res.status(400).json({ error: 'No runs provided' });
    }

    const client = new ApifyClient({ token: apifyToken });
    const genAI = new GoogleGenAI({ apiKey: geminiKey });

    const products: any[] = [];
    const pending: any[] = [];

    await Promise.all(runs.map(async (runInfo: any) => {
        try {
            const run = await client.run(runInfo.runId).get();

            if (!run) {
                products.push({ name: runInfo.rawUrl, error: 'Run not found.' });
                return;
            }

            if (run.status === 'SUCCEEDED') {
                const { items } = await client.dataset(runInfo.datasetId).listItems();

                if (!items || items.length === 0) {
                    products.push({ name: runInfo.rawUrl, error: 'No reviews found. Verify the product link is accessible.' });
                    return;
                }

                const firstItem = items[0];
                const productTitle = firstItem.productTitle || firstItem.title || runInfo.rawUrl;
                const productImageUrl = firstItem.productImage || firstItem.thumbnail || firstItem.image || '/package-placeholder.png';
                const productRating = firstItem.productRating || firstItem.ratingScore || firstItem.rating || 0;
                const productReviewCount = firstItem.productReviewsCount || items.length;
                const apifyAiSummary = firstItem.aiReviewSummary || firstItem.aiReviewsSummary;

                let reviews: any[] = items.map((r: any) => ({
                    rating: r.ratingScore || r.rating || r.reviewRating || 0,
                    title: r.reviewTitle || r.title || r.reviewHeader || '',
                    text: r.reviewDescription || r.text || r.reviewText || r.reviewBody || '',
                    verified: r.isVerified || r.verified || r.verifiedPurchase || false
                }));

                const seen = new Set<string>();
                reviews = reviews.filter((r: any) => {
                    if (!r.text || r.text.length < 5) return false;
                    const fingerprint = r.text.substring(0, 100).toLowerCase();
                    if (seen.has(fingerprint)) return false;
                    seen.add(fingerprint);
                    return true;
                }).slice(0, 50);

                if (reviews.length === 0) {
                    products.push({ name: productTitle, error: 'No written reviews found. AI analysis requires text reviews.' });
                    return;
                }

                const reviewsContext = reviews.map((r: any) =>
                    `[Rating: ${r.rating}/5 | ${r.verified ? 'Verified' : 'Unverified'}] ${r.title}: ${r.text}`
                ).join('\n\n');

                const prompt = `Act as an expert consumer analyst. Summarize the Amazon product reviews for the product below.

PRODUCT: ${productTitle}
OVERALL RATING: ${productRating} / 5
TOTAL REVIEWS: ${productReviewCount}

REVIEWS TO ANALYZE (up to 50 reviews):
${reviewsContext}

MANDATORY CONSTRAINTS:
- GROUNDING: Base your entire analysis ONLY on the provided reviews. Use quotes if helpful.
- SENTIMENT: Provide breakdown percentages (0-100) for Positive, Mixed, and Negative that add up to 100.
- HIGHLIGHTS/COMPLAINTS: Identify specific labels for what users liked and complained about.
- INSIGHTS: Give specific details for Durability, Usability, Reliability, and Value.
- VERDICT: A 3-4 sentence final buying recommendation.

OUTPUT FORMAT: Respond with valid JSON only, no markdown.
{
    "productName": "Precise concise product name under 10 words",
    "sentiment": { "overall": "one sentence summary", "positive": 80, "mixed": 10, "negative": 10 },
    "highlights": [ { "label": "Feature name", "type": "positive", "frequency": "X of Y reviewers" } ],
    "commonComplaints": [ { "label": "Issue name", "severity": "minor|major|critical", "frequency": "X of Y reviewers" } ],
    "realUserInsights": { "durability": "...", "fit_usability": "...", "reliability": "...", "value_for_money": "..." },
    "buyerFit": { "bestFor": ["use case 1", "use case 2"], "notIdealFor": ["use case 1"] },
    "aiVerdict": { "summary": "3-4 sentence buying recommendation", "confidence": "high" }
}`;

                let aiSummary: any;
                try {
                    const response = await genAI.models.generateContent({
                        model: 'gemini-2.0-flash',
                        contents: prompt,
                        config: { responseMimeType: 'application/json' }
                    });

                    const rawText = response.text;
                    if (!rawText || rawText.trim() === '') {
                        throw new Error('Empty response from Gemini — content may have been filtered.');
                    }

                    aiSummary = JSON.parse(rawText);
                } catch (aiErr: any) {
                    const msg: string = aiErr?.message || '';
                    let userMsg: string;
                    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429')) {
                        userMsg = 'Gemini API quota exceeded. Upgrade your plan or check your GEMINI_API_KEY quota in Google AI Studio.';
                    } else if (msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED') || msg.includes('401') || msg.includes('403')) {
                        userMsg = 'Invalid or missing Gemini API key. Check GEMINI_API_KEY in Vercel → Settings → Environment Variables.';
                    } else if (msg.includes('JSON') || msg.includes('parse') || msg.includes('Unexpected')) {
                        userMsg = 'AI returned malformed data. Please try again.';
                    } else {
                        userMsg = `AI analysis failed: ${msg || 'Unknown error'}. Please try again.`;
                    }
                    products.push({ name: productTitle, error: userMsg });
                    return;
                }

                products.push({
                    name: aiSummary?.productName || productTitle,
                    productName: aiSummary?.productName || productTitle,
                    imageUrl: productImageUrl,
                    productUrl: runInfo.isUrl ? runInfo.normalizedUrl : (firstItem.url || firstItem.productUrl || 'https://amazon.com'),
                    rating: productRating,
                    reviewCount: productReviewCount,
                    category: firstItem.category || 'General',
                    price: firstItem.price?.value
                        ? `${firstItem.price.currency}${firstItem.price.value}`
                        : (firstItem.price || 'N/A'),
                    confidenceScore: reviews.length >= 10 ? 95 : 70,
                    apifyAiSummary: apifyAiSummary ? {
                        summary: apifyAiSummary.summary || apifyAiSummary.text,
                        pros: apifyAiSummary.pros || [],
                        cons: apifyAiSummary.cons || []
                    } : undefined,
                    reviews,
                    ...aiSummary,
                    error: null
                });

            } else if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status)) {
                products.push({
                    name: runInfo.rawUrl,
                    error: `Could not extract reviews (status: ${run.status}). Try a different product link.`
                });
            } else {
                // Still READY or RUNNING — keep polling
                pending.push(runInfo);
            }
        } catch (err: any) {
            const msg: string = err?.message || '';
            console.error('Error processing run:', runInfo.runId, msg || err);
            let userMsg: string;
            if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429')) {
                userMsg = 'Gemini API quota exceeded. Check your GEMINI_API_KEY quota in Google AI Studio.';
            } else if (msg.includes('API_KEY') || msg.includes('PERMISSION_DENIED') || msg.includes('401') || msg.includes('403')) {
                userMsg = 'Invalid Gemini API key. Check GEMINI_API_KEY in Vercel → Settings → Environment Variables.';
            } else {
                userMsg = `Analysis error: ${msg || 'Unknown error'}. Please try again.`;
            }
            products.push({ name: runInfo.rawUrl, error: userMsg });
        }
    }));

    res.json({ products, pending });
}
