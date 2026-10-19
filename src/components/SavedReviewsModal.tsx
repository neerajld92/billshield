import React, { useState } from 'react';
import { X, Trash2, ArrowRight, Bookmark, Calendar, AlertTriangle, Cloud, HardDrive, RefreshCw, Loader2 } from 'lucide-react';
import { SavedReview } from '../types';
import { formatMinorUnits } from '../utils/money';

interface SavedReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedReviews: SavedReview[];
  onOpenReview: (review: SavedReview) => void;
  onDeleteReview: (id: string, source?: 'local' | 'supabase') => void;
  isCurrentReviewUnsaved: boolean;
  isAuthenticated?: boolean;
  localReviewsCount?: number;
  onSyncLocalReviews?: () => Promise<void>;
}

export const SavedReviewsModal: React.FC<SavedReviewsModalProps> = ({
  isOpen,
  onClose,
  savedReviews,
  onOpenReview,
  onDeleteReview,
  isCurrentReviewUnsaved,
  isAuthenticated,
  localReviewsCount = 0,
  onSyncLocalReviews,
}) => {
  const [reviewToOpen, setReviewToOpen] = useState<SavedReview | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<SavedReview | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dismissSyncBanner, setDismissSyncBanner] = useState(false);

  if (!isOpen) return null;

  const handleConfirmOpen = () => {
    if (reviewToOpen) {
      onOpenReview(reviewToOpen);
      setReviewToOpen(null);
      onClose();
    }
  };

  const handleConfirmDelete = () => {
    if (reviewToDelete) {
      onDeleteReview(reviewToDelete.id, reviewToDelete.source);
      setReviewToDelete(null);
    }
  };

  const handleSync = async () => {
    if (!onSyncLocalReviews) return;
    setIsSyncing(true);
    try {
      await onSyncLocalReviews();
      setDismissSyncBanner(true);
    } catch (e) {
      console.error('Failed to sync reviews', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-reviews-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-6 py-4 bg-[#F5F1E8]">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Cloud className="h-4 w-4 text-[#2546C4]" />
            ) : (
              <Bookmark className="h-4 w-4 text-[#2546C4]" />
            )}
            <h2 id="saved-reviews-title" className="font-mono text-sm font-bold uppercase tracking-wider">
              {isAuthenticated
                ? `Saved Reviews (${savedReviews.length})`
                : `Saved Reviews on this Device (${savedReviews.length})`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#555B55] hover:text-[#20221F] hover:bg-[#E8E8E3] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Explicit Consent Local Review Sync Prompt */}
        {isAuthenticated && localReviewsCount > 0 && !dismissSyncBanner && (
          <div className="p-3 bg-[#EAF1E8] border-b border-[#C5DDC0] text-xs text-[#285840] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2">
              <Cloud className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Found <strong>{localReviewsCount}</strong> review(s) saved on this device. Would you like to sync them to your Supabase account?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setDismissSyncBanner(true)}
                className="px-2.5 py-1 text-xs font-mono rounded border border-[#C5DDC0] bg-white hover:bg-[#F5F1E8] text-[#555B55]"
              >
                Keep local only
              </button>
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-[#285840] text-white hover:bg-[#1E4431] flex items-center gap-1.5"
              >
                {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                <span>Sync to Account</span>
              </button>
            </div>
          </div>
        )}

        {/* Unsaved warning prompt inside modal */}
        {reviewToOpen && (
          <div className="p-4 bg-[#FFF0D6] border-b border-[#F2D7A1] text-xs text-[#785015] flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-[#785015] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">You have an unsaved review currently open.</span>
                <p className="mt-0.5">Opening this saved review will replace your active unsaved work. Would you like to proceed?</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setReviewToOpen(null)}
                className="px-2.5 py-1 text-xs font-mono rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOpen}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-[#2546C4] text-white hover:bg-[#1C369B]"
              >
                Discard & Open
              </button>
            </div>
          </div>
        )}

        {/* Delete confirmation prompt inside modal */}
        {reviewToDelete && (
          <div className="p-4 bg-[#FBECEC] border-b border-[#F5C2C2] text-xs text-[#A12D2D] flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Trash2 className="h-4 w-4 text-[#A12D2D] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Delete this saved review?</span>
                <p className="mt-0.5">
                  Permanently remove {reviewToDelete.bill.provider || 'Bill'} ({reviewToDelete.sessionRef}) and its drafted message?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setReviewToDelete(null)}
                className="px-2.5 py-1 text-xs font-mono rounded border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8] text-[#20221F]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-[#A12D2D] text-white hover:bg-[#852222]"
              >
                Delete review
              </button>
            </div>
          </div>
        )}

        {/* List of saved reviews */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {savedReviews.length === 0 ? (
            <div className="text-center py-10 text-[#555B55]">
              <Bookmark className="h-8 w-8 mx-auto text-[#D8D3C8] mb-2" />
              <p className="font-mono text-sm font-semibold text-[#20221F]">
                {isAuthenticated ? 'No saved reviews in your account' : 'No saved reviews on this device'}
              </p>
              <p className="text-xs text-[#555B55] mt-1 max-w-sm mx-auto">
                Saving is optional. When you finish reviewing a bill, you can choose to save the audited numbers and drafted messages.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReviews.map((r) => {
                const statusColor =
                  r.analysis.status === 'match'
                    ? 'text-[#285840] bg-[#EAF1E8]'
                    : r.analysis.status === 'mismatch'
                    ? 'text-[#785015] bg-[#FFF0D6]'
                    : 'text-[#555B55] bg-[#E8E8E3]';

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-lg border border-[#D8D3C8] bg-white hover:border-[#2546C4]/60 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#20221F]">
                          {r.bill.provider || 'Bill Audit'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${statusColor}`}>
                          {r.analysis.status === 'match'
                            ? 'Math Verified'
                            : r.analysis.status === 'mismatch'
                            ? 'Mismatch'
                            : 'Incomplete'}
                        </span>
                        {r.source === 'supabase' ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#2546C4] bg-[#EEF2FD] border border-[#CAD6FC]">
                            <Cloud className="h-2.5 w-2.5" />
                            <span>Cloud</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#555B55] bg-[#E8E8E3]">
                            <HardDrive className="h-2.5 w-2.5" />
                            <span>Device</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#555B55] mt-1 flex flex-wrap items-center gap-2">
                        <span>{r.bill.service || 'Service'}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {r.bill.date || 'Undated'}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-[11px] text-[#777B73]">{r.sessionRef}</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-[#20221F]">
                        Total: {formatMinorUnits(r.bill.billed_amount, r.bill.currency)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrentReviewUnsaved) {
                            setReviewToOpen(r);
                          } else {
                            onOpenReview(r);
                            onClose();
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-mono font-bold text-white bg-[#2546C4] rounded-md hover:bg-[#1C369B] transition-colors flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewToDelete(r)}
                        className="p-1.5 text-[#777B73] hover:text-[#A12D2D] hover:bg-[#FBECEC] rounded-md transition-colors"
                        title="Delete review"
                        aria-label="Delete review"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#D8D3C8] px-6 py-3 bg-[#F5F1E8] flex justify-between items-center text-xs text-[#555B55]">
          <span>
            {isAuthenticated
              ? 'Synced privately via Supabase (Row Level Security protected)'
              : 'Stored solely on this browser'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono font-medium border border-[#D8D3C8] rounded-md bg-white hover:bg-[#F5F1E8]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
