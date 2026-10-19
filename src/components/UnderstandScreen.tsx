import React, { useState } from 'react';
import {
  FileText,
  Edit2,
  HelpCircle,
  Hash,
  Sigma,
  AlertTriangle,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  X,
  Loader2,
  Eye,
  Undo2,
  Check,
} from 'lucide-react';
import { Bill, Charge, Analysis, ChargeExplanation, ChargeType } from '../types';
import { formatMinorUnits, parseToMinorUnits, NON_CONTRIBUTING_TYPES } from '../utils/money';
import { sanitizeCustomerReference } from '../utils/reference';

interface UnderstandScreenProps {
  bill: Bill;
  charges: Charge[];
  analysis: Analysis;
  onUpdateBill: (updatedBill: Bill) => void;
  onUpdateCharges: (updatedCharges: Charge[]) => void;
  selectedChargeIds: string[];
  onToggleChargeSelect: (id: string) => void;
  onSelectAllCharges: (select: boolean) => void;
  onGoToMessage: (additionalRef?: string) => void;
  onGoToFinishWithoutDrafting: () => void;
  onReupload: () => void;
}

export const UnderstandScreen: React.FC<UnderstandScreenProps> = ({
  bill,
  charges,
  analysis,
  onUpdateBill,
  onUpdateCharges,
  selectedChargeIds,
  onToggleChargeSelect,
  onSelectAllCharges,
  onGoToMessage,
  onGoToFinishWithoutDrafting,
  onReupload,
}) => {
  // Inspection panel state
  const [inspectedChargeId, setInspectedChargeId] = useState<string | null>(() => {
    const match = charges?.find((c) => (c?.description || '').toLowerCase().includes('isd') || c?.type === 'fee');
    return match?.id || charges?.[0]?.id || null;
  });
  const [explanations, setExplanations] = useState<Record<string, ChargeExplanation>>({});
  const [loadingExplanationId, setLoadingExplanationId] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  // Modals state
  const [isEditBillModalOpen, setIsEditBillModalOpen] = useState(false);
  const [isViewOriginalModalOpen, setIsViewOriginalModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [isAddChargeModalOpen, setIsAddChargeModalOpen] = useState(false);
  const [recentlyDeletedCharge, setRecentlyDeletedCharge] = useState<{ charge: Charge; index: number } | null>(null);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);

  // Inspected charge object
  const inspectedCharge = charges.find((c) => c.id === inspectedChargeId) || null;
  const inspectedExplanation = inspectedChargeId ? explanations[inspectedChargeId] : null;

  // Fetch or generate charge explanation
  const handleExplainCharge = async (charge: Charge | null) => {
    if (!charge) return;
    setInspectedChargeId(charge.id);
    setExplanationError(null);

    if (explanations[charge.id]) {
      return;
    }

    setLoadingExplanationId(charge.id);
    try {
      const response = await fetch('/api/explain-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charge,
          billContext: {
            provider: bill.provider,
            service: bill.service,
            date: bill.date,
            billed_amount: bill.billed_amount,
            currency: bill.currency,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to explain charge');
      }

      const explanation = await response.json();
      if (explanation && explanation.whatBillShows) {
        setExplanations((prev) => ({
          ...prev,
          [charge.id]: explanation,
        }));
      }
    } catch (err: any) {
      console.warn('Explain charge error caught, using factual fallback:', err?.message);
      // Fallback explanation so user is never blocked
      setExplanations((prev) => ({
        ...prev,
        [charge.id]: {
          whatBillShows: `The bill lists "${charge.description}" with an amount of ${charge.amount !== null ? formatMinorUnits(charge.amount, bill?.currency || 'INR') : 'unspecified'}.`,
          whatThisUsuallyMeans: `This represents a standard line item billed under ${charge.type.replace('_', ' ')} by ${bill?.provider || 'your service provider'}.`,
          whatRemainsUnclear: `The bill does not include an itemised usage breakdown or tariff calculation for this specific charge.`,
        },
      }));
    } finally {
      setLoadingExplanationId(null);
    }
  };

  const handleDeleteCharge = (chargeId: string) => {
    const idx = charges.findIndex((c) => c.id === chargeId);
    if (idx >= 0) {
      const toDelete = charges[idx];
      setRecentlyDeletedCharge({ charge: toDelete, index: idx });
      onUpdateCharges(charges.filter((c) => c.id !== chargeId));
    }
  };

  const handleUndoDelete = () => {
    if (recentlyDeletedCharge) {
      const newCharges = [...charges];
      newCharges.splice(recentlyDeletedCharge.index, 0, recentlyDeletedCharge.charge);
      onUpdateCharges(newCharges);
      setRecentlyDeletedCharge(null);
    }
  };

  // Check if we need to ask for missing context (booking ref / account ref) before drafting
  const handleStartDrafting = () => {
    if (selectedChargeIds.length === 0) return;

    // If bill already has a genuine account reference, proceed directly
    const genuineRef = sanitizeCustomerReference(bill.account_reference);
    if (genuineRef) {
      onGoToMessage(genuineRef);
      return;
    }

    // Open context prompt dialog
    setIsContextModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-[#20221F]">
          Your bill, explained.
        </h1>
      </div>

      {/* Undo Delete Notice */}
      {recentlyDeletedCharge && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-[#FFF0D6] border border-[#F2D7A1] p-3 text-xs text-[#785015]">
          <span>Removed item "{recentlyDeletedCharge.charge.description}".</span>
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1 font-bold underline hover:text-[#20221F]"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Bill Details Summary Card */}
      <div className="mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#D8D3C8]/60 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EAF1E8] text-[#2546C4]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#777B73]">
                BILL DETAILS
              </div>
              <div className="font-semibold text-lg text-[#20221F]">
                {bill.provider ? `${bill.provider} Statement` : 'Uploaded Bill'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditBillModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-[#20221F] bg-[#F4F4EF] hover:bg-[#E8E8E3] rounded-md border border-[#D8D3C8] transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5 text-[#555B55]" />
              <span>Edit details</span>
            </button>
            <button
              onClick={() => setIsViewOriginalModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-[#20221F] bg-[#F4F4EF] hover:bg-[#E8E8E3] rounded-md border border-[#D8D3C8] transition-colors"
            >
              <Eye className="h-3.5 w-3.5 text-[#555B55]" />
              <span>View original bill</span>
            </button>
          </div>
        </div>

        {/* 4 Metadata Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#777B73] block mb-0.5">
              PROVIDER
            </span>
            <span className="font-bold text-[#20221F]">
              {bill.provider || 'Not detected'}
            </span>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#777B73] block mb-0.5">
              SERVICE
            </span>
            <span className="text-[#20221F]">
              {bill.service || 'General Service'}
            </span>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#777B73] block mb-0.5">
              BILL DATE
            </span>
            <span className="font-mono text-[#20221F]">
              {bill.date || 'Not specified'}
            </span>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#777B73] block mb-0.5">
              CURRENCY
            </span>
            <span className="font-mono text-[#20221F]">
              {bill.currency} (₹)
            </span>
          </div>
        </div>
      </div>

      {/* 3 Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* Card 1: You Expected */}
        <div className="rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-[#777B73] mb-1">
              <span>1. YOU EXPECTED</span>
              <HelpCircle className="h-3.5 w-3.5" />
            </div>
            <div className="font-mono text-2xl font-bold tracking-tight text-[#20221F] tabular-nums mt-1">
              {bill.expected_amount !== null
                ? formatMinorUnits(bill.expected_amount, bill.currency)
                : 'Not provided'}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-2 border-t border-[#D8D3C8]/40 text-xs">
            <span className="text-[#777B73] text-[11px]">
              {bill.expected_amount !== null ? 'Entered before upload' : 'Comparison basis'}
            </span>
            <button
              onClick={() => setIsEditBillModalOpen(true)}
              className="font-mono font-bold text-[#2546C4] hover:underline"
            >
              Add / Edit
            </button>
          </div>
        </div>

        {/* Card 2: Printed on your bill */}
        <div className="rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-[#777B73] mb-1">
              <span>2. PRINTED ON YOUR BILL</span>
              <Hash className="h-3.5 w-3.5" />
            </div>
            <div className="font-mono text-2xl font-bold tracking-tight text-[#20221F] tabular-nums mt-1">
              {bill.billed_amount !== null
                ? formatMinorUnits(bill.billed_amount, bill.currency)
                : 'Couldn’t read'}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-2 border-t border-[#D8D3C8]/40 text-xs">
            <span className="text-[#777B73] text-[11px]">
              {bill.billed_amount !== null ? 'Document payable total' : 'Missing on bill'}
            </span>
            <button
              onClick={() => setIsEditBillModalOpen(true)}
              className="font-mono font-bold text-[#2546C4] hover:underline"
            >
              Correct amount
            </button>
          </div>
        </div>

        {/* Card 3: Total of bill items */}
        <div className="rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-[#777B73] mb-1">
              <span>3. TOTAL OF BILL ITEMS</span>
              <Sigma className="h-3.5 w-3.5" />
            </div>
            <div className="font-mono text-2xl font-bold tracking-tight text-[#20221F] tabular-nums mt-1">
              {analysis.calculated_total !== null
                ? formatMinorUnits(analysis.calculated_total, bill.currency)
                : 'Needs more info'}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-2 border-t border-[#D8D3C8]/40 text-xs">
            <span className="text-[#777B73] text-[11px]">
              {analysis.calculated_total !== null
                ? `All ${charges.length} items accounted for`
                : 'Item breakdown incomplete'}
            </span>
            <span
              className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                analysis.status === 'match'
                  ? 'text-[#285840] bg-[#EAF1E8]'
                  : 'text-[#785015] bg-[#FFF0D6]'
              }`}
            >
              {analysis.status === 'match' ? '100% breakdown' : 'Needs review'}
            </span>
          </div>
        </div>
      </div>

      {/* Difference Statements */}
      <div className="space-y-2 mb-6">
        {/* Expectation difference statement */}
        {analysis.expected_difference !== null && (
          <div
            className={`rounded-lg p-3.5 text-xs flex items-start gap-2.5 ${
              analysis.expected_difference > 0
                ? 'bg-[#FFF0D6] border border-[#F2D7A1] text-[#785015]'
                : analysis.expected_difference < 0
                ? 'bg-[#EAF1E8] border border-[#C5DDC0] text-[#285840]'
                : 'bg-[#EAF1E8] border border-[#C5DDC0] text-[#285840]'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                {analysis.expected_difference > 0
                  ? `${formatMinorUnits(analysis.expected_difference, bill.currency)} above what you expected`
                  : analysis.expected_difference < 0
                  ? `${formatMinorUnits(Math.abs(analysis.expected_difference), bill.currency)} below what you expected`
                  : 'Matches what you expected'}
              </div>
              <div className="mt-0.5 text-[11px] opacity-90">
                {formatMinorUnits(bill.expected_amount, bill.currency)} expected vs{' '}
                {formatMinorUnits(bill.billed_amount, bill.currency)} printed
              </div>
            </div>
          </div>
        )}

        {/* Item total arithmetic statement */}
        <div
          className={`rounded-lg p-3.5 text-xs flex items-start gap-2.5 ${
            analysis.status === 'match'
              ? 'bg-[#EAF1E8] border border-[#C5DDC0] text-[#285840]'
              : analysis.status === 'mismatch'
              ? 'bg-[#FFF0D6] border border-[#F2D7A1] text-[#785015]'
              : 'bg-[#F4F4EF] border border-[#D8D3C8] text-[#555B55]'
          }`}
        >
          {analysis.status === 'match' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#285840]" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#785015]" />
          )}
          <div>
            <div className="font-bold text-sm">
              {analysis.status === 'match'
                ? `The bill items match the printed total (₹0.00 difference)`
                : analysis.status === 'mismatch'
                ? `The bill items add up to ${formatMinorUnits(
                    Math.abs(analysis.arithmetic_difference || 0),
                    bill.currency
                  )} ${
                    (analysis.arithmetic_difference || 0) > 0 ? 'more' : 'less'
                  } than the printed total`
                : 'Item breakdown is needed before we can check the total.'}
            </div>
            <div className="mt-0.5 text-[11px] opacity-90">
              {analysis.status === 'match'
                ? 'Matching totals don’t tell us why a charge was added. You can ask about any item.'
                : 'You can correct item amounts or clarify items that might already be included.'}
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Area: Left Charges List, Right Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Column: Charge List (lg:col-span-7) */}
        <div className="lg:col-span-7 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#D8D3C8]">
              <div>
                <h2 className="font-semibold text-base text-[#20221F]">What makes up your bill</h2>
                <p className="text-xs text-[#555B55]">Select anything you'd like explained.</p>
              </div>
              <span className="font-mono text-xs font-bold text-[#777B73]">
                {charges.length} Items Listed
              </span>
            </div>

            {/* List of charges */}
            <div className="divide-y divide-[#D8D3C8]/50 mt-2">
              {charges.map((charge) => {
                const isSelected = selectedChargeIds.includes(charge.id);
                const isInspected = inspectedChargeId === charge.id;
                const isSummary = NON_CONTRIBUTING_TYPES.includes(charge.type);
                const isExplaining = loadingExplanationId === charge.id;
                const isExplained = !!explanations[charge.id];

                return (
                  <div
                    key={charge.id}
                    className={`p-3 rounded-md transition-colors flex items-center justify-between gap-3 ${
                      isInspected ? 'bg-[#F0F4FF] border border-[#2546C4]/30' : 'hover:bg-[#F4F4EF]'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleChargeSelect(charge.id)}
                        className="mt-1 h-4 w-4 rounded border-[#777B73] text-[#2546C4] focus:ring-[#2546C4] cursor-pointer"
                        aria-label={`Select ${charge.description}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-[#20221F] truncate">
                            {charge.description}
                          </span>
                          {isInspected && (
                            <span className="font-mono text-[9px] font-bold text-white bg-[#2546C4] px-1 py-0.2 rounded">
                              FOCUS
                            </span>
                          )}
                          {isSummary && (
                            <span className="font-mono text-[9px] text-[#785015] bg-[#FFF0D6] px-1 py-0.2 rounded">
                              Subtotal — not added again
                            </span>
                          )}
                          {charge.type === 'payment' && (
                            <span className="font-mono text-[9px] text-[#285840] bg-[#EAF1E8] px-1 py-0.2 rounded">
                              Payment received
                            </span>
                          )}
                          {charge.type === 'credit' && (
                            <span className="font-mono text-[9px] text-[#285840] bg-[#EAF1E8] px-1 py-0.2 rounded">
                              Credit applied
                            </span>
                          )}
                          {charge.type === 'previous_balance' && (
                            <span className="font-mono text-[9px] text-[#555B55] bg-[#F4F4EF] px-1 py-0.2 rounded">
                              Previous balance
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#777B73] capitalize">
                          {charge.type.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className={`font-mono text-sm font-bold tabular-nums ${
                          charge.type === 'payment' || charge.type === 'credit' || charge.type === 'refund'
                            ? 'text-[#285840]'
                            : 'text-[#20221F]'
                        }`}
                      >
                        {charge.amount !== null
                          ? charge.type === 'payment' || charge.type === 'credit' || charge.type === 'refund'
                            ? `-${formatMinorUnits(Math.abs(charge.amount), bill.currency)}`
                            : formatMinorUnits(charge.amount, bill.currency)
                          : 'Unspecified'}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Explain button with accurate states */}
                        <button
                          type="button"
                          onClick={() => handleExplainCharge(charge)}
                          disabled={isExplaining}
                          className={`px-2 py-1 text-xs font-mono font-medium rounded border transition-colors flex items-center gap-1 ${
                            isExplaining
                              ? 'bg-[#F4F4EF] text-[#2546C4] border-[#D8D3C8] cursor-wait'
                              : isExplained
                              ? 'bg-[#EAF1E8] text-[#285840] border-[#C5DDC0] hover:bg-[#D8EADB]'
                              : 'bg-white text-[#2546C4] border-[#D8D3C8] hover:bg-[#F5F1E8]'
                          }`}
                        >
                          {isExplaining ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Explaining…</span>
                            </>
                          ) : isExplained ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Explained</span>
                            </>
                          ) : (
                            <span>Explain</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCharge(charge)}
                          className="p-1 text-[#777B73] hover:text-[#20221F] rounded"
                          title="Edit charge"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCharge(charge.id)}
                          className="p-1 text-[#777B73] hover:text-[#A12D2D] rounded"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sum Total Row */}
            <div className="mt-4 pt-3 border-t border-[#D8D3C8] flex items-center justify-between text-xs font-mono font-bold text-[#20221F]">
              <span>SUM TOTAL</span>
              <span className="text-sm">
                {analysis.calculated_total !== null
                  ? formatMinorUnits(analysis.calculated_total, bill.currency)
                  : 'Incomplete'}
              </span>
            </div>
          </div>

          {/* Bottom selection bar (Cleaned up: No duplicate Draft a message button!) */}
          <div className="mt-6 pt-4 border-t border-[#D8D3C8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#F4F4EF] p-3 rounded-md">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2546C4]" />
              <span className="font-mono text-xs font-bold text-[#20221F]">
                {selectedChargeIds.length} item{selectedChargeIds.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectAllCharges(selectedChargeIds.length !== charges.length)}
                className="px-2.5 py-1 text-xs font-mono text-[#555B55] hover:text-[#20221F] underline"
              >
                {selectedChargeIds.length === charges.length ? 'Clear selection' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddChargeModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8] text-[#20221F]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add missing item</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Inspection Panel (lg:col-span-5) */}
        <div className="lg:col-span-5 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-5 flex flex-col justify-between">
          {inspectedCharge ? (
            <div>
              <div className="pb-3 border-b-2 border-[#2546C4]">
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#777B73]">
                  INSPECTION PANEL
                </div>
                <div className="flex items-center justify-between mt-1">
                  <h3 className="font-bold text-base text-[#20221F]">
                    {inspectedCharge.description}
                  </h3>
                  <span className="font-mono text-sm font-bold text-[#2546C4]">
                    {formatMinorUnits(inspectedCharge.amount, bill.currency)}
                  </span>
                </div>
              </div>

              {loadingExplanationId === inspectedCharge.id ? (
                <div className="py-12 text-center text-[#555B55]">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#2546C4]" />
                  <p className="text-xs font-mono">Analyzing charge details…</p>
                  <p className="text-[11px] text-[#777B73] mt-1">This typically takes 2-4 seconds.</p>
                </div>
              ) : explanationError ? (
                <div className="py-8 text-center text-xs">
                  <AlertTriangle className="h-6 w-6 text-[#785015] mx-auto mb-2" />
                  <p className="text-[#785015] font-semibold">{explanationError}</p>
                  <button
                    type="button"
                    onClick={() => inspectedCharge && handleExplainCharge(inspectedCharge)}
                    className="mt-3 px-3 py-1.5 text-xs font-mono font-bold bg-[#2546C4] text-white rounded-md hover:bg-[#1C369B]"
                  >
                    Retry explanation
                  </button>
                </div>
              ) : inspectedExplanation ? (
                <div className="mt-4 space-y-4 text-xs leading-relaxed">
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#555B55] mb-1 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-[#2546C4]" />
                      <span>WHAT YOUR BILL SHOWS</span>
                    </div>
                    <p className="text-[#20221F] bg-[#F4F4EF] p-2.5 rounded-md border border-[#D8D3C8]/60">
                      {inspectedExplanation.whatBillShows}
                    </p>
                  </div>

                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#555B55] mb-1 flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-[#2546C4]" />
                      <span>WHAT THIS USUALLY MEANS</span>
                    </div>
                    <p className="text-[#20221F] bg-[#F4F4EF] p-2.5 rounded-md border border-[#D8D3C8]/60">
                      {inspectedExplanation.whatThisUsuallyMeans}
                    </p>
                  </div>

                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#555B55] mb-1 flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-[#785015]" />
                      <span>WHAT REMAINS UNCLEAR</span>
                    </div>
                    <p className="text-[#785015] bg-[#FFF0D6] p-2.5 rounded-md border border-[#F2D7A1]">
                      {inspectedExplanation.whatRemainsUnclear}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-[#777B73] text-xs">
                  <p>Click "Explain" to get plain-language analysis for this charge.</p>
                  <button
                    type="button"
                    onClick={() => inspectedCharge && handleExplainCharge(inspectedCharge)}
                    className="mt-3 px-3 py-1.5 text-xs font-mono font-bold bg-[#2546C4] text-white rounded-md hover:bg-[#1C369B]"
                  >
                    Explain now
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-[#777B73] text-xs">
              <Search className="h-8 w-8 mx-auto text-[#D8D3C8] mb-2" />
              <p className="font-mono font-semibold text-[#20221F]">No charge selected</p>
              <p className="mt-1">Click "Explain" on any charge on the left to inspect its plain-language breakdown.</p>
            </div>
          )}

          {/* Action button inside Inspection Panel */}
          {inspectedCharge && (
            <div className="mt-6 pt-4 border-t border-[#D8D3C8]">
              <button
                type="button"
                onClick={() => {
                  if (!selectedChargeIds.includes(inspectedCharge.id)) {
                    onToggleChargeSelect(inspectedCharge.id);
                  }
                }}
                className="w-full py-2.5 px-4 font-mono text-xs font-bold text-white bg-[#2546C4] rounded-md hover:bg-[#1C369B] transition-colors"
              >
                {selectedChargeIds.includes(inspectedCharge.id)
                  ? '✓ Included in message selection'
                  : 'Ask about this charge'}
              </button>
              <p className="text-[10px] text-[#777B73] text-center mt-1">
                Adds this item to your clarification message draft
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Single Bottom Primary Navigation Strip (Clear, non-duplicated) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#D8D3C8]">
        <button
          type="button"
          onClick={onGoToFinishWithoutDrafting}
          className="text-xs font-mono font-medium text-[#555B55] hover:text-[#20221F] underline underline-offset-4"
        >
          ✓ Finish without drafting
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReupload}
            className="px-4 py-2.5 font-mono text-xs font-medium text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] rounded-md hover:bg-[#F4F4EF] transition-colors"
          >
            ← Re-upload
          </button>
          <button
            type="button"
            disabled={selectedChargeIds.length === 0}
            onClick={handleStartDrafting}
            className={`px-5 py-2.5 font-mono text-xs font-bold rounded-md transition-colors flex items-center gap-2 ${
              selectedChargeIds.length > 0
                ? 'bg-[#2546C4] text-white hover:bg-[#1C369B]'
                : 'bg-[#D8D3C8] text-[#777B73] cursor-not-allowed'
            }`}
          >
            <span>Draft a message ({selectedChargeIds.length} selected)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MODAL 1: Edit Bill Details */}
      {isEditBillModalOpen && (
        <EditBillDetailsModal
          bill={bill}
          onClose={() => setIsEditBillModalOpen(false)}
          onSave={(updated) => {
            onUpdateBill(updated);
            setIsEditBillModalOpen(false);
          }}
        />
      )}

      {/* MODAL 2: View Original Bill */}
      {isViewOriginalModalOpen && (
        <ViewOriginalModal
          bill={bill}
          onClose={() => setIsViewOriginalModalOpen(false)}
        />
      )}

      {/* MODAL 3: Edit Single Charge */}
      {editingCharge && (
        <EditChargeModal
          charge={editingCharge}
          currency={bill.currency}
          onClose={() => setEditingCharge(null)}
          onSave={(updated) => {
            onUpdateCharges(charges.map((c) => (c.id === updated.id ? updated : c)));
            setEditingCharge(null);
          }}
        />
      )}

      {/* MODAL 4: Add Missing Charge */}
      {isAddChargeModalOpen && (
        <AddChargeModal
          billId={bill.id}
          currency={bill.currency}
          onClose={() => setIsAddChargeModalOpen(false)}
          onAdd={(newCharge) => {
            onUpdateCharges([...charges, newCharge]);
            setIsAddChargeModalOpen(false);
          }}
        />
      )}

      {/* MODAL 5: Optional Missing Context Prompt */}
      {isContextModalOpen && (
        <OptionalContextModal
          provider={bill.provider}
          service={bill.service}
          onClose={() => setIsContextModalOpen(false)}
          onContinueWithout={() => {
            setIsContextModalOpen(false);
            onGoToMessage();
          }}
          onAddAndContinue={(reference) => {
            setIsContextModalOpen(false);
            onUpdateBill({ ...bill, account_reference: reference });
            onGoToMessage(reference);
          }}
        />
      )}
    </div>
  );
};

// Subcomponent: Optional Context Modal (Point 3)
function OptionalContextModal({
  provider,
  service,
  onClose,
  onContinueWithout,
  onAddAndContinue,
}: {
  provider: string | null;
  service: string | null;
  onClose: () => void;
  onContinueWithout: () => void;
  onAddAndContinue: (reference: string) => void;
}) {
  const [refInput, setRefInput] = useState('');

  const s = (service || '').toLowerCase();
  const p = (provider || '').toLowerCase();

  let contextLabel = 'account or reference number';
  let contextHelp = 'It can help the provider locate your account.';

  if (s.includes('travel') || s.includes('flight') || s.includes('hotel') || p.includes('cleartrip') || p.includes('makemytrip')) {
    contextLabel = 'booking reference (e.g. PNR or Booking ID)';
    contextHelp = 'It can help the provider identify your booking.';
  } else if (s.includes('telecom') || s.includes('mobile') || s.includes('broadband') || p.includes('airtel') || p.includes('vi') || p.includes('jio')) {
    contextLabel = 'account or mobile number';
    contextHelp = 'It can help the provider identify your account.';
  } else if (s.includes('electric') || s.includes('water') || s.includes('utility') || s.includes('gas')) {
    contextLabel = 'consumer reference number';
    contextHelp = 'It can help the utility provider identify your meter or account.';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]">
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-5 py-3.5 bg-[#F5F1E8]">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#20221F]">
            One detail before we draft your message.
          </h3>
          <button onClick={onClose} className="p-1 text-[#555B55] hover:text-[#20221F]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <div>
            <p className="font-semibold text-sm text-[#20221F] mb-1">
              Do you have your {contextLabel} handy? (Optional)
            </p>
            <p className="text-[#555B55] leading-relaxed text-xs">
              Adding this detail helps {provider || 'your provider'} locate your billing records and resolve questions about your selected charges faster.
            </p>
          </div>

          <div>
            <label className="block font-mono font-bold text-[11px] mb-1 text-[#20221F]">
              Reference number
            </label>
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="e.g. Account number, Booking ID, or PNR"
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white text-[#20221F]"
              autoFocus
            />
            <span className="block mt-1 text-[11px] text-[#777B73]">
              Optional. We never store this permanently without your explicit save.
            </span>
          </div>

          <div className="pt-3 border-t border-[#D8D3C8] flex flex-col sm:flex-row items-center justify-end gap-2">
            <button
              type="button"
              onClick={onContinueWithout}
              className="w-full sm:w-auto px-3.5 py-2 font-mono text-xs rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8] text-[#555B55]"
            >
              Continue without it
            </button>
            <button
              type="button"
              onClick={() => {
                if (refInput.trim()) {
                  onAddAndContinue(refInput.trim());
                } else {
                  onContinueWithout();
                }
              }}
              className="w-full sm:w-auto px-4 py-2 font-mono text-xs font-bold text-white bg-[#2546C4] rounded hover:bg-[#1C369B]"
            >
              Add reference and continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Edit Bill Details Modal
function EditBillDetailsModal({
  bill,
  onClose,
  onSave,
}: {
  bill: Bill;
  onClose: () => void;
  onSave: (updated: Bill) => void;
}) {
  const [provider, setProvider] = useState(bill.provider || '');
  const [service, setService] = useState(bill.service || '');
  const [date, setDate] = useState(bill.date || '');
  const [accountRef, setAccountRef] = useState(bill.account_reference || '');
  const [currency, setCurrency] = useState(bill.currency || 'INR');
  const [expectedStr, setExpectedStr] = useState(
    bill.expected_amount !== null ? (bill.expected_amount / 100).toFixed(2) : ''
  );
  const [billedStr, setBilledStr] = useState(
    bill.billed_amount !== null ? (bill.billed_amount / 100).toFixed(2) : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...bill,
      provider: provider.trim() || null,
      service: service.trim() || null,
      date: date.trim() || null,
      account_reference: accountRef.trim() || null,
      currency: currency.trim() || 'INR',
      expected_amount: parseToMinorUnits(expectedStr),
      billed_amount: parseToMinorUnits(billedStr),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]">
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-5 py-3.5 bg-[#F5F1E8]">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Edit Bill Details</h3>
          <button onClick={onClose} className="p-1 text-[#555B55] hover:text-[#20221F]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Provider Name</label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Airtel, Vi, Cleartrip"
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
            />
          </div>
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Service Category</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. Telecommunications, Travel"
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono font-bold text-[11px] mb-1">Bill Date</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. 19 Oct 2026"
                className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-mono font-bold text-[11px] mb-1">Account / Booking Ref</label>
              <input
                type="text"
                value={accountRef}
                onChange={(e) => setAccountRef(e.target.value)}
                placeholder="Optional"
                className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono font-bold text-[11px] mb-1">Expected Total (₹)</label>
              <input
                type="text"
                value={expectedStr}
                onChange={(e) => setExpectedStr(e.target.value)}
                placeholder="Leave blank if unknown"
                className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 font-mono text-sm focus:border-[#2546C4] focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-mono font-bold text-[11px] mb-1">Printed Payable (₹)</label>
              <input
                type="text"
                value={billedStr}
                onChange={(e) => setBilledStr(e.target.value)}
                placeholder="e.g. 861.40"
                className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 font-mono text-sm focus:border-[#2546C4] focus:bg-white"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-[#D8D3C8] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-mono text-xs rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-mono text-xs font-bold text-white bg-[#2546C4] rounded hover:bg-[#1C369B]"
            >
              Apply changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Subcomponent: View Original Modal
function ViewOriginalModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg flex flex-col overflow-hidden text-[#20221F]">
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-5 py-3 bg-[#F5F1E8]">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#2546C4]" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Original Bill Document</h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#555B55] hover:text-[#20221F]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center">
          {bill.fileDataUrl ? (
            bill.fileMimeType === 'application/pdf' ? (
              <iframe
                src={bill.fileDataUrl}
                title="Original Bill PDF"
                className="w-full h-[60vh] border border-[#D8D3C8] rounded"
              />
            ) : (
              <img
                src={bill.fileDataUrl}
                alt="Original Bill"
                className="max-h-[60vh] max-w-full rounded border border-[#D8D3C8] object-contain shadow-xs"
              />
            )
          ) : (
            <div className="text-center py-12 text-[#555B55]">
              <FileText className="h-10 w-10 mx-auto text-[#D8D3C8] mb-2" />
              <p className="font-mono text-sm font-semibold text-[#20221F]">Original file was not saved</p>
              <p className="text-xs text-[#777B73] mt-1 max-w-xs mx-auto">
                For your privacy, uploaded image/PDF files are not permanently stored on device or servers. Only structured review numbers are retained.
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-[#D8D3C8] px-5 py-2.5 bg-[#F5F1E8] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 font-mono text-xs rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Edit Charge Modal (With all extended charge types)
function EditChargeModal({
  charge,
  currency,
  onClose,
  onSave,
}: {
  charge: Charge;
  currency: string;
  onClose: () => void;
  onSave: (updated: Charge) => void;
}) {
  const [description, setDescription] = useState(charge.description);
  const [amountStr, setAmountStr] = useState(
    charge.amount !== null ? (charge.amount / 100).toFixed(2) : ''
  );
  const [type, setType] = useState<ChargeType>(charge.type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...charge,
      description: description.trim() || 'Unlabeled item',
      amount: parseToMinorUnits(amountStr),
      type,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]">
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-5 py-3.5 bg-[#F5F1E8]">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Edit Line Item</h3>
          <button onClick={onClose} className="p-1 text-[#555B55] hover:text-[#20221F]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
            />
          </div>
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Amount (₹)</label>
            <input
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 31.00"
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 font-mono text-sm focus:border-[#2546C4] focus:bg-white"
            />
          </div>
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Accounting Role in Bill</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ChargeType)}
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
            >
              <option value="charge">Charge (adds to payable amount)</option>
              <option value="fee">Fee (adds to payable amount)</option>
              <option value="tax">Tax / GST (adds to payable amount)</option>
              <option value="previous_balance">Previous balance / arrears (adds to payable amount)</option>
              <option value="payment">Payment received (reduces payable amount)</option>
              <option value="credit">Credit / Discount (reduces payable amount)</option>
              <option value="refund">Refund (reduces payable amount)</option>
              <option value="rounding">Rounding adjustment (+ or -)</option>
              <option value="subtotal">Subtotal (informational summary, not counted again)</option>
              <option value="total">Printed total summary (not counted again)</option>
              <option value="included">Already included in parent line item</option>
              <option value="unresolved">Unresolved overlap (needs breakdown)</option>
            </select>
          </div>
          <div className="pt-3 border-t border-[#D8D3C8] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-mono text-xs rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-mono text-xs font-bold text-white bg-[#2546C4] rounded hover:bg-[#1C369B]"
            >
              Save item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Subcomponent: Add Charge Modal
function AddChargeModal({
  billId,
  currency,
  onClose,
  onAdd,
}: {
  billId: string;
  currency: string;
  onClose: () => void;
  onAdd: (charge: Charge) => void;
}) {
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<ChargeType>('charge');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onAdd({
      id: `chg-${Date.now()}`,
      bill_id: billId,
      description: description.trim(),
      amount: parseToMinorUnits(amountStr),
      type,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]">
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-5 py-3.5 bg-[#F5F1E8]">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider">Add Missing Item</h3>
          <button onClick={onClose} className="p-1 text-[#555B55] hover:text-[#20221F]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Item Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Surcharge, Roaming fee, Previous balance"
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
              required
            />
          </div>
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Amount (₹)</label>
            <input
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 50.00"
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 font-mono text-sm focus:border-[#2546C4] focus:bg-white"
            />
          </div>
          <div>
            <label className="block font-mono font-bold text-[11px] mb-1">Accounting Role in Bill</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ChargeType)}
              className="w-full rounded border border-[#D8D3C8] bg-[#F4F4EF] px-3 py-2 text-sm focus:border-[#2546C4] focus:bg-white"
            >
              <option value="charge">Charge (adds to payable total)</option>
              <option value="fee">Fee (adds to payable total)</option>
              <option value="tax">Tax / GST (adds to payable total)</option>
              <option value="previous_balance">Previous balance / arrears (adds to payable total)</option>
              <option value="payment">Payment received (reduces payable total)</option>
              <option value="credit">Credit / Discount (reduces payable total)</option>
              <option value="refund">Refund (reduces payable total)</option>
              <option value="rounding">Rounding adjustment</option>
              <option value="subtotal">Subtotal (informational, not added again)</option>
              <option value="included">Already included in parent item</option>
              <option value="unresolved">Unresolved item (needs breakdown)</option>
            </select>
          </div>
          <div className="pt-3 border-t border-[#D8D3C8] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-mono text-xs rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-mono text-xs font-bold text-white bg-[#2546C4] rounded hover:bg-[#1C369B]"
            >
              Add to bill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
