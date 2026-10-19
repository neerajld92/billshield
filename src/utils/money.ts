import { Bill, Charge, Analysis, ChargeType } from '../types';

/**
 * Parses a decimal string, number, or null into integer minor units (paise).
 * Avoids IEEE 754 floating point precision errors.
 * e.g., "699.00" -> 69900
 * e.g., "0.10" -> 10
 * e.g., "1168.99" -> 116899
 * e.g., "-1169.00" -> -116900
 */
export function parseToMinorUnits(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (isNaN(input)) return null;
    return Math.round(input * 100);
  }

  const cleaned = input.trim().replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;

  const isNegative = cleaned.startsWith('-');
  const unsignedStr = isNegative ? cleaned.slice(1) : cleaned;
  const parts = unsignedStr.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  if (isNaN(whole)) return null;

  let fraction = 0;
  if (parts.length > 1) {
    const fractionStr = (parts[1] + '00').slice(0, 2);
    fraction = parseInt(fractionStr, 10);
  }

  const minor = whole * 100 + fraction;
  return isNegative ? -minor : minor;
}

/**
 * Formats integer minor units to currency display.
 * e.g., 86140 -> "₹861.40"
 * Uses Indian numbering grouping (e.g. ₹9,907.00)
 */
export function formatMinorUnits(
  minorUnits: number | null | undefined,
  currency: string = 'INR',
  options: { showSign?: boolean; zeroAsFree?: boolean } = {}
): string {
  if (minorUnits === null || minorUnits === undefined) {
    return 'Couldn’t read';
  }

  const isNeg = minorUnits < 0;
  const absUnits = Math.abs(minorUnits);
  const rupees = Math.floor(absUnits / 100);
  const paise = (absUnits % 100).toString().padStart(2, '0');

  // Indian currency grouping: e.g. 1,00,000 or 9,907
  const rupeesFormatted = rupees.toLocaleString('en-IN');
  const symbol = currency === 'INR' ? '₹' : currency + ' ';
  const base = `${symbol}${rupeesFormatted}.${paise}`;

  if (isNeg) {
    return `-${base}`;
  }
  if (options.showSign && minorUnits > 0) {
    return `+${base}`;
  }
  return base;
}

/**
 * Types of charges that are non-contributing summaries and must NOT be counted again.
 */
export const NON_CONTRIBUTING_TYPES: ChargeType[] = ['subtotal', 'total', 'included'];

/**
 * Calculates deterministic analysis from Bill and Charges strictly in TypeScript
 * with exact integer minor units (paise).
 *
 * Treatment:
 * - 'charge', 'fee', 'tax': Adds positive amount.
 * - 'previous_balance': Adds amount (positive if arrears due, negative if prior credit).
 * - 'payment', 'credit', 'refund': Reduces payable amount (subtracts).
 * - 'rounding': Adds or subtracts depending on signed amount.
 * - 'subtotal', 'total', 'included': Never added again.
 * - 'unresolved': Marks breakdown incomplete.
 */
export function calculateAnalysis(bill: Bill, charges: Charge[]): Analysis {
  let hasIncompleteComponent = false;
  let totalMinor = 0;

  if (charges.length === 0) {
    hasIncompleteComponent = true;
  }

  for (const c of charges) {
    if (NON_CONTRIBUTING_TYPES.includes(c.type)) {
      continue;
    }
    if (c.type === 'unresolved' || c.amount === null) {
      hasIncompleteComponent = true;
      break;
    }

    if (c.type === 'charge' || c.type === 'fee' || c.type === 'tax') {
      totalMinor += Math.abs(c.amount);
    } else if (c.type === 'previous_balance') {
      totalMinor += c.amount; // Can be positive or negative
    } else if (c.type === 'payment' || c.type === 'credit' || c.type === 'refund') {
      totalMinor -= Math.abs(c.amount); // Always reduces payable total
    } else if (c.type === 'rounding') {
      totalMinor += c.amount; // Rounding can be + or -
    }
  }

  const calculated_total = hasIncompleteComponent ? null : totalMinor;

  let arithmetic_difference: number | null = null;
  let status: 'match' | 'mismatch' | 'incomplete' = 'incomplete';

  if (calculated_total !== null && bill.billed_amount !== null) {
    arithmetic_difference = calculated_total - bill.billed_amount;
    status = arithmetic_difference === 0 ? 'match' : 'mismatch';
  } else {
    status = 'incomplete';
  }

  let expected_difference: number | null = null;
  if (bill.billed_amount !== null && bill.expected_amount !== null) {
    expected_difference = bill.billed_amount - bill.expected_amount;
  }

  return {
    id: `analysis-${bill.id}`,
    bill_id: bill.id,
    calculated_total,
    expected_difference,
    arithmetic_difference,
    status,
  };
}
