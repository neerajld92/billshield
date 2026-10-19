import React from 'react';
import { User } from '@supabase/supabase-js';
import { AlertCircle, Bookmark, ArrowRight, UserCheck, LogOut, LogIn } from 'lucide-react';

export type AppStage = 'landing' | 'upload' | 'understand' | 'message' | 'finish';

interface HeaderProps {
  currentStage: AppStage;
  onNavigateStage: (stage: AppStage) => void;
  maxAccessibleStep: number; // 1: upload, 2: understand, 3: message, 4: finish
  isReviewActive: boolean;
  isSaved: boolean;
  savedReviewsCount: number;
  onOpenSavedReviews: () => void;
  user?: User | null;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStage,
  onNavigateStage,
  maxAccessibleStep,
  isReviewActive,
  isSaved,
  savedReviewsCount,
  onOpenSavedReviews,
  user,
  onOpenAuth,
  onSignOut,
}) => {
  const steps: { stage: AppStage; num: number; label: string; shortLabel: string }[] = [
    { stage: 'upload', num: 1, label: '01 Upload', shortLabel: 'Upload' },
    { stage: 'understand', num: 2, label: '02 Understand', shortLabel: 'Understand' },
    { stage: 'message', num: 3, label: '03 Message (Optional)', shortLabel: 'Message' },
    { stage: 'finish', num: 4, label: '04 Finish', shortLabel: 'Finish' },
  ];

  const renderAuthPill = () => {
    if (user) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] rounded-md">
          <UserCheck className="h-3.5 w-3.5 text-[#285840]" />
          <span className="max-w-[120px] truncate" title={user.email || 'Account'}>
            {user.email?.split('@')[0] || 'Account'}
          </span>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="ml-1 p-0.5 text-[#777B73] hover:text-[#A12D2D] rounded transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-3 w-3" />
            </button>
          )}
        </div>
      );
    }
    if (onOpenAuth) {
      return (
        <button
          type="button"
          onClick={onOpenAuth}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] rounded-md hover:border-[#2546C4] hover:text-[#2546C4] transition-colors cursor-pointer"
        >
          <LogIn className="h-3 w-3 text-[#2546C4]" />
          <span>Sign in</span>
        </button>
      );
    }
    return null;
  };

  return (
    <header className="border-b border-[#D8D3C8] bg-[#F5F1E8] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Brand & Wordmark */}
        <div className="flex items-center justify-between sm:justify-start gap-4">
          <div
            onClick={() => onNavigateStage('landing')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* Retro-techno ledger shield icon */}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#20221F] text-white shadow-xs group-hover:bg-[#2546C4] transition-colors">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#FFFDF7]"
              >
                <path
                  d="M12 2L4 5V11.5C4 16.5 7.4 21.1 12 22C16.6 21.1 20 16.5 20 11.5V5L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="9" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="font-mono text-xs font-bold tracking-widest text-[#20221F]">BILLSHIELD</div>
              <div className="text-[11px] text-[#555B55] hidden sm:block">Understand your bill. Ask with confidence.</div>
            </div>
          </div>

          {/* Mobile triggers */}
          <div className="sm:hidden flex items-center gap-2">
            {renderAuthPill()}
            {savedReviewsCount > 0 && (
              <button
                onClick={onOpenSavedReviews}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] rounded-md hover:border-[#2546C4] transition-colors"
              >
                <Bookmark className="h-3 w-3 text-[#2546C4]" />
                <span>Saved ({savedReviewsCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* If on Landing Screen: show "NO ACCOUNT REQUIRED" pill and "Upload bill ->" (Image 7.jpeg) */}
        {currentStage === 'landing' ? (
          <div className="flex items-center gap-3 self-end sm:self-center">
            {!user && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D8D3C8] bg-[#FFFDF7] px-3 py-1 font-mono text-[11px] text-[#555B55]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#285840]" />
                <span className="font-semibold uppercase tracking-wider text-[#20221F]">NO ACCOUNT REQUIRED</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigateStage('upload')}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#20221F] hover:text-[#2546C4] px-2.5 py-1 transition-colors cursor-pointer"
            >
              <span>Upload bill</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            {(savedReviewsCount > 0 || !!user) && (
              <button
                onClick={onOpenSavedReviews}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] rounded-md hover:border-[#2546C4] hover:text-[#2546C4] transition-colors cursor-pointer"
              >
                <Bookmark className="h-3 w-3 text-[#2546C4]" />
                <span>Saved ({savedReviewsCount})</span>
              </button>
            )}

            <div className="hidden sm:block">{renderAuthPill()}</div>
          </div>
        ) : (
          /* Workflow Step Navigation (Image 1, 3, 5, 9) */
          <>
            <nav className="flex items-center gap-1 sm:gap-4 overflow-x-auto text-xs font-mono font-medium text-[#555B55] py-1">
              {steps.map((s, idx) => {
                const isActive = currentStage === s.stage;
                const isClickable = s.num <= maxAccessibleStep;

                return (
                  <React.Fragment key={s.stage}>
                    {idx > 0 && <span className="text-[#D8D3C8] select-none">·</span>}
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => onNavigateStage(s.stage)}
                      className={`px-1.5 py-1 whitespace-nowrap rounded transition-colors ${
                        isActive
                          ? 'text-[#2546C4] font-bold underline underline-offset-4 decoration-2'
                          : isClickable
                          ? 'text-[#20221F] hover:text-[#2546C4]'
                          : 'text-[#9FA39D] cursor-not-allowed opacity-60'
                      }`}
                    >
                      <span className="hidden md:inline">{s.label}</span>
                      <span className="md:hidden">{s.shortLabel}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Right side status / saved reviews / auth */}
            <div className="hidden sm:flex items-center gap-3">
              {isReviewActive && !isSaved && (
                <div className="flex items-center gap-1.5 rounded-md bg-[#FFF0D6] border border-[#F2D7A1] px-2.5 py-1 text-[11px] font-mono text-[#785015]">
                  <AlertCircle className="h-3 w-3 text-[#785015]" />
                  <span>Not saved — refreshing will lose this review</span>
                </div>
              )}

              {(savedReviewsCount > 0 || !!user) && (
                <button
                  onClick={onOpenSavedReviews}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-[#20221F] bg-[#FFFDF7] border border-[#D8D3C8] rounded-md hover:border-[#2546C4] hover:text-[#2546C4] transition-colors cursor-pointer"
                >
                  <Bookmark className="h-3.5 w-3.5 text-[#2546C4]" />
                  <span>Saved reviews ({savedReviewsCount})</span>
                </button>
              )}

              {renderAuthPill()}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

