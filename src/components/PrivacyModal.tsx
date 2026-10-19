import React from 'react';
import { X, ShieldCheck, Lock, Cpu, Trash2 } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-6 py-4 bg-[#F5F1E8]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#2546C4]" />
            <h2 id="privacy-modal-title" className="font-mono text-sm font-bold uppercase tracking-wider">
              Privacy & Processing Details
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

        {/* Content */}
        <div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto leading-relaxed">
          <div className="flex gap-3">
            <Cpu className="h-5 w-5 text-[#2546C4] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-[#20221F]">AI Processing with Google Gemini</h3>
              <p className="text-[#555B55] mt-1 text-xs">
                When you submit a bill, its image or PDF pages are transferred securely to our server-side API, which queries Google Gemini to transcribe printed line items, dates, and amounts.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Lock className="h-5 w-5 text-[#2546C4] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-[#20221F]">No Permanent Server Storage</h3>
              <p className="text-[#555B55] mt-1 text-xs">
                Your uploaded documents are held in volatile memory only for the duration of the extraction request. They are never written to permanent disk, stored in a cloud database, or used to train models.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-[#2546C4] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-[#20221F]">Deterministic Code Arithmetic</h3>
              <p className="text-[#555B55] mt-1 text-xs">
                BillShield does not rely on AI for mathematical calculations. Line item totals, differences from expectations, and arithmetic reconciliation are strictly computed in deterministic code using integer minor units (paise).
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Trash2 className="h-5 w-5 text-[#2546C4] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-[#20221F]">Local Browser Storage Only</h3>
              <p className="text-[#555B55] mt-1 text-xs">
                Saving a review is completely optional and requires your explicit click. When saved, structured numbers and drafted messages are stored solely on your device’s browser storage (excluding the original uploaded file). You can delete saved records at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#D8D3C8] px-6 py-3 bg-[#F5F1E8] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold text-white bg-[#2546C4] rounded-md hover:bg-[#1C369B] transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
