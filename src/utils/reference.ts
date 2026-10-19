/**
 * Reference, provider, and date sanitization utilities for BillShield.
 * Ensures data integrity across extraction, explanation, and message drafting.
 *
 * Rules:
 * - Reject placeholders such as provider_account_number_placeholder, booking_reference, account_number, unknown, N/A, etc.
 * - Reject internal UUIDs (e.g. b8429e71-4688-4eeb-b8f4-a021bd72f6a1).
 * - Reject internal transaction hashes and system IDs.
 * - Reject generic schema field names used as values (e.g. "booking_reference", "account_number").
 * - Treat invalid, placeholder, or missing values strictly as null.
 * - Ensure company names are never assigned to date fields.
 * - Ensure provider names are cleanly identified from company entities or documents.
 */

// 1. UUID v4 / RFC 4122 pattern (8-4-4-4-12 hex characters)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 2. Long hexadecimal hashes (e.g. 24+ hex characters in payment gateway txids or git/mongo IDs)
const LONG_HASH_REGEX = /^[0-9a-f]{24,}$/i;

// 3. Internal BillShield IDs
const INTERNAL_BILLSHIELD_ID_REGEX = /^(bill-\d+|chg-\d+|msg-\d+|REV-)/i;

// 4. Placeholder keywords anywhere in the identifier
const PLACEHOLDER_KEYWORD_REGEX = /\b(placeholder|example|sample|template|dummy|fake|mock|demo)\b/i;
const PLACEHOLDER_SUBSTRING_REGEX = /(_|-|\b)(placeholder|sample|example)(_|-|\b)/i;

// 5. Generic schema / field names echoed as values (e.g. "provider_account_number_placeholder", "booking_reference", "account_number")
const GENERIC_FIELD_NAME_REGEX = /^(provider_)?(account|booking|invoice|consumer|customer|reference|billing|order|pnr|sub)?_?(number|no|id|ref|reference|code|placeholder)?$/i;
const GENERIC_NAME_PHRASES_REGEX = /^(account\s*number|booking\s*reference|invoice\s*number|booking\s*id|customer\s*id|pnr\s*number|reference\s*number|consumer\s*number|account\s*id|bill\s*number|bill\s*no|order\s*id|order\s*number)$/i;

// 6. Code variable syntax (e.g. 3 or more lowercase words joined by underscores)
const CODE_VARIABLE_SYNTAX_REGEX = /^[a-z]+(_[a-z]+){2,}$/;

// 7. Template syntax (e.g. {{...}}, <...>, [...], ${...})
const TEMPLATE_SYNTAX_REGEX = /([<{].*[>}]|\${.*}|\[.*\])/;

// 8. Common null / empty placeholders
const INVALID_LITERAL_REGEX = /^(null|none|n\/?a|nil|undefined|unknown|not specified|not available|unspecified|pending|na|-|\.)$/i;

/**
 * Validates and sanitizes customer-facing references (Booking ID, PNR, Invoice No, Account No).
 * Strictly filters out placeholders, variable names, UUIDs, database IDs, and transaction hashes.
 * Returns the cleaned genuine reference string or null if invalid.
 */
export function sanitizeCustomerReference(val: string | null | undefined): string | null {
  if (!val) return null;
  const clean = val.trim();
  if (!clean) return null;

  // Length boundaries: real human references are between 3 and 50 characters
  if (clean.length < 3 || clean.length > 50) return null;

  // Must contain alphanumeric characters (at least one letter or digit)
  if (!/[a-zA-Z0-9]/.test(clean)) return null;

  // Reject literal placeholders (null, none, n/a, unknown, etc.)
  if (INVALID_LITERAL_REGEX.test(clean)) return null;

  // Reject placeholder keywords (e.g. provider_account_number_placeholder, booking_id_placeholder)
  if (PLACEHOLDER_KEYWORD_REGEX.test(clean)) return null;
  if (PLACEHOLDER_SUBSTRING_REGEX.test(clean)) return null;

  // Reject generic schema field names (e.g. "booking_reference", "account_number")
  if (GENERIC_FIELD_NAME_REGEX.test(clean)) return null;
  if (GENERIC_NAME_PHRASES_REGEX.test(clean)) return null;

  // Reject code variable syntax (e.g. "provider_account_number_placeholder")
  if (CODE_VARIABLE_SYNTAX_REGEX.test(clean)) return null;

  // Reject template syntax like {{id}} or <ref>
  if (TEMPLATE_SYNTAX_REGEX.test(clean)) return null;

  // Reject UUIDs
  if (UUID_REGEX.test(clean)) return null;

  // Reject long hex hashes
  if (LONG_HASH_REGEX.test(clean)) return null;

  // Reject internal BillShield session IDs
  if (INTERNAL_BILLSHIELD_ID_REGEX.test(clean)) return null;

  return clean;
}

/**
 * Returns true if the string is a valid genuine customer reference.
 */
export function isValidCustomerReference(val: string | null | undefined): boolean {
  return sanitizeCustomerReference(val) !== null;
}

export function isUuidReference(val: string | null | undefined): boolean {
  if (!val) return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Checks whether a given string is a corporate entity or company name
 * rather than a genuine calendar date.
 */
export function isCompanyName(str: string | null | undefined): boolean {
  if (!str) return false;
  const s = str.trim();
  if (!s) return false;

  const companyKeywords = [
    'PVT',
    'LTD',
    'LIMITED',
    'INC',
    'CORP',
    'CORPORATION',
    'LLC',
    'LLP',
    'PRIVATE',
    'SERVICES',
    'SOLUTIONS',
    'ENTERPRISES',
    'TRAVELS',
    'AIRLINES',
    'AIRWAYS',
    'TELECOM',
    'COMMUNICATIONS',
    'BROADBAND',
    'TECHNOLOGIES',
  ];

  for (const kw of companyKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(s)) return true;
  }

  // If there are no digits and it is long, it's not a calendar date
  if (!/\d/.test(s) && s.length > 15) return true;

  return false;
}

/**
 * Sanitizes and normalizes a provider/merchant name.
 * e.g. "CLEARTRIP TRAVELS PVT LTD" -> "Cleartrip"
 * e.g. "BHARTI AIRTEL LIMITED" -> "Airtel"
 */
export function cleanProviderName(
  rawProvider: string | null | undefined,
  serviceHint?: string,
  fileName?: string
): string | null {
  let name = (rawProvider || '').trim();

  // If name was omitted, attempt inference from hints or filename
  if (!name) {
    const combined = `${serviceHint || ''} ${fileName || ''}`.toLowerCase();
    if (combined.includes('cleartrip')) return 'Cleartrip';
    if (combined.includes('airtel')) return 'Airtel';
    if (combined.includes('jio')) return 'Jio';
    if (combined.includes('vi ') || combined.includes('vodafone')) return 'Vi';
    return null;
  }

  const lower = name.toLowerCase();
  if (lower.startsWith('cleartrip')) return 'Cleartrip';
  if (lower.startsWith('airtel') || lower.includes('bharti airtel')) return 'Airtel';
  if (lower.startsWith('reliance jio') || lower.startsWith('jio')) return 'Jio';
  if (lower.startsWith('vodafone') || lower.startsWith('vi ') || lower === 'vi') return 'Vi';

  // Strip trailing legal suffixes (e.g. "Airtel Limited" -> "Airtel")
  const stripped = name
    .replace(/\b(private limited|pvt ltd|pvt\.?|ltd\.?|limited|inc\.?|llc|llp|corp\.?)\b/gi, '')
    .trim();

  // Clean trailing punctuation
  const clean = stripped.replace(/[,.-]+$/, '').trim();
  return clean || name;
}

/**
 * Validates that an extracted date is a genuine calendar date
 * and never a company name, address, or random text.
 */
export function sanitizeBillDate(str: string | null | undefined): string | null {
  if (!str) return null;
  const s = str.trim();
  if (!s) return null;

  // Reject company entity names
  if (isCompanyName(s)) return null;

  // Reject generic placeholders
  if (INVALID_LITERAL_REGEX.test(s)) return null;
  if (PLACEHOLDER_KEYWORD_REGEX.test(s)) return null;

  // Genuine calendar dates must have at least one digit for day or year
  if (!/\d/.test(s)) return null;

  // Real date strings are not paragraphs
  if (s.length > 35) return null;

  // Reject pure phone numbers or standalone balances (e.g. "9907" or "9876543210")
  if (/^\d{5,}$/.test(s.replace(/[\s-]/g, ''))) return null;

  return s;
}
