import React from 'react';

interface FooterProps {
  onOpenPrivacy: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPrivacy }) => {
  return (
    <footer className="mt-auto border-t border-[#D8D3C8] bg-[#F5F1E8] px-4 py-6 text-xs text-[#555B55]">
      <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-mono font-bold tracking-wider text-[#20221F]">BILLSHIELD</span>
          <span>—</span>
          <span>A consumer bill understanding and clarification tool.</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Client-side review session</span>
          <span className="text-[#D8D3C8]">·</span>
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="underline underline-offset-2 hover:text-[#2546C4] transition-colors"
          >
            Terms & Privacy
          </button>
        </div>
      </div>
    </footer>
  );
};
