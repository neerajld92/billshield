import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SavedReview, Bill, Charge, Analysis, Message, ChargeExplanation } from '../types';

function getEnv(key: string): string {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return String(import.meta.env[key]).trim();
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return String(process.env[key]).trim();
  }
  return '';
}

export function getSupabaseConfig(): { url: string; key: string } {
  const url = getEnv('VITE_SUPABASE_URL');
  const key = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const supabase: SupabaseClient | null = (() => {
  const { url, key } = getSupabaseConfig();
  if (!isSupabaseConfigured()) return null;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Saves a complete bill review (bill, charges, analysis, message, explanations)
 * to Supabase across the 4 relational tables.
 */
export async function saveReviewToSupabase(
  review: SavedReview,
  user: User
): Promise<{ success: boolean; billId?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const targetBillId = isUuid(review.bill.id) ? review.bill.id : generateUuid();

    // 1. Upsert / Insert bills table
    const { error: billError } = await supabase.from('bills').upsert(
      {
        bill_id: targetBillId,
        user_id: user.id,
        provider: review.bill.provider || null,
        service: review.bill.service || null,
        expected_amount: review.bill.expected_amount,
        billed_amount: review.bill.billed_amount,
        bill_date: review.bill.date || null,
        account_reference: review.bill.account_reference || null,
        currency: review.bill.currency || 'INR',
        file_name: review.bill.fileName || null,
        session_ref: review.sessionRef || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bill_id' }
    );

    if (billError) {
      console.error('[Supabase] Error saving bill:', billError);
      return { success: false, error: billError.message };
    }

    // 2. Clean and Insert bill_charges
    // Delete existing charges for this bill first if updating
    await supabase.from('bill_charges').delete().eq('bill_id', targetBillId);

    const selectedSet = new Set(review.message?.selected_charge_ids || []);
    const chargesToInsert = (review.charges || []).map((charge) => {
      const chargeId = isUuid(charge.id) ? charge.id : generateUuid();
      const expl = review.explanations?.[charge.id];

      return {
        charge_id: chargeId,
        bill_id: targetBillId,
        description: charge.description || 'Unlabeled item',
        amount: charge.amount,
        selected: selectedSet.has(charge.id),
        type: charge.type || 'charge',
        explanation_shows: expl?.whatBillShows || null,
        explanation_means: expl?.whatThisUsuallyMeans || null,
        explanation_unclear: expl?.whatRemainsUnclear || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    if (chargesToInsert.length > 0) {
      const { error: chargesError } = await supabase.from('bill_charges').insert(chargesToInsert);
      if (chargesError) {
        console.error('[Supabase] Error saving bill_charges:', chargesError);
      }
    }

    // 3. Insert bill_analyses
    await supabase.from('bill_analyses').delete().eq('bill_id', targetBillId);

    const { error: analysisError } = await supabase.from('bill_analyses').insert({
      analysis_id: generateUuid(),
      bill_id: targetBillId,
      calculated_total: review.analysis.calculated_total,
      difference: review.analysis.arithmetic_difference,
      expected_difference: review.analysis.expected_difference,
      status: review.analysis.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (analysisError) {
      console.error('[Supabase] Error saving bill_analyses:', analysisError);
    }

    // 4. Insert clarification_requests
    await supabase.from('clarification_requests').delete().eq('bill_id', targetBillId);

    if (review.message) {
      const { error: msgError } = await supabase.from('clarification_requests').insert({
        message_id: generateUuid(),
        bill_id: targetBillId,
        draft_text: review.message.draft_text || '',
        final_text: review.message.final_text || '',
        is_drafted: review.message.is_drafted || false,
        approved_at: review.message.approved_at || null,
        copied_at: review.message.copied_at || null,
        sent_status: review.message.sent_status || 'not_sent',
        additional_reference: review.message.additional_reference || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (msgError) {
        console.error('[Supabase] Error saving clarification_requests:', msgError);
      }
    }

    return { success: true, billId: targetBillId };
  } catch (err: any) {
    console.error('[Supabase] Unexpected error saving review:', err);
    return { success: false, error: err?.message || 'Failed to save to Supabase' };
  }
}

/**
 * Fetches all saved reviews owned by the current authenticated user from Supabase.
 */
export async function fetchUserReviewsFromSupabase(user: User): Promise<SavedReview[]> {
  if (!supabase) return [];

  try {
    // 1. Fetch bills for user
    const { data: billsData, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (billsError || !billsData || billsData.length === 0) {
      if (billsError) console.error('[Supabase] Error loading bills:', billsError);
      return [];
    }

    const billIds = billsData.map((b) => b.bill_id);

    // 2. Fetch related child records in parallel
    const [chargesRes, analysesRes, messagesRes] = await Promise.all([
      supabase.from('bill_charges').select('*').in('bill_id', billIds),
      supabase.from('bill_analyses').select('*').in('bill_id', billIds),
      supabase.from('clarification_requests').select('*').in('bill_id', billIds),
    ]);

    const chargesByBill = new Map<string, any[]>();
    (chargesRes.data || []).forEach((c) => {
      const arr = chargesByBill.get(c.bill_id) || [];
      arr.push(c);
      chargesByBill.set(c.bill_id, arr);
    });

    const analysisByBill = new Map<string, any>();
    (analysesRes.data || []).forEach((a) => {
      analysisByBill.set(a.bill_id, a);
    });

    const messageByBill = new Map<string, any>();
    (messagesRes.data || []).forEach((m) => {
      messageByBill.set(m.bill_id, m);
    });

    // 3. Map into SavedReview objects
    const result: SavedReview[] = billsData.map((b) => {
      const rawCharges = chargesByBill.get(b.bill_id) || [];
      const rawAnalysis = analysisByBill.get(b.bill_id);
      const rawMsg = messageByBill.get(b.bill_id);

      const explanationsMap: Record<string, ChargeExplanation> = {};
      const selectedChargeIds: string[] = [];

      const charges: Charge[] = rawCharges.map((c) => {
        if (c.selected) {
          selectedChargeIds.push(c.charge_id);
        }
        if (c.explanation_shows || c.explanation_means || c.explanation_unclear) {
          explanationsMap[c.charge_id] = {
            whatBillShows: c.explanation_shows || '',
            whatThisUsuallyMeans: c.explanation_means || '',
            whatRemainsUnclear: c.explanation_unclear || '',
          };
        }
        return {
          id: c.charge_id,
          bill_id: b.bill_id,
          description: c.description,
          amount: c.amount,
          type: c.type,
        };
      });

      const bill: Omit<Bill, 'fileDataUrl'> = {
        id: b.bill_id,
        provider: b.provider,
        service: b.service,
        date: b.bill_date,
        currency: b.currency || 'INR',
        expected_amount: b.expected_amount,
        billed_amount: b.billed_amount,
        account_reference: b.account_reference,
        fileName: b.file_name,
        originalAvailable: false,
      };

      const analysis: Analysis = {
        id: rawAnalysis?.analysis_id || `analysis-${b.bill_id}`,
        bill_id: b.bill_id,
        calculated_total: rawAnalysis?.calculated_total ?? null,
        expected_difference: rawAnalysis?.expected_difference ?? null,
        arithmetic_difference: rawAnalysis?.difference ?? null,
        status: rawAnalysis?.status || 'incomplete',
      };

      const message: Message | null = rawMsg
        ? {
            id: rawMsg.message_id,
            bill_id: b.bill_id,
            selected_charge_ids: selectedChargeIds,
            draft_text: rawMsg.draft_text || '',
            final_text: rawMsg.final_text || '',
            is_drafted: rawMsg.is_drafted || false,
            approved_at: rawMsg.approved_at,
            copied_at: rawMsg.copied_at,
            sent_status: rawMsg.sent_status || 'not_sent',
            additional_reference: rawMsg.additional_reference || undefined,
          }
        : null;

      return {
        id: b.bill_id,
        savedAt: b.created_at,
        sessionRef: b.session_ref || `REV-${b.bill_id.slice(0, 8)}`,
        bill,
        charges,
        analysis,
        message,
        explanations: Object.keys(explanationsMap).length > 0 ? explanationsMap : undefined,
        source: 'supabase',
      };
    });

    return result;
  } catch (err: any) {
    console.error('[Supabase] Error fetching user reviews:', err);
    return [];
  }
}

/**
 * Deletes a bill from Supabase. Cascading deletes automatically
 * clean up bill_charges, bill_analyses, and clarification_requests.
 */
export async function deleteReviewFromSupabase(billId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('bills').delete().eq('bill_id', billId);
    if (error) {
      console.error('[Supabase] Error deleting bill:', error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase] Error deleting bill:', err);
    return false;
  }
}
