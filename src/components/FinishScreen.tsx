import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Lock,
  Bookmark,
  PlusCircle,
  Trash2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Bill, Charge, Analysis, Message, SavedReview } from '../types';
import { formatMinorUnits } from '../utils/money';

interface FinishScreenProps {
  bill: Bill;
  charges: Charge[];
  analysis: Analysis;
  message: Message | null;
  sessionRef: string;
  isSaved: boolean;
  onSaveReview: () => boolean | Promise<boolean>;
  onDeleteCurrentReview: () => void;
  onStartAnotherBill: () => void;
  isAuthenticated?: boolean;
  onOpenAuth?: () => void;
}

export const FinishScreen: React.FC<FinishScreenProps> = ({
  bill,
  charges,
  analysis,
  message,
  sessionRef,
  isSaved,
  onSaveReview,
  onDeleteCurrentReview,
  onStartAnotherBill,
  isAuthenticated,
  onOpenAuth,
}) => {
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveErrorNotice(null);
    try {
      const ok = await onSaveReview();
      if (ok) {
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 4000);
      } else {
        setSaveErrorNotice(
          isAuthenticated
            ? 'Failed to save to your Supabase account. Please check your connection and try again.'
            : 'Failed to save to device storage. Please check browser storage settings.'
        );
      }
    } catch (err: any) {
      setSaveErrorNotice(err?.message || 'Failed to save review.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartNewClick = () => {
    if (!isSaved) {
      setShowDiscardConfirm(true);
    } else {
      onStartAnotherBill();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Session Reference Label */}
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#777B73] mb-1">
        SESSION REFERENCE / {sessionRef}
      </div>

      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-[#20221F]">
          You're in control.
        </h1>
        <p className="mt-1 text-sm text-[#555B55]">
          You can save this review here or finish without saving.
        </p>
      </div>

      {/* Main Statement Origin Card (Image 9) */}
      <div className="relative mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-6 shadow-2xs overflow-hidden">
        {/* Math stamp badge in top-right */}
        <div className="sm:absolute sm:top-5 sm:right-5 mb-4 sm:mb-0">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider border rounded-sm ${
              analysis.status === 'match'
                ? 'border-[#285840] text-[#285840] bg-[#EAF1E8]'
                : analysis.status === 'mismatch'
                ? 'border-[#785015] text-[#785015] bg-[#FFF0D6]'
                : 'border-[#777B73] text-[#555B55] bg-[#F4F4EF]'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {analysis.status === 'match'
                ? 'MATH VERIFIED · SESSION COMPLETE'
                : analysis.status === 'mismatch'
                ? 'VARIANCE DETECTED'
                : 'AUDIT INCOMPLETE'}
            </span>
          </div>
        </div>

        {/* Origin info */}
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#777B73] block">
            STATEMENT ORIGIN
          </span>
          <h2 className="text-2xl font-bold text-[#20221F] mt-0.5">
            {bill.provider || 'Unidentified Provider'}
          </h2>
          <div className="text-xs text-[#555B55] mt-1">
            {bill.service || 'Service'} · Billing Date {bill.date || 'Undated'}
          </div>
        </div>

        {/* 3 Metric Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
          <div className="rounded-md border border-[#D8D3C8] bg-[#F4F4EF] p-3.5">
            <span className="font-mono text-[10px] uppercase text-[#777B73] block mb-1">
              Expected Regular Amount
            </span>
            <div className="font-mono text-xl font-bold text-[#20221F] tabular-nums">
              {bill.expected_amount !== null
                ? formatMinorUnits(bill.expected_amount, bill.currency)
                : 'Not provided'}
            </div>
            <span className="text-[11px] text-[#777B73] mt-1 block">
              {bill.expected_amount !== null ? 'User benchmark' : 'Omitted before upload'}
            </span>
          </div>

          <div className="rounded-md border border-[#D8D3C8] bg-[#F4F4EF] p-3.5">
            <span className="font-mono text-[10px] uppercase text-[#777B73] block mb-1">
              Printed Invoice Total
            </span>
            <div className="font-mono text-xl font-bold text-[#20221F] tabular-nums">
              {formatMinorUnits(bill.billed_amount, bill.currency)}
            </div>
            <span className="text-[11px] text-[#785015] font-mono mt-1 block">
              {analysis.expected_difference !== null && analysis.expected_difference > 0
                ? `+${formatMinorUnits(analysis.expected_difference, bill.currency)} over expectation`
                : analysis.expected_difference !== null && analysis.expected_difference < 0
                ? `${formatMinorUnits(analysis.expected_difference, bill.currency)} below expectation`
                : 'Matches expectation'}
            </span>
          </div>

          <div className="rounded-md border border-[#D8D3C8] bg-[#F4F4EF] p-3.5">
            <span className="font-mono text-[10px] uppercase text-[#777B73] block mb-1">
              Calculated Line Items
            </span>
            <div className="font-mono text-xl font-bold text-[#20221F] tabular-nums">
              {analysis.calculated_total !== null
                ? formatMinorUnits(analysis.calculated_total, bill.currency)
                : 'Incomplete'}
            </div>
            <span className="text-[11px] text-[#285840] font-mono mt-1 block">
              {analysis.arithmetic_difference === 0
                ? 'Diff ₹0.00 (Zero variance)'
                : analysis.arithmetic_difference !== null
                ? `Diff ${formatMinorUnits(analysis.arithmetic_difference, bill.currency)}`
                : 'Awaiting line breakdown'}
            </span>
          </div>
        </div>

        {/* Status Line Rows */}
        <div className="space-y-2.5 text-xs border-t border-[#D8D3C8]/60 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#285840]" />
              <span className="font-semibold text-[#20221F]">Item Reconciliation</span>
            </div>
            <span className="font-mono text-xs font-bold text-[#285840]">
              {analysis.status === 'match'
                ? 'Matched printed total (₹0.00 diff)'
                : analysis.status === 'mismatch'
                ? `Difference: ${formatMinorUnits(analysis.arithmetic_difference, bill.currency)}`
                : 'Breakdown incomplete'}
            </span>
          </div>

          {analysis.expected_difference !== null && analysis.expected_difference !== 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#785015]" />
                <span className="font-semibold text-[#20221F]">Variance Flagged</span>
              </div>
              <span className="font-mono text-xs font-bold text-[#785015]">
                {formatMinorUnits(analysis.expected_difference, bill.currency, { showSign: true })} over expectation
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#2546C4]" />
              <span className="font-semibold text-[#20221F]">Clarification Message</span>
            </div>
            <div className="font-mono text-xs">
              {message?.final_text ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {message.sent_status === 'sent' ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#285840] bg-[#EAF1E8] border border-[#C5DDC0] px-2 py-0.5 rounded text-[11px]">
                      <Check className="h-3 w-3" />
                      <span>Sent externally (confirmed by you)</span>
                    </span>
                  ) : message.copied_at ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#20221F] bg-[#F4F4EF] border border-[#D8D3C8] px-2 py-0.5 rounded text-[11px]">
                      <Check className="h-3 w-3 text-[#285840]" />
                      <span>Copied · Unsent</span>
                    </span>
                  ) : message.approved_at ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#2546C4] bg-[#EBF0FF] border border-[#BACDFD] px-2 py-0.5 rounded text-[11px]">
                      <span>Approved · Not copied or sent</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-[#785015] bg-[#FFF0D6] border border-[#F2D7A1] px-2 py-0.5 rounded text-[11px]">
                      <span>Drafted · Unapproved</span>
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[#777B73]">No message drafted</span>
              )}
            </div>
          </div>
        </div>

        {/* Inquiry Template Quote Box */}
        {message?.final_text && (
          <div className="mt-5 rounded-md border border-[#D8D3C8] bg-[#F4F4EF] p-4 text-xs">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#777B73] mb-2">
              <span>ARCHIVED INQUIRY TEMPLATE</span>
              <span>{bill.provider || 'Provider'} Service Desk</span>
            </div>
            <p className="font-mono text-xs text-[#20221F] italic leading-relaxed">
              "{message.final_text}"
            </p>
          </div>
        )}
      </div>

      {/* Storage Card (Cloud or Local Device) */}
      <div className="mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-6 shadow-2xs">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF1E8] text-[#2546C4]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#20221F]">
                {isAuthenticated ? 'Account Cloud Storage' : 'Local Device Storage'}
              </h3>
              <p className="text-xs text-[#555B55]">
                {isAuthenticated
                  ? 'Private cloud record protected by Supabase Row Level Security'
                  : 'Keep your audited numbers available for follow-ups on this device'}
              </p>
            </div>
          </div>

          <span
            className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded ${
              isSaved
                ? 'text-[#285840] bg-[#EAF1E8] border border-[#C5DDC0]'
                : 'text-[#785015] bg-[#FFF0D6] border border-[#F2D7A1]'
            }`}
          >
            {isSaved
              ? isAuthenticated
                ? 'Saved to your account'
                : 'Saved on this device'
              : 'Pending Save'}
          </span>
        </div>

        {/* Privacy & persistence notice */}
        <div className="rounded-md border border-[#D8D3C8]/80 bg-[#F4F4EF] p-3 text-xs text-[#555B55] leading-relaxed mb-4">
          <span className="font-mono font-bold text-[10px] uppercase text-[#20221F] block mb-1">
            {isAuthenticated ? 'PRIVACY & CLOUD PERSISTENCE NOTICE' : 'PRIVACY & LOCAL PERSISTENCE NOTICE'}
          </span>
          {isAuthenticated
            ? 'Stores the structured bill calculations, charges, explanations, and drafted messages in your private Supabase database. Strict Row Level Security prevents any other user from accessing your records.'
            : 'Saves the bill details and message in this browser, without the original file. Other people using this browser may see them. You can delete them anytime.'}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-bold rounded-md transition-colors ${
            isSaved
              ? 'bg-[#285840] text-white hover:bg-[#1E4431]'
              : 'bg-[#2546C4] text-white hover:bg-[#1C369B]'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="h-4 w-4" />
              <span>{isAuthenticated ? 'Saved to your account' : 'Saved on this device'}</span>
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4" />
              <span>
                {isSaving
                  ? 'Saving review...'
                  : isAuthenticated
                  ? 'Save this review to your account'
                  : 'Save this review on this device'}
              </span>
            </>
          )}
        </button>

        {!isAuthenticated && onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-3 block text-xs font-mono text-[#2546C4] hover:underline"
          >
            Want to sync across devices? Sign in with email →
          </button>
        )}

        {saveSuccessNotice && (
          <p className="mt-2 text-xs text-[#285840] font-mono">
            {isAuthenticated
              ? '✓ Successfully saved to your private Supabase account.'
              : "✓ Successfully saved to this browser's local storage."}
          </p>
        )}

        {saveErrorNotice && (
          <p className="mt-2 text-xs text-[#A12D2D] font-mono">
            ✕ {saveErrorNotice}
          </p>
        )}
      </div>

      {/* Bottom Utility Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#D8D3C8]">
        <button
          type="button"
          onClick={handleStartNewClick}
          className="flex items-center gap-2 font-mono text-xs font-bold text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] px-4 py-2 rounded-md hover:bg-[#F4F4EF] transition-colors"
        >
          <PlusCircle className="h-4 w-4 text-[#2546C4]" />
          <span>Start another bill</span>
        </button>

        {isSaved && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#A12D2D] hover:text-[#852222] hover:underline"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete this saved review</span>
          </button>
        )}
      </div>

      {/* Discard Unsaved Review Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] p-5 shadow-lg text-[#20221F]">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#785015] mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Discard unsaved review?</span>
            </h4>
            <p className="text-xs text-[#555B55] leading-relaxed">
              Your active review has not been saved on this device. Starting another bill will discard this review.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 text-xs font-mono rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
              >
                Keep reviewing
              </button>
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onStartAnotherBill();
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-[#A12D2D] text-white hover:bg-[#852222]"
              >
                Discard & start another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Saved Review Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] p-5 shadow-lg text-[#20221F]">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#A12D2D] mb-2 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <span>Delete saved review?</span>
            </h4>
            <p className="text-xs text-[#555B55] leading-relaxed">
              Permanently delete this saved review and its message from this browser?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-mono rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDeleteCurrentReview();
                }}
                className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-[#A12D2D] text-white hover:bg-[#852222]"
              >
                Delete review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
