import React, { useState, useEffect } from 'react';
import {
  FileText,
  RotateCcw,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Tag,
  X,
  Edit2,
} from 'lucide-react';
import { Bill, Charge, Message } from '../types';
import { formatMinorUnits } from '../utils/money';
import { sanitizeCustomerReference } from '../utils/reference';

interface MessageScreenProps {
  bill: Bill;
  charges: Charge[];
  selectedChargeIds: string[];
  message: Message;
  onUpdateMessage: (updatedMessage: Message) => void;
  onBackToBill: () => void;
  onContinueToFinish: () => void;
}

export const MessageScreen: React.FC<MessageScreenProps> = ({
  bill,
  charges,
  selectedChargeIds,
  message,
  onUpdateMessage,
  onBackToBill,
  onContinueToFinish,
}) => {
  const selectedCharges = charges.filter((c) => selectedChargeIds.includes(c.id));
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showRewriteConfirm, setShowRewriteConfirm] = useState(false);
  const [showUpdateRefConfirm, setShowUpdateRefConfirm] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Sanitize genuine extracted reference from document
  const extractedReference = sanitizeCustomerReference(bill?.account_reference);

  // Current editable reference in the field
  const [referenceInput, setReferenceInput] = useState<string>(() => {
    if (message.additional_reference !== undefined) {
      return message.additional_reference;
    }
    return extractedReference || '';
  });

  // Track the reference used when the current draft was generated
  const [lastDraftedReference, setLastDraftedReference] = useState<string>(() => {
    if (message.is_drafted) {
      return (message.additional_reference !== undefined ? message.additional_reference : (extractedReference || '')).trim();
    }
    return '';
  });

  // Clean current reference
  const cleanCurrentRef = referenceInput.trim();
  const cleanLastDraftedRef = lastDraftedReference.trim();

  // Distinguish reference origin
  const isExtractedMatch = !!extractedReference && cleanCurrentRef === extractedReference;
  const isManuallyEntered = !!cleanCurrentRef && (!extractedReference || cleanCurrentRef !== extractedReference);
  const isReferenceEmpty = !cleanCurrentRef;

  // Check if draft needs updating because the reference changed
  const isReferenceOutOfSync = message.is_drafted && cleanCurrentRef !== cleanLastDraftedRef;

  // Default fallback template generator (facts only, never internal UUIDs)
  const getBasicVerifiedTemplate = (refToUse?: string) => {
    const providerName = bill?.provider || 'service provider';
    const currency = bill?.currency || 'INR';
    const effectiveRaw = refToUse !== undefined ? refToUse : referenceInput;
    const cleanRef = sanitizeCustomerReference(effectiveRaw);
    const refText = cleanRef ? ` (Ref: ${cleanRef})` : '';

    if (!selectedCharges || selectedCharges.length === 0) {
      return `Hello, could you please clarify the recent charges on my ${providerName} bill${refText}? Thank you.`;
    }

    if (selectedCharges.length === 1) {
      const item = selectedCharges[0];
      const amt = item.amount !== null ? formatMinorUnits(item.amount, currency) : '';
      return `Hello, my ${providerName} bill${refText} includes a charge of ${amt} for "${item.description || 'an item'}". Could you explain what this charge relates to and share the itemised details? Thank you.`;
    }

    const itemsList = selectedCharges
      .map((c) => `"${c.description || 'Item'}" (${c.amount !== null ? formatMinorUnits(c.amount, currency) : 'unspecified'})`)
      .join(', ');
    return `Hello, my ${providerName} bill${refText} includes the following charges: ${itemsList}. Could you explain what these charges cover and share the usage breakdown? Thank you.`;
  };

  // Generate draft message using server-side Gemini
  const handleGenerateDraft = async (refOverride?: string) => {
    setIsGenerating(true);
    setGenerationError(null);

    const targetRef = refOverride !== undefined ? refOverride : referenceInput;
    const cleanTargetRef = sanitizeCustomerReference(targetRef) || '';

    try {
      const response = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCharges,
          billContext: {
            provider: bill?.provider,
            service: bill?.service,
            date: bill?.date,
            billed_amount: bill?.billed_amount,
            expected_amount: bill?.expected_amount,
            account_reference: cleanTargetRef || undefined,
            currency: bill?.currency || 'INR',
          },
          additionalReference: cleanTargetRef || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Could not generate message draft from AI service.');
      }

      const data = await response.json();
      const generatedDraft = data.draft || getBasicVerifiedTemplate(cleanTargetRef);

      onUpdateMessage({
        ...message,
        draft_text: generatedDraft,
        final_text: generatedDraft,
        is_drafted: true,
        additional_reference: targetRef,
        approved_at: null, // Reset approval on regenerate
        copied_at: null,
        sent_status: 'not_sent',
      });
      setLastDraftedReference(targetRef.trim());
    } catch (err: any) {
      console.warn('Draft message caught error, using verified template fallback:', err?.message);
      const fallback = getBasicVerifiedTemplate(cleanTargetRef);
      onUpdateMessage({
        ...message,
        draft_text: fallback,
        final_text: fallback,
        is_drafted: true,
        additional_reference: targetRef,
        approved_at: null,
        copied_at: null,
        sent_status: 'not_sent',
      });
      setLastDraftedReference(targetRef.trim());
    } finally {
      setIsGenerating(false);
      setShowRewriteConfirm(false);
      setShowUpdateRefConfirm(false);
    }
  };

  // Initial draft on screen open if not drafted yet
  useEffect(() => {
    if (!message.is_drafted && !message.final_text && selectedCharges.length > 0) {
      handleGenerateDraft(referenceInput);
    }
  }, []);

  // Handle user typing or clearing reference input
  const handleReferenceChange = (newRef: string) => {
    setReferenceInput(newRef);

    // Invalidate approval immediately whenever reference is modified
    onUpdateMessage({
      ...message,
      additional_reference: newRef,
      approved_at: null,
      copied_at: null,
      sent_status: 'not_sent',
    });
  };

  // Request updating draft for reference change with check for custom text edits
  const handleRequestUpdateDraft = () => {
    const hasManualEdits = !!message.final_text && message.final_text !== message.draft_text;
    if (hasManualEdits) {
      setShowUpdateRefConfirm(true);
    } else {
      handleGenerateDraft(referenceInput);
    }
  };

  // Text change in draft by user: clears approval and copied status
  const handleTextChange = (newText: string) => {
    onUpdateMessage({
      ...message,
      final_text: newText,
      approved_at: null, // Invalidate approval upon edit
      copied_at: null,
      sent_status: 'not_sent',
    });
  };

  // Explicit approval: only allowed when reference is in sync
  const handleApprove = () => {
    if (isReferenceOutOfSync) return;
    onUpdateMessage({
      ...message,
      approved_at: new Date().toISOString(),
    });
  };

  // Copy message: sets copied_at, but does NOT mark sent
  const handleCopy = async () => {
    if (!message.approved_at) return;
    try {
      await navigator.clipboard.writeText(message.final_text);
      setCopied(true);
      onUpdateMessage({
        ...message,
        copied_at: new Date().toISOString(),
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      console.error('Clipboard copy failed', e);
      setCopyError(true);
    }
  };

  // Sent status confirmation: strictly controlled by user click
  const handleSentToggle = (sent: boolean) => {
    onUpdateMessage({
      ...message,
      sent_status: sent ? 'sent' : 'not_sent',
    });
  };

  const isApproved = !!message.approved_at;
  const isCopied = !!message.copied_at || copied;
  const isSent = message.sent_status === 'sent';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-[#20221F]">
          Ask for clarification.
        </h1>
        <p className="mt-1 text-sm text-[#555B55]">
          Review the wording, then copy it to send yourself.
        </p>
      </div>

      {/* Selected Charges Indicator */}
      <div className="mb-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-[#D8D3C8] bg-[#FFFDF7] px-3.5 py-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-[#2546C4]" />
        <span className="font-mono text-[11px] font-bold text-[#555B55]">
          Selected charge{selectedCharges.length !== 1 ? 's' : ''}:
        </span>
        {selectedCharges.map((c, i) => (
          <span key={c.id} className="font-mono font-bold text-[#20221F]">
            {c.description} ({formatMinorUnits(c.amount, bill.currency)})
            {i < selectedCharges.length - 1 ? ',' : ''}
          </span>
        ))}
      </div>

      {/* Generation Error Banner with Retry */}
      {generationError && (
        <div className="mb-6 rounded-lg border border-[#F2D7A1] bg-[#FFF0D6] p-4 text-xs text-[#785015]">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Generation notice:</span> {generationError}
              <div className="mt-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleGenerateDraft(referenceInput)}
                  className="px-3 py-1 font-mono font-bold text-white bg-[#2546C4] rounded hover:bg-[#1C369B] flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reference Field Card (Requirement 3) */}
      <div className="mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <label htmlFor="reference-input" className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#20221F]">
            <Tag className="h-3.5 w-3.5 text-[#2546C4]" />
            <span>Booking / Invoice / Account Reference (optional)</span>
          </label>

          {/* Reference Origin Badge */}
          <div>
            {isExtractedMatch && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#285840] bg-[#EAF1E8] border border-[#C5DDC0] px-2 py-0.5 rounded">
                <CheckCircle2 className="h-3 w-3" />
                <span>Extracted from document</span>
              </span>
            )}
            {isManuallyEntered && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#2546C4] bg-[#EBF0FF] border border-[#BACDFD] px-2 py-0.5 rounded">
                <Edit2 className="h-3 w-3" />
                <span>Manually entered</span>
              </span>
            )}
            {isReferenceEmpty && extractedReference && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#777B73]">
                <span>Reference removed</span>
                <button
                  type="button"
                  onClick={() => handleReferenceChange(extractedReference)}
                  className="font-bold text-[#2546C4] underline hover:text-[#1C369B] cursor-pointer"
                >
                  Restore extracted ({extractedReference})
                </button>
              </span>
            )}
            {isReferenceEmpty && !extractedReference && (
              <span className="text-[11px] font-mono text-[#777B73]">
                No reference found on bill
              </span>
            )}
          </div>
        </div>

        {/* Input with Clear Button */}
        <div className="relative mt-2">
          <input
            id="reference-input"
            type="text"
            value={referenceInput}
            onChange={(e) => handleReferenceChange(e.target.value)}
            placeholder="e.g., PNR, Booking ID, Invoice No., or Account Number"
            className="w-full rounded-md border border-[#D8D3C8] bg-[#F4F4EF] px-3.5 py-2.5 font-mono text-sm font-semibold text-[#20221F] placeholder-[#777B73] focus:border-[#2546C4] focus:bg-white focus:outline-hidden transition-colors pr-9"
          />
          {referenceInput && (
            <button
              type="button"
              onClick={() => handleReferenceChange('')}
              title="Remove reference"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777B73] hover:text-[#20221F] p-1 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-2 text-[11px] text-[#555B55] leading-relaxed">
          {cleanCurrentRef
            ? `Included in your clarification message so ${bill.provider || 'the provider'} can locate your record.`
            : 'Left blank. Your clarification message will be drafted without mentioning any reference.'}
        </p>
      </div>

      {/* Clarification Draft Card */}
      <div className="mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8D3C8]/60 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#2546C4]" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#20221F]">
              Clarification Draft
            </h2>
          </div>
          <span className="font-mono text-[11px] text-[#777B73]">
            {message?.final_text?.length || 0} chars
          </span>
        </div>

        {/* Out of Sync Notice Banner (Requirement 4) */}
        {isReferenceOutOfSync && (
          <div className="mb-4 rounded-md bg-[#FFF0D6] border border-[#F2D7A1] p-3 text-xs text-[#785015] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Reference updated to {cleanCurrentRef ? `"${cleanCurrentRef}"` : '(blank)'}.
                </p>
                <p className="mt-0.5 text-[11px]">
                  Update the message draft to reflect this change before approving.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestUpdateDraft}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2546C4] text-white font-mono text-xs font-bold rounded hover:bg-[#1C369B] shrink-0 cursor-pointer shadow-2xs transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Update draft wording</span>
            </button>
          </div>
        )}

        {/* Text Area */}
        <div className="relative">
          {isGenerating ? (
            <div className="h-36 flex flex-col items-center justify-center text-xs font-mono text-[#555B55]">
              <Loader2 className="h-5 w-5 animate-spin text-[#2546C4] mb-2" />
              <span>Drafting message from bill facts…</span>
            </div>
          ) : (
            <textarea
              rows={5}
              value={message?.final_text || ''}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Draft clarification message..."
              className="w-full rounded-md border border-[#D8D3C8] bg-[#FFFDF7] p-3 text-sm text-[#20221F] leading-relaxed focus:border-[#2546C4] focus:outline-hidden transition-colors"
            />
          )}
        </div>

        {/* Status notice */}
        {!isApproved && (message?.final_text?.length ?? 0) > 0 && (
          <div className="mt-2 text-[11px] text-[#785015] bg-[#FFF0D6] border border-[#F2D7A1] px-2.5 py-1 rounded">
            {isReferenceOutOfSync
              ? 'Message wording must be updated with your current reference before you can approve it.'
              : 'Message wording has not been approved yet. Review the text and approve it when ready to copy.'}
          </div>
        )}
        {isApproved && (
          <div className="mt-2 text-[11px] text-[#285840] bg-[#EAF1E8] border border-[#C5DDC0] px-2.5 py-1 rounded flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              <span>Approved by you.</span>
            </div>
            {isCopied && (
              <span className="text-[10px] font-mono text-[#285840]">
                (Copied to clipboard)
              </span>
            )}
          </div>
        )}

        {/* Footer info & rewrite action */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs pt-3 border-t border-[#D8D3C8]/60">
          <div className="flex items-start gap-1.5 text-[#777B73] max-w-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#777B73] shrink-0 mt-0.5" />
            <span className="text-[11px]">
              Grounded in bill facts. BillShield does not send messages directly.
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (message?.final_text && message.final_text !== message.draft_text) {
                setShowRewriteConfirm(true);
              } else {
                handleGenerateDraft(referenceInput);
              }
            }}
            disabled={isGenerating}
            className="flex items-center gap-1 text-[11px] font-mono font-medium text-[#555B55] hover:text-[#2546C4] cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Rewrite draft (replaces draft)</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isReferenceOutOfSync}
            onClick={handleApprove}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold rounded-md transition-colors ${
              isReferenceOutOfSync
                ? 'bg-[#E0DDD5] text-[#8C8F8A] cursor-not-allowed border border-[#D8D3C8]'
                : isApproved
                ? 'bg-[#285840] text-white hover:bg-[#1E4431]'
                : 'bg-[#2546C4] text-white hover:bg-[#1C369B] cursor-pointer'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>
              {isReferenceOutOfSync
                ? 'Update draft to approve'
                : isApproved
                ? 'Approved by you'
                : 'Approve message'}
            </span>
          </button>

          <button
            type="button"
            disabled={!isApproved}
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold rounded-md border transition-colors ${
              isApproved
                ? 'bg-[#FFFDF7] text-[#20221F] border-[#D8D3C8] hover:border-[#2546C4] hover:text-[#2546C4] cursor-pointer'
                : 'bg-[#F4F4EF] text-[#9FA39D] border-[#D8D3C8] cursor-not-allowed'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#285840]" />
                <span className="text-[#285840]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy message</span>
              </>
            )}
          </button>
        </div>

        {copied && (
          <p className="mt-2 text-[11px] text-[#285840]">
            Copied. You can now paste and send it using your provider's app or website.
          </p>
        )}
        {copyError && (
          <p className="mt-2 text-[11px] text-[#A12D2D]">
            Clipboard copy failed. Please highlight and copy the text manually.
          </p>
        )}
      </div>

      {/* External Send Confirmation Card */}
      <div className="mb-8 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F4EF] text-[#555B55] shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-[#20221F]">
              Have you sent this message outside BillShield?
            </h3>
            <p className="text-xs text-[#555B55] mt-1 leading-relaxed">
              BillShield sends nothing itself. Confirm only after you have sent it through your provider's app or website.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSentToggle(true)}
                className={`px-4 py-1.5 font-mono text-xs font-bold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSent
                    ? 'bg-[#285840] text-white border-[#285840]'
                    : 'bg-[#FFFDF7] text-[#20221F] border-[#D8D3C8] hover:border-[#2546C4]'
                }`}
              >
                <span>{isSent ? '✓ Yes, I sent it' : '> Yes, I sent it'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSentToggle(false)}
                className={`px-4 py-1.5 font-mono text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                  !isSent
                    ? 'bg-[#F4F4EF] text-[#20221F] border-[#D8D3C8]'
                    : 'bg-[#FFFDF7] text-[#555B55] border-[#D8D3C8] hover:text-[#20221F]'
                }`}
              >
                Not yet
              </button>
            </div>

            <p className="mt-2 text-[11px] text-[#555B55]">
              {isSent
                ? '✓ Marked as sent by you.'
                : 'Not sent. You can continue to finish anytime.'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-[#D8D3C8]">
        <button
          type="button"
          onClick={onBackToBill}
          className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#555B55] hover:text-[#20221F] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to bill</span>
        </button>

        <button
          type="button"
          onClick={onContinueToFinish}
          className="flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-bold text-white bg-[#2546C4] rounded-md hover:bg-[#1C369B] transition-colors cursor-pointer"
        >
          <span>Continue to finish</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Rewrite Confirmation Modal (when user clicks Rewrite Draft) */}
      {showRewriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] p-5 shadow-lg text-[#20221F]">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#785015] mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Replace custom edits?</span>
            </h4>
            <p className="text-xs text-[#555B55] leading-relaxed">
              Rewriting will replace your edited wording with a fresh draft.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRewriteConfirm(false)}
                className="px-3 py-1.5 text-xs font-mono rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8] cursor-pointer"
              >
                Keep my edits
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDraft(referenceInput)}
                className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-[#2546C4] text-white hover:bg-[#1C369B] cursor-pointer"
              >
                Rewrite draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Reference Warning Modal (Requirement 4: Do not overwrite manual edits without warning) */}
      {showUpdateRefConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] p-5 shadow-lg text-[#20221F]">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#785015] mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Update draft with new reference?</span>
            </h4>
            <p className="text-xs text-[#555B55] leading-relaxed">
              You have made custom edits to your message. Updating the draft will replace your wording with a newly generated message reflecting reference{' '}
              <strong className="text-[#20221F] font-mono">{cleanCurrentRef ? `"${cleanCurrentRef}"` : '(none)'}</strong>.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  // Keep custom edits and synchronize reference tracker so approval can proceed
                  setShowUpdateRefConfirm(false);
                  setLastDraftedReference(cleanCurrentRef);
                }}
                className="px-3 py-1.5 text-xs font-mono rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8] cursor-pointer"
              >
                Keep my custom edits
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDraft(referenceInput)}
                className="px-3 py-1.5 text-xs font-mono font-bold rounded bg-[#2546C4] text-white hover:bg-[#1C369B] cursor-pointer"
              >
                Update draft wording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
