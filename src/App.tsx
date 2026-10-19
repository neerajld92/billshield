/**
 * BillShield — A consumer bill understanding and clarification tool.
 * Date: 19 October 2026
 *
 * Implements the approved customer journey:
 * Landing → Upload → Understand → Message (optional) → Finish
 *
 * Requirements:
 * - Opens at / on the approved 2-column Landing page.
 * - Landing CTA navigates to Upload.
 * - No public test fixtures or research participant names in consumer UI.
 * - Single responsive implementation across mobile and desktop.
 * - Deterministic integer minor unit calculations (paise).
 * - Server-side Gemini API calls for extraction, explanation, and drafting.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { Bill, Charge, Analysis, Message, SavedReview, ChargeExplanation } from './types';
import { calculateAnalysis } from './utils/money';
import { getSavedReviews, saveReview, deleteSavedReview } from './utils/storage';
import {
  supabase,
  saveReviewToSupabase,
  fetchUserReviewsFromSupabase,
  deleteReviewFromSupabase,
} from './utils/supabase';

import { Header, AppStage } from './components/Header';
import { Footer } from './components/Footer';
import { LandingScreen } from './components/LandingScreen';
import { UploadScreen } from './components/UploadScreen';
import { UnderstandScreen } from './components/UnderstandScreen';
import { MessageScreen } from './components/MessageScreen';
import { FinishScreen } from './components/FinishScreen';
import { PrivacyModal } from './components/PrivacyModal';
import { SavedReviewsModal } from './components/SavedReviewsModal';
import { AuthModal } from './components/AuthModal';

function getInitialStage(): AppStage {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase();
    if (path === '/upload') return 'upload';
    if (path === '/understand') return 'understand';
    if (path === '/message') return 'message';
    if (path === '/finish') return 'finish';
  }
  return 'landing';
}

export default function App() {
  const [currentStage, setCurrentStage] = useState<AppStage>(getInitialStage);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Active Review State
  const [bill, setBill] = useState<Bill | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [activeExplanations, setActiveExplanations] = useState<Record<string, ChargeExplanation>>({});
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([]);
  const [message, setMessage] = useState<Message>({
    id: `msg-${Date.now()}`,
    bill_id: '',
    selected_charge_ids: [],
    draft_text: '',
    final_text: '',
    is_drafted: false,
    approved_at: null,
    copied_at: null,
    sent_status: 'not_sent',
  });
  const [sessionRef, setSessionRef] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedSource, setSavedSource] = useState<'local' | 'supabase' | null>(null);

  // Saved Reviews (Local device storage & Supabase cloud storage)
  const [localReviews, setLocalReviews] = useState<SavedReview[]>([]);
  const [supabaseReviews, setSupabaseReviews] = useState<SavedReview[]>([]);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState<boolean>(false);
  const [isSavedReviewsOpen, setIsSavedReviewsOpen] = useState<boolean>(false);

  // Load reviews & listen for auth changes
  useEffect(() => {
    // 1. Initial local reviews
    const stored = getSavedReviews().map((r) => ({ ...r, source: 'local' as const }));
    setLocalReviews(stored);

    // 2. Supabase auth session & real-time changes
    let unsubscribeAuth: (() => void) | undefined;
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchUserReviewsFromSupabase(currentUser).then((remote) => {
            setSupabaseReviews(remote);
          });
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchUserReviewsFromSupabase(currentUser).then((remote) => {
            setSupabaseReviews(remote);
          });
        } else {
          setSupabaseReviews([]);
        }
      });
      unsubscribeAuth = () => subscription.unsubscribe();
    }

    // Handle browser popstate
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/upload') setCurrentStage('upload');
      else if (path === '/understand') setCurrentStage('understand');
      else if (path === '/message') setCurrentStage('message');
      else if (path === '/finish') setCurrentStage('finish');
      else setCurrentStage('landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      unsubscribeAuth?.();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Update browser URL on stage change
  const navigateToStage = (stage: AppStage) => {
    setCurrentStage(stage);
    if (typeof window !== 'undefined') {
      const newPath = stage === 'landing' ? '/' : `/${stage}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  };

  // Compute deterministic analysis whenever bill or charges change
  const currentAnalysis: Analysis = useMemo(() => {
    if (!bill) {
      return {
        id: 'analysis-empty',
        bill_id: '',
        calculated_total: null,
        expected_difference: null,
        arithmetic_difference: null,
        status: 'incomplete',
      };
    }
    return calculateAnalysis(bill, charges);
  }, [bill, charges]);

  // Handle bill extracted from upload
  const handleBillExtracted = (newBill: Bill, newCharges: Charge[], _fileDataUrl?: string) => {
    setBill(newBill);
    setCharges(newCharges);

    // Initial default selection: any fee or unexpected charge
    const defaultSelect = (newCharges || [])
      .filter((c) => (c?.description || '').toLowerCase().includes('isd') || c?.type === 'fee')
      .map((c) => c.id);
    const initialSelection = defaultSelect.length > 0 ? defaultSelect : (newCharges[0] ? [newCharges[0].id] : []);
    setSelectedChargeIds(initialSelection);

    // Initial message template
    setMessage({
      id: `msg-${Date.now()}`,
      bill_id: newBill.id,
      selected_charge_ids: initialSelection,
      draft_text: '',
      final_text: '',
      is_drafted: false,
      approved_at: null,
      copied_at: null,
      sent_status: 'not_sent',
    });

    const ref = `REV-${new Date().getFullYear()}-${(newBill.provider || 'BILL').toUpperCase().replace(/\s+/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionRef(ref);
    setIsSaved(false);
    setSavedSource(null);

    // Transition to Screen B (Understand)
    setMaxAccessibleStep(2);
    navigateToStage('understand');
  };

  // Update Bill details
  const handleUpdateBill = (updatedBill: Bill) => {
    setBill(updatedBill);
    setIsSaved(false);
    setSavedSource(null);
    // Invalidate message approval upon bill corrections
    setMessage((prev) => ({
      ...prev,
      approved_at: null,
      copied_at: null,
      sent_status: 'not_sent',
    }));
  };

  // Update charges list
  const handleUpdateCharges = (updatedCharges: Charge[]) => {
    setCharges(updatedCharges);
    setIsSaved(false);
    // Filter selected ids to existing charges
    const existingIds = new Set(updatedCharges.map((c) => c.id));
    setSelectedChargeIds((prev) => prev.filter((id) => existingIds.has(id)));
    // Invalidate message approval upon charges corrections
    setMessage((prev) => ({
      ...prev,
      approved_at: null,
      copied_at: null,
      sent_status: 'not_sent',
    }));
  };

  // Toggle charge selection for explanation/drafting
  const handleToggleChargeSelect = (id: string) => {
    setSelectedChargeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      setMessage((msg) => ({
        ...msg,
        selected_charge_ids: next,
        approved_at: null, // Invalidate approval on selection change
        copied_at: null,
        sent_status: 'not_sent',
        is_drafted: false,
      }));
      return next;
    });
  };

  const handleSelectAllCharges = (select: boolean) => {
    const next = select ? charges.map((c) => c.id) : [];
    setSelectedChargeIds(next);
    setMessage((msg) => ({
      ...msg,
      selected_charge_ids: next,
      approved_at: null, // Invalidate approval on selection change
      copied_at: null,
      sent_status: 'not_sent',
      is_drafted: false,
    }));
  };

  // Step transitions
  const handleGoToMessage = (additionalRef?: string) => {
    if (additionalRef !== undefined) {
      setMessage((prev) => ({
        ...prev,
        additional_reference: additionalRef,
        approved_at: null,
        copied_at: null,
        sent_status: 'not_sent',
        is_drafted: false,
      }));
    }
    setMaxAccessibleStep((prev) => Math.max(prev, 3));
    navigateToStage('message');
  };

  const handleGoToFinishWithoutDrafting = () => {
    setMaxAccessibleStep(4);
    navigateToStage('finish');
  };

  const handleContinueToFinishFromMessage = () => {
    setMaxAccessibleStep(4);
    navigateToStage('finish');
  };

  const handleHeaderNavigate = (stage: AppStage) => {
    if (stage === 'landing') {
      navigateToStage('landing');
      return;
    }
    const stepNum = stage === 'upload' ? 1 : stage === 'understand' ? 2 : stage === 'message' ? 3 : 4;
    if (stepNum <= maxAccessibleStep) {
      navigateToStage(stage);
    }
  };

  // Active reviews shown in modal and header count
  const displaySavedReviews = useMemo(() => {
    if (!user) return localReviews;
    // When logged in, show cloud reviews and any un-synced local reviews
    const remoteRefOrIds = new Set(
      supabaseReviews.flatMap((r) => [r.id, r.sessionRef, r.bill.id]).filter(Boolean)
    );
    const unSyncedLocal = localReviews.filter(
      (r) => !remoteRefOrIds.has(r.id) && !remoteRefOrIds.has(r.sessionRef) && !remoteRefOrIds.has(r.bill.id)
    );
    return [...supabaseReviews, ...unSyncedLocal];
  }, [user, supabaseReviews, localReviews]);

  // Explicit sync of local device reviews to Supabase (ONLY when user explicitly requests it)
  const handleSyncLocalReviews = async () => {
    if (!user) return;
    for (const r of localReviews) {
      await saveReviewToSupabase(r, user);
    }
    const updatedRemote = await fetchUserReviewsFromSupabase(user);
    setSupabaseReviews(updatedRemote);
    // Clear local reviews after explicit sync
    localStorage.removeItem('billshield_saved_reviews');
    setLocalReviews([]);
  };

  // Sign out
  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseReviews([]);
    }
  };

  // Saving Review (Cloud if authenticated, Local if guest)
  const handleSaveReview = async (): Promise<{ success: boolean; error?: string }> => {
    if (!bill) return { success: false, error: 'No active bill to save' };

    // Create persistent record (without raw file Data URL)
    const reviewToSave: SavedReview = {
      id: bill.id,
      savedAt: new Date().toISOString(),
      sessionRef: sessionRef || `REV-${Date.now()}`,
      bill: {
        id: bill.id,
        provider: bill.provider,
        service: bill.service,
        date: bill.date,
        currency: bill.currency,
        expected_amount: bill.expected_amount,
        billed_amount: bill.billed_amount,
        account_reference: bill.account_reference,
        fileName: bill.fileName,
        originalAvailable: false,
      },
      charges,
      analysis: currentAnalysis,
      message: message.final_text ? message : null,
      explanations: Object.keys(activeExplanations).length > 0 ? activeExplanations : undefined,
    };

    if (user) {
      const res = await saveReviewToSupabase(reviewToSave, user);
      if (res.success) {
        setIsSaved(true);
        setSavedSource('supabase');
        if (res.billId && res.billId !== bill.id) {
          setBill((prev) => (prev ? { ...prev, id: res.billId! } : prev));
        }
        const remote = await fetchUserReviewsFromSupabase(user);
        setSupabaseReviews(remote);
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to save to Supabase' };
    } else {
      const success = saveReview({ ...reviewToSave, source: 'local' });
      if (success) {
        setIsSaved(true);
        setSavedSource('local');
        setLocalReviews(getSavedReviews().map((r) => ({ ...r, source: 'local' })));
        return { success: true };
      }
      return { success: false, error: 'Failed to write to local storage' };
    }
  };

  // Open saved review
  const handleOpenSavedReview = (saved: SavedReview) => {
    setBill({
      ...saved.bill,
      originalAvailable: false,
    });
    setCharges(saved.charges);
    setSessionRef(saved.sessionRef || `REV-${saved.bill.id}`);
    setIsSaved(true);
    setSavedSource(saved.source || 'local');
    setActiveExplanations(saved.explanations || {});

    if (saved.message) {
      setMessage(saved.message);
      setSelectedChargeIds(saved.message.selected_charge_ids || []);
    } else {
      setMessage({
        id: `msg-${Date.now()}`,
        bill_id: saved.bill.id,
        selected_charge_ids: [],
        draft_text: '',
        final_text: '',
        is_drafted: false,
        approved_at: null,
        copied_at: null,
        sent_status: 'not_sent',
      });
      setSelectedChargeIds(saved.charges[0] ? [saved.charges[0].id] : []);
    }

    setMaxAccessibleStep(4);
    navigateToStage('understand');
  };

  // Delete saved review
  const handleDeleteReview = async (id: string, source?: 'local' | 'supabase') => {
    if (source === 'supabase' && user) {
      await deleteReviewFromSupabase(id);
      const remote = await fetchUserReviewsFromSupabase(user);
      setSupabaseReviews(remote);
    } else {
      deleteSavedReview(id);
      setLocalReviews(getSavedReviews().map((r) => ({ ...r, source: 'local' })));
    }
    if (bill && bill.id === id) {
      setIsSaved(false);
    }
  };

  // Delete active saved review
  const handleDeleteCurrentReview = () => {
    if (bill) {
      handleDeleteReview(bill.id, user ? 'supabase' : 'local');
    }
  };

  // Start another bill
  const handleStartAnotherBill = () => {
    setBill(null);
    setCharges([]);
    setSelectedChargeIds([]);
    setActiveExplanations({});
    setMessage({
      id: `msg-${Date.now()}`,
      bill_id: '',
      selected_charge_ids: [],
      draft_text: '',
      final_text: '',
      is_drafted: false,
      approved_at: null,
      copied_at: null,
      sent_status: 'not_sent',
    });
    setSessionRef('');
    setIsSaved(false);
    setMaxAccessibleStep(1);
    navigateToStage('upload');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#20221F]">
      {/* Universal Top Header */}
      <Header
        currentStage={currentStage}
        onNavigateStage={handleHeaderNavigate}
        maxAccessibleStep={maxAccessibleStep}
        isReviewActive={!!bill}
        isSaved={isSaved}
        savedReviewsCount={displaySavedReviews.length}
        onOpenSavedReviews={() => setIsSavedReviewsOpen(true)}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Flow Content */}
      <main className="flex-1">
        {currentStage === 'landing' && (
          <LandingScreen
            onStartUpload={() => navigateToStage('upload')}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            savedReviewsCount={displaySavedReviews.length}
            onOpenSavedReviews={() => setIsSavedReviewsOpen(true)}
          />
        )}

        {currentStage === 'upload' && (
          <UploadScreen
            onBillExtracted={handleBillExtracted}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onBackToLanding={() => navigateToStage('landing')}
          />
        )}

        {currentStage === 'understand' && bill && (
          <UnderstandScreen
            bill={bill}
            charges={charges}
            analysis={currentAnalysis}
            onUpdateBill={handleUpdateBill}
            onUpdateCharges={handleUpdateCharges}
            selectedChargeIds={selectedChargeIds}
            onToggleChargeSelect={handleToggleChargeSelect}
            onSelectAllCharges={handleSelectAllCharges}
            onGoToMessage={handleGoToMessage}
            onGoToFinishWithoutDrafting={handleGoToFinishWithoutDrafting}
            onReupload={handleStartAnotherBill}
            cachedExplanations={activeExplanations}
            onExplanationsUpdate={setActiveExplanations}
          />
        )}

        {currentStage === 'message' && bill && (
          <MessageScreen
            bill={bill}
            charges={charges}
            selectedChargeIds={selectedChargeIds}
            message={message}
            onUpdateMessage={setMessage}
            onBackToBill={() => navigateToStage('understand')}
            onContinueToFinish={handleContinueToFinishFromMessage}
          />
        )}

        {currentStage === 'finish' && bill && (
          <FinishScreen
            bill={bill}
            charges={charges}
            analysis={currentAnalysis}
            message={message.final_text ? message : null}
            sessionRef={sessionRef}
            isSaved={isSaved}
            savedSource={savedSource}
            onSaveReview={handleSaveReview}
            onDeleteCurrentReview={handleDeleteCurrentReview}
            onStartAnotherBill={handleStartAnotherBill}
            isAuthenticated={!!user}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* Fallback if user is at /understand, /message, or /finish without an active bill */}
        {(currentStage === 'understand' || currentStage === 'message' || currentStage === 'finish') && !bill && (
          <div className="mx-auto max-w-md px-4 py-16 text-center">
            <h2 className="text-xl font-bold font-mono text-[#20221F] mb-2">No active bill found</h2>
            <p className="text-xs text-[#555B55] mb-6">Please choose or upload a bill to begin understanding it.</p>
            <button
              onClick={() => navigateToStage('upload')}
              className="px-5 py-2.5 font-mono text-xs font-bold text-white bg-[#2546C4] rounded-md hover:bg-[#1C369B]"
            >
              Upload a bill →
            </button>
          </div>
        )}
      </main>

      {/* Universal Footer */}
      <Footer onOpenPrivacy={() => setIsPrivacyOpen(true)} />

      {/* Privacy & Disclosures Modal */}
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />

      {/* Saved Reviews Management Modal */}
      <SavedReviewsModal
        isOpen={isSavedReviewsOpen}
        onClose={() => setIsSavedReviewsOpen(false)}
        savedReviews={displaySavedReviews}
        onOpenReview={handleOpenSavedReview}
        onDeleteReview={handleDeleteReview}
        isCurrentReviewUnsaved={!!bill && !isSaved}
        isAuthenticated={!!user}
        localReviewsCount={localReviews.length}
        onSyncLocalReviews={handleSyncLocalReviews}
      />

      {/* Passwordless Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          if (supabase) {
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) {
                setUser(user);
                fetchUserReviewsFromSupabase(user).then((remote) => {
                  setSupabaseReviews(remote);
                });
              }
            });
          }
        }}
      />
    </div>
  );
}
