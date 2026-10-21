/**
 * BillShield Data Model
 * Date: 19 October 2026
 *
 * Rules:
 * - Money is strictly stored as integer minor units (paise for INR). 1 INR = 100 paise.
 * - Missing values are null, never 0.
 * - Confirmed 0 is 0.
 * - Separate states for message: Drafted, Approved, Copied, Sent.
 */

export type ChargeType =
  | 'charge'
  | 'fee'
  | 'tax'
  | 'previous_balance'
  | 'payment'
  | 'credit'
  | 'refund'
  | 'rounding'
  | 'subtotal'
  | 'total'
  | 'included'
  | 'unresolved';

export interface Bill {
  id: string;
  provider: string | null;
  service: string | null;
  date: string | null;
  currency: string; // Default 'INR'
  expected_amount: number | null; // integer minor units
  billed_amount: number | null; // integer minor units
  account_reference?: string | null;
  // In-memory session fields (not persisted)
  fileName?: string;
  fileDataUrl?: string;
  fileMimeType?: string;
  originalAvailable?: boolean;
}

export interface Charge {
  id: string;
  bill_id: string;
  description: string;
  amount: number | null; // integer minor units
  type: ChargeType;
}

export const ARITHMETIC_DISCREPANCY_ID = 'arithmetic-discrepancy';

export interface Analysis {
  id: string;
  bill_id: string;
  calculated_total: number | null; // integer minor units
  expected_difference: number | null; // billed_amount - expected_amount
  arithmetic_difference: number | null; // calculated_total - billed_amount
  status: 'match' | 'mismatch' | 'incomplete';
}

export interface Message {
  id: string;
  bill_id: string;
  selected_charge_ids: string[];
  draft_text: string;
  final_text: string;
  is_drafted: boolean;
  approved_at: string | null; // ISO timestamp when explicitly approved
  copied_at: string | null; // ISO timestamp when copied
  sent_status: 'not_sent' | 'sent'; // 'not_sent' by default; only 'sent' on explicit user confirmation
  additional_reference?: string;
}

export interface ChargeExplanation {
  whatBillShows: string;
  whatThisUsuallyMeans: string;
  whatRemainsUnclear: string;
}

export interface SavedReview {
  id: string;
  savedAt: string;
  sessionRef?: string;
  bill: Omit<Bill, 'fileDataUrl'>;
  charges: Charge[];
  analysis: Analysis;
  message: Message | null;
  explanations?: Record<string, ChargeExplanation>;
  source?: 'local' | 'supabase';
}
