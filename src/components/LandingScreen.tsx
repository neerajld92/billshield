import React from 'react';
import { ArrowRight, Lock, CheckCircle2, Info } from 'lucide-react';

interface LandingScreenProps {
  onStartUpload: () => void;
  onOpenPrivacy: () => void;
  savedReviewsCount: number;
  onOpenSavedReviews: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onStartUpload,
  onOpenPrivacy,
  savedReviewsCount,
  onOpenSavedReviews,
}) => {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-4 py-9 sm:py-12 lg:py-16">
      {/* 2-Column Desktop Grid matching Image 7.jpeg */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-10 lg:gap-14 items-start">
        {/* Left Column: Hero & Value Proposition (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          {/* Journey Breadcrumb Pill */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-md border border-[#D8D3C8] bg-[#FFFDF7] px-2.5 py-1 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-mono text-[#555B55] w-fit mb-7 sm:mb-6">
            <span className="font-bold text-[#20221F]">01 Upload</span>
            <span className="text-[#D8D3C8]">→</span>
            <span>02 Understand</span>
            <span className="text-[#D8D3C8]">→</span>
            <span>03 Ask (optional)</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-semibold tracking-tight text-[#20221F] leading-[1.15] sm:leading-[1.08] mb-6 sm:mb-5">
            Your bill.
            <br />
            Explained.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#555B55] leading-relaxed max-w-xl mb-8">
            Understand what you're paying for. Check the numbers. Ask about anything unclear.
          </p>

          {/* Primary CTA Button & Privacy Tag */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4 mb-5 sm:mb-4">
            <button
              type="button"
              onClick={onStartUpload}
              className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#2546C4] px-7 py-4 sm:py-3.5 font-mono text-sm font-bold text-white transition-all hover:bg-[#1C369B] active:translate-y-0.5 shadow-sm cursor-pointer"
            >
              <span>Understand my bill</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 sm:gap-1.5 text-xs text-[#555B55] pt-0.5 sm:pt-0">
              <Lock className="h-3.5 w-3.5 text-[#555B55]" />
              <span>No account required · Saving is optional</span>
            </div>
          </div>

          {/* Formats line */}
          <p className="text-[11.5px] sm:text-xs text-[#777B73] leading-relaxed mb-11 sm:mb-10">
            PDF, JPG, or PNG · Up to 10 MB · Mobile, broadband, utility & hospital bills
          </p>

          {/* 3 Customer Benefit Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 sm:gap-6 border-t border-[#D8D3C8] pt-9 sm:pt-8 text-xs text-[#555B55]">
            <div>
              <div className="font-mono text-xs font-bold text-[#20221F] mb-2 sm:mb-1.5">
                01 — Know what you're paying for.
              </div>
              <p className="leading-relaxed">
                Understand every charge on your bill in plain English.
              </p>
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-[#20221F] mb-2 sm:mb-1.5">
                02 — Know if the numbers add up.
              </div>
              <p className="leading-relaxed">
                See what you expected, what you were billed, and where the difference comes from.
              </p>
            </div>
            <div>
              <div className="font-mono text-xs font-bold text-[#20221F] mb-2 sm:mb-1.5">
                03 — Know what to ask.
              </div>
              <p className="leading-relaxed">
                Get a clear, ready-to-send message for charges you want explained.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Illustrative Bill Specimen Card (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-[#D8D3C8] bg-[#FFFDF7] p-5 sm:p-6 shadow-xs relative">
            {/* Specimen Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#D8D3C8]/70">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#777B73] block mb-0.5">
                  EXAMPLE BILL · HOW BILLSHIELD WORKS
                </span>
                <span className="font-semibold text-lg text-[#20221F]">
                  Telecommunications
                </span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-[#285840] bg-[#EAF1E8] border border-[#C5DDC0]">
                Math Matches
              </span>
            </div>

            {/* Expected vs Printed Totals Box */}
            <div className="grid grid-cols-2 gap-3 my-5 sm:my-4 p-3.5 sm:p-3 rounded-lg bg-[#F4F4EF] border border-[#D8D3C8]/50">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#777B73] block">
                  YOU EXPECTED
                </span>
                <span className="font-mono text-base font-bold text-[#20221F] tabular-nums mt-0.5 block">
                  ₹699.00
                </span>
              </div>
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#777B73] block">
                  PRINTED TOTAL
                </span>
                <span className="font-mono text-base font-bold text-[#20221F] tabular-nums mt-0.5 block">
                  ₹861.40
                </span>
              </div>
            </div>

            {/* Table of Specimen Items */}
            <div className="space-y-2 sm:space-y-1.5 text-xs mb-5 sm:mb-4">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#777B73] pb-1.5 sm:pb-1 border-b border-[#D8D3C8]/40">
                <span>ITEM DESCRIPTION</span>
                <span>AMOUNT</span>
              </div>

              {/* Line 1 */}
              <div className="flex items-center justify-between py-1.5 sm:py-1 text-[#20221F]">
                <span>Plan Charges (Monthly)</span>
                <span className="font-mono font-medium tabular-nums">₹699.00</span>
              </div>

              {/* Line 2 (Highlighted) */}
              <div className="flex items-center justify-between py-1.5 sm:py-1 px-2.5 sm:px-2 -mx-2.5 sm:-mx-2 rounded bg-[#FFF0D6] border border-[#F2D7A1] text-[#20221F]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="h-2 w-2 rounded-full bg-[#E58300]" />
                  <span className="font-bold">ISD Usage</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider bg-white/80 border border-[#E58300]/40 text-[#785015] px-1 py-0.2 rounded font-bold">
                    WHY THIS CHARGE?
                  </span>
                </div>
                <span className="font-mono font-bold tabular-nums text-[#785015]">₹31.00</span>
              </div>

              {/* Line 3 */}
              <div className="flex items-center justify-between py-1.5 sm:py-1 text-[#555B55]">
                <span>GST on Plan (18%)</span>
                <span className="font-mono tabular-nums">₹125.82</span>
              </div>

              {/* Line 4 */}
              <div className="flex items-center justify-between py-1.5 sm:py-1 text-[#555B55]">
                <span>GST on ISD (18%)</span>
                <span className="font-mono tabular-nums">₹5.58</span>
              </div>
            </div>

            {/* Sum Total */}
            <div className="pt-3 sm:pt-2.5 pb-3.5 sm:pb-3 border-t border-[#D8D3C8] flex items-center justify-between text-xs font-mono font-bold text-[#20221F]">
              <span>SUM OF LINE ITEMS</span>
              <span className="text-sm">₹861.40</span>
            </div>

            {/* Callout Note Box */}
            <div className="rounded-lg bg-[#EAF1E8] border border-[#C5DDC0] p-3.5 sm:p-3 text-xs text-[#285840] leading-relaxed mb-5 sm:mb-4">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                <Info className="h-3.5 w-3.5" />
                <span>BILLSHIELD NOTE</span>
              </div>
              <p className="text-[11.5px] sm:text-[11px] text-[#20221F] leading-relaxed">
                The numbers add up. But what's this ₹31 charge? BillShield helps you understand it and prepare a question for your provider.
              </p>
            </div>

            {/* Specimen Card Sub-footer */}
            <div className="pt-3 sm:pt-2.5 border-t border-dashed border-[#D8D3C8] flex items-center justify-between text-[9px] font-mono text-[#777B73] uppercase tracking-wider">
              <span>SAMPLE ILLUSTRATION</span>
              <span>FOR DEMONSTRATION ONLY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
