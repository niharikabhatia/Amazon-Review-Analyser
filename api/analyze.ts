import { ApifyClient } from 'apify-client';

function extractAsin(url: string): string | null {
    const match = url.match(/(?:\/dp\/|gp\/product\/|asin\/|product\/|dp\/)([A-Z0-9]{10})/i);
    return match ? match[1] : null;
}

function normalizeUrl(url: string): string {
    let clean = url.trim();
    if (!clean.startsWith('http')) clean = 'https://' + clean;
    try {
        const u = new URL(clean);
        if (u.hostname.includes('amzn.in') || u.hostname.includes('amzn.to')) return clean;
        return `${u.origin}${u.pathname}`;
    } catch {
        return clean;
    }
}

async function resolveRedirect(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        return response.url;
    } catch {
        return url;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'APIFY_API_TOKEN is not set in Vercel environment variables.' });
    }

    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'No products provided' });
    }

    try {
        const client = new ApifyClient({ token });

        const runs = await Promise.all(products.map(async (p: any) => {
            let rawUrl = p.name || p.url;
            let normalizedUrl = normalizeUrl(rawUrl);

            if (normalizedUrl.includes('amzn.in') || normalizedUrl.includes('amzn.to') || normalizedUrl.includes('a.co')) {
                normalizedUrl = await resolveRedirect(normalizedUrl);
            }

            const inputAsin = extractAsin(normalizedUrl);
            if (inputAsin) {
                try {
                    const u = new URL(normalizedUrl);
                    const host = u.hostname.replace('www.', '');
                    normalizedUrl = `https://www.${host}/dp/${inputAsin}`;
                } catch {}
            }

            const isUrl = normalizedUrl.startsWith('http');
            const input: any = {
                maxReviews: 50,
                proxyConfiguration: { useApifyProxy: true },
                location: normalizedUrl.includes('.in') ? 'IN' : 'US'
            };

            if (isUrl) {
                input.productUrls = [{ url: normalizedUrl }];
            } else {
                input.searchKeywords = normalizedUrl;
            }

            // .start() returns immediately — does NOT block waiting for the run
            const run = await client.actor("junglee/amazon-reviews-scraper").start(input);

            return {
                runId: run.id,
                datasetId: run.defaultDatasetId,
                rawUrl,
                normalizedUrl,
                isUrl
            };
        }));

        res.json({ runs });
    } catch (error: any) {
        console.error('Error starting Apify runs:', error);
        res.status(500).json({ error: 'Failed to start analysis. Please try again.' });
    }
}
