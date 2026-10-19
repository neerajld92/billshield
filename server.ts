import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  sanitizeCustomerReference,
  isCompanyName,
  cleanProviderName,
  sanitizeBillDate,
} from './src/utils/reference.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Allow up to 20MB for bill documents (PDF / JPG / PNG)
app.use(express.json({ limit: '20mb' }));

// Shared Gemini Client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Candidate models in preference order to ensure resilience against high-demand spikes
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
];

/**
 * Timeout helper for LLM requests with proper timer clearance
 */
function withTimeout<T>(promise: Promise<T>, ms: number = 30000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms);
  });
  return Promise.race([
    promise.then((res) => {
      if (timer) clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]);
}

/**
 * Resilient Gemini caller that fails over across candidate models
 * when encountering temporary 503 high-demand, 429 quota exhaustion, or timeouts.
 */
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  timeoutPerModelMs?: number;
}) {
  let lastError: any = null;
  const timeoutMs = params.timeoutPerModelMs || 25000;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          contents: params.contents,
          config: params.config,
          model,
        }),
        timeoutMs
      );
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const status = err?.status;
      const msg = err?.message || '';
      console.warn(`[Gemini] Model ${model} notice (${status || 'error'}): ${msg.slice(0, 100)}`);

      const isRecoverable =
        status === 503 ||
        status === 429 ||
        status === 404 ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('quota') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('timed out');

      if (isRecoverable) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All AI models temporarily unavailable.');
}

/**
 * Deterministic helper to convert decimal amount string/number to integer minor units (paise)
 */
function toPaise(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return Math.round(val * 100);
  }
  const clean = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!clean || clean === '-' || clean === '.') return null;
  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

// -------------------------------------------------------------
// POST /api/extract-bill
// -------------------------------------------------------------
app.post('/api/extract-bill', async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, service, expectedAmount } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing file content.' });
    }

    // Resolve MIME type cleanly
    let resolvedMime = mimeType;
    const nameLower = (fileName || '').toLowerCase();
    if (!resolvedMime || resolvedMime === 'application/octet-stream') {
      if (nameLower.endsWith('.pdf')) {
        resolvedMime = 'application/pdf';
      } else if (nameLower.endsWith('.png')) {
        resolvedMime = 'image/png';
      } else if (nameLower.endsWith('.webp')) {
        resolvedMime = 'image/webp';
      } else {
        resolvedMime = 'image/jpeg';
      }
    }

    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;

    const documentPart = {
      inlineData: {
        mimeType: resolvedMime,
        data: cleanBase64,
      },
    };

    const promptText = `Analyze this bill/invoice document and extract the structured bill data.
Optional hints: service "${service || ''}", expected amount "${expectedAmount || ''}".
File: "${fileName || 'uploaded_bill'}"

Extraction rules:
1. Identify the service provider:
   - Identify the company, merchant, or platform that issued this bill/invoice (e.g. "Cleartrip", "Airtel", "Jio", "Vi").
   - Extract the recognized commercial brand name (e.g. extract "Cleartrip" from "CLEARTRIP TRAVELS PVT LTD", "Airtel" from "Bharti Airtel Limited").
   - If not found or completely ambiguous, return null. Never guess.
2. Identify the service category (e.g. "Flight Booking", "Broadband", "Mobile", "Utility", or general service) and currency (default "INR").
3. Identify the bill or invoice date:
   - Extract the date this invoice or bill was issued (e.g. "19 Oct 2026", "12-Oct-2024", "15/10/2026").
   - This MUST be a genuine calendar date with day, month, and year.
   - NEVER put company names, merchant names, addresses, or IDs in the date field.
   - If no genuine calendar date is found on the document, return null.
4. Extract ONLY genuine, human customer-facing identifiers: Booking ID, PNR, Invoice Number, or Consumer/Account Number (account_reference).
   - NEVER extract internal system UUIDs, GUIDs, transaction hashes, system tracking IDs, or digital signature keys.
   - If the document does not contain an explicit, human-facing booking reference or account number, leave account_reference as null.
   - NEVER invent or generate fake references.
5. Identify the printed payable invoice total as a decimal number (e.g. 9907.00 or 861.40):
   - Look for the printed summary row labeled "Total", "Grand Total", "Total Amount", "Total Payable", "Invoice Total", "Total Invoice Value", "Net Amount", "Amount Paid", or "Total Fare".
   - Extract the exact printed payable number.
   - If no total is printed on the document, return null. Never calculate or invent a total.
6. Extract all line items with exact printed descriptions and amounts:
   - 'charge': regular charge, base fare, or plan rental.
   - 'fee': ancillary fee, convenience fee, booking fee, or service fee.
   - 'tax': government GST, CGST, SGST, cess.
   - 'previous_balance': prior balance or arrears carried over.
   - 'payment': payment received from customer (reduces amount due).
   - 'credit': adjustment credit or promotional discount (reduces amount due).
   - 'refund': refund credited to account (reduces amount due).
   - 'rounding': rounding off adjustment.
   - 'subtotal': a summary or subtotal line (must not be added again).
   - 'total': printed total summary line (must not be added again).
   - 'included': an item already included in another parent line.
   - 'unresolved': ambiguous overlap where breakdown is incomplete.
7. Never invent numbers. Treat unreadable amounts as null, not zero. Missing or uncertain information must remain null rather than being guessed.`;

    const response = await generateContentWithFallback({
      contents: {
        parts: [documentPart, { text: promptText }],
      },
      config: {
        systemInstruction:
          'You are BillShield’s document auditor. Extract facts accurately without hallucination. Provider must be the issuing company name (e.g. "Cleartrip", "Airtel"). Date must strictly be a calendar date, never a company name. Billed amount must be the explicitly printed payable total. Treat missing or unreadable data strictly as null, never guess or invent numbers.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            provider: {
              type: Type.STRING,
              description: 'The service provider or company name issuing the bill (e.g. "Cleartrip", "Airtel"). Never put dates here. If unknown, return null.',
            },
            service: { type: Type.STRING, description: 'Service category (e.g. "Flight Booking", "Broadband") or null' },
            date: {
              type: Type.STRING,
              description: 'The invoice or bill date formatted as a human-readable calendar date (e.g. "19 Oct 2026", "12-Oct-2024"). MUST be a genuine calendar date. NEVER put company names, merchant names, or addresses here. Return null if not found.',
            },
            account_reference: {
              type: Type.STRING,
              description: 'Genuine customer-facing Booking ID, PNR, Invoice Number, or Account Number, or null if none. Never extract internal UUIDs or transaction hashes.',
            },
            currency: { type: Type.STRING, description: 'ISO currency e.g. INR' },
            billed_amount: {
              type: Type.NUMBER,
              description: 'The final printed payable total or invoice grand total printed on the bill as decimal (e.g. 9907.00). Look for "Total", "Grand Total", "Total Amount", "Total Payable", "Total Invoice Value", "Total Fare", "Net Amount". Return null if missing.',
            },
            charges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER, description: 'Item amount as decimal' },
                  type: {
                    type: Type.STRING,
                    description: 'charge, fee, tax, previous_balance, payment, credit, refund, rounding, subtotal, total, included, unresolved',
                  },
                },
                required: ['description', 'type'],
              },
            },
          },
          required: ['currency', 'charges'],
        },
      },
      timeoutPerModelMs: 30000,
    });

    const text = response.text;
    if (!text) {
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    let cleanedText = text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let rawData: any;
    try {
      rawData = JSON.parse(cleanedText);
    } catch {
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        rawData = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
      } else {
        return res.status(422).json({ error: 'We couldn’t read this clearly. Try a clearer image or another file.' });
      }
    }

    const billId = `bill-${Date.now()}`;
    const expectedPaise = expectedAmount ? toPaise(expectedAmount) : null;

    // 1. Resolve Provider and Date cleanly (protect against accidental swapping)
    let rawProvider = (rawData.provider || '').trim();
    let rawDate = (rawData.date || '').trim();

    // If date contains a company name (e.g. "CLEARTRIP TRAVELS PVT LTD"), reassign to provider if provider is empty
    if (isCompanyName(rawDate)) {
      if (!rawProvider) {
        rawProvider = rawDate;
      }
      rawDate = '';
    }

    const provider = cleanProviderName(rawProvider, service, fileName);
    const date = sanitizeBillDate(rawDate);
    const accountReference = sanitizeCustomerReference(rawData.account_reference);

    // 2. Resolve Printed Payable Total
    let billedPaise = rawData.billed_amount !== undefined && rawData.billed_amount !== null
      ? toPaise(rawData.billed_amount)
      : null;

    // If LLM returned the printed grand total in charges (as type 'total' or labeled 'Total'), extract it from that printed row
    if (billedPaise === null && Array.isArray(rawData.charges)) {
      const explicitTotalItem = rawData.charges.find(
        (c: any) =>
          c &&
          (c.type === 'total' ||
            /^(total|grand total|total payable|total amount|invoice total|total invoice value|total fare|net payable|net amount|amount paid)$/i.test((c.description || '').trim())) &&
          c.amount !== null &&
          c.amount !== undefined
      );
      if (explicitTotalItem) {
        billedPaise = toPaise(explicitTotalItem.amount);
      }
    }

    const validTypes = [
      'charge', 'fee', 'tax', 'previous_balance', 'payment', 'credit',
      'refund', 'rounding', 'subtotal', 'total', 'included', 'unresolved',
    ];

    const charges = (rawData.charges || []).map((c: any, index: number) => ({
      id: `chg-${Date.now()}-${index + 1}`,
      bill_id: billId,
      description: c.description || 'Unlabeled item',
      amount: c.amount !== undefined && c.amount !== null ? toPaise(c.amount) : null,
      type: validTypes.includes(c.type) ? c.type : 'charge',
    }));

    const bill = {
      id: billId,
      provider: provider || null,
      service: rawData.service || service || null,
      date: date || null,
      account_reference: accountReference,
      currency: rawData.currency || 'INR',
      expected_amount: expectedPaise,
      billed_amount: billedPaise,
      fileName,
    };

    return res.json({ bill, charges });
  } catch (error: any) {
    console.error('Error in /api/extract-bill:', error?.status, error?.message);
    const msg = error?.message || '';
    if (error?.status === 503 || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
      return res.status(503).json({ error: 'AI service temporarily unavailable due to high demand. Please try again.' });
    } else if (error?.status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI service quota temporarily exceeded. Please try again later.' });
    } else if (msg.includes('timed out')) {
      return res.status(504).json({ error: 'The AI request timed out. Please try again.' });
    } else if (msg.includes('API_KEY')) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    } else {
      return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }
  }
});

// Helper: Deterministic fallback explanation when LLM is unavailable or times out
function getFallbackExplanation(charge: any, billContext: any) {
  const desc = charge.description || 'Charge item';
  const typeStr = (charge.type || 'charge').replace('_', ' ');
  const amtStr = charge.amount !== null ? `₹${(Math.abs(charge.amount) / 100).toFixed(2)}` : 'unspecified';
  const provider = billContext?.provider || 'the provider';

  let usuallyMeans = `This is a standard ${typeStr} billed by ${provider} for services or rentals during this period.`;
  const lower = desc.toLowerCase();
  if (lower.includes('tax') || lower.includes('gst') || charge.type === 'tax') {
    usuallyMeans = 'Statutory Goods and Services Tax (GST) mandated by government authorities on telecommunications or utility services.';
  } else if (lower.includes('isd') || lower.includes('international') || lower.includes('roaming')) {
    usuallyMeans = 'Usage charges incurred for international communications or roaming outside your standard home circle.';
  } else if (lower.includes('convenience') || lower.includes('booking') || lower.includes('fee')) {
    usuallyMeans = 'A non-refundable service or platform convenience fee added at the time of booking or billing.';
  } else if (charge.type === 'payment') {
    usuallyMeans = 'A payment recorded by the provider that reduces the outstanding balance on the bill.';
  } else if (charge.type === 'credit' || charge.type === 'refund') {
    usuallyMeans = 'A credit or adjustment applied by the provider to reduce your final payable amount.';
  } else if (charge.type === 'previous_balance') {
    usuallyMeans = 'Unpaid balance or carryover amount from the prior billing cycle.';
  }

  return {
    whatBillShows: `The bill records "${desc}" for ${amtStr} categorized under ${typeStr}.`,
    whatThisUsuallyMeans: usuallyMeans,
    whatRemainsUnclear: `The bill does not include itemised usage logs or the detailed calculation formula for this specific line item.`,
  };
}

// Helper: Deterministic fallback message draft
function getFallbackDraftMessage(selectedCharges: any[], billContext: any, additionalReference?: string | null) {
  const provider = billContext?.provider || 'Service Provider';
  // If additionalReference is provided (including empty string or null), respect user's explicit choice
  const rawRef = additionalReference !== undefined ? additionalReference : billContext?.account_reference;
  const ref = sanitizeCustomerReference(rawRef);
  const refStr = ref ? ` (Ref: ${ref})` : '';

  if (selectedCharges.length === 1) {
    const item = selectedCharges[0];
    const amt = item.amount !== null ? `₹${(Math.abs(item.amount) / 100).toFixed(2)}` : '';
    return `Hello, my ${provider} bill${refStr} includes a charge of ${amt} for "${item.description}". Could you please explain what this charge covers and share the itemised details? Thank you.`;
  }

  const items = selectedCharges
    .map((c) => `"${c.description}" (${c.amount !== null ? `₹${(Math.abs(c.amount) / 100).toFixed(2)}` : ''})`)
    .join(', ');
  return `Hello, my ${provider} bill${refStr} includes the following charges: ${items}. Could you please explain what these charges cover and share the usage breakdown? Thank you.`;
}

// -------------------------------------------------------------
// POST /api/explain-charge
// -------------------------------------------------------------
app.post('/api/explain-charge', async (req, res) => {
  const { charge, billContext } = req.body;
  if (!charge || !charge.description) {
    return res.status(400).json({ error: 'Missing charge details' });
  }

  const amountFormatted = charge.amount !== null ? `₹${(charge.amount / 100).toFixed(2)}` : 'Amount not specified';

  const promptText = `Explain this charge in plain English:
Item: "${charge.description}"
Amount: ${amountFormatted} (${charge.type})
Provider: ${billContext?.provider || 'Service Provider'}
Service: ${billContext?.service || 'General'}
Date: ${billContext?.date || 'Recent'}

Requirements:
1. whatBillShows: What the bill literally states about this item (1 sentence).
2. whatThisUsuallyMeans: What this charge typically covers in plain consumer terms (1-2 sentences).
3. whatRemainsUnclear: What specific details or breakdown the bill omits (1 sentence).
Never accuse fraud or guarantee refunds. Keep answers brief and neutral.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction:
            'You explain bill line items neutrally and briefly in plain consumer terms. Follow the three output fields exactly.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              whatBillShows: { type: Type.STRING },
              whatThisUsuallyMeans: { type: Type.STRING },
              whatRemainsUnclear: { type: Type.STRING },
            },
            required: ['whatBillShows', 'whatThisUsuallyMeans', 'whatRemainsUnclear'],
          },
        },
      }),
      30000
    );

    const text = response.text;
    if (text) {
      const explanation = JSON.parse(text);
      return res.json(explanation);
    }
  } catch (error: any) {
    console.warn('Gemini explain-charge latency/error, using factual fallback:', error?.message);
  }

  // Graceful fallback to verified bill facts
  return res.json(getFallbackExplanation(charge, billContext));
});

// -------------------------------------------------------------
// POST /api/draft-message
// -------------------------------------------------------------
app.post('/api/draft-message', async (req, res) => {
  const { selectedCharges, billContext, additionalReference } = req.body;
  if (!selectedCharges || selectedCharges.length === 0) {
    return res.status(400).json({ error: 'No charges selected for clarification' });
  }

  const itemsSummary = selectedCharges
    .map((c: any) => {
      const amt = c.amount !== null ? `₹${(c.amount / 100).toFixed(2)}` : 'unspecified amount';
      return `"${c.description}" (${amt})`;
    })
    .join(', ');

  // If additionalReference was provided (including empty string or null), use it directly
  const rawRef = additionalReference !== undefined ? additionalReference : billContext?.account_reference;
  const cleanRef = sanitizeCustomerReference(rawRef);

  const promptText = `Draft a polite, concise clarification message for a customer to send to their provider (${billContext?.provider || 'their service provider'}).
Charge(s) to clarify: ${itemsSummary}
Provider: ${billContext?.provider || 'Service Provider'}
Service: ${billContext?.service || 'Service'}
Bill Date: ${billContext?.date || 'Recent'}
${cleanRef ? `Customer Reference: ${cleanRef}` : 'Customer Reference: None provided. Do NOT mention, invent, or include any reference or booking number.'}

Rules:
- 2 short sentences.
- Polite, clear, ready to copy and send.
- Ask what the charge relates to and request the usage breakdown.
${cleanRef ? `- Include the Customer Reference (${cleanRef}) naturally in the message so the provider can identify the booking or account.` : `- Do NOT include, mention, or invent any reference number, booking ID, account number, or internal ID.`}
- Do NOT invent fake customer numbers, email addresses, or threats.`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          systemInstruction:
            'Draft concise, polite clarification messages for consumers to send to providers. Do not invent details or references.',
        },
      }),
      30000
    );

    const text = response.text ? response.text.trim() : '';
    if (text) {
      return res.json({ draft: text });
    }
  } catch (error: any) {
    console.warn('Gemini draft-message latency/error, using factual template:', error?.message);
  }

  // Graceful fallback to verified bill facts template (respect cleanRef)
  return res.json({ draft: getFallbackDraftMessage(selectedCharges, billContext, cleanRef || '') });
});

// -------------------------------------------------------------
// Dev & Production Frontend Serving
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
        watch: isHmrDisabled ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`BillShield server listening on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
