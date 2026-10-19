import React, { useState, useEffect } from 'react';
import { X, Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Close automatically if an active session is detected while modal is open
  useEffect(() => {
    if (!isOpen || !supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        onSuccess?.();
        onClose();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isOpen, onClose, onSuccess]);

  if (!isOpen) return null;

  const configured = isSupabaseConfigured();

  const handleSendMagicLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = (email || submittedEmail).trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    if (!supabase) {
      setStatusMessage({
        type: 'error',
        text: 'Supabase credentials are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        throw error;
      }

      setSubmittedEmail(cleanEmail);
      setIsSent(true);
    } catch (err: any) {
      console.error('[Auth] Error sending magic link:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to send sign-in link. Please check your email and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIsSent(false);
    setStatusMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-lg bg-[#FFFDF7] border border-[#D8D3C8] shadow-lg overflow-hidden text-[#20221F]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8D3C8] px-5 py-3.5 bg-[#F5F1E8]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#2546C4]" />
            <h2 id="auth-modal-title" className="font-mono text-xs font-bold uppercase tracking-wider text-[#20221F]">
              Account Sign In (Passwordless)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#555B55] hover:text-[#20221F] hover:bg-[#E8E8E3] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {!configured && (
            <div className="mb-4 rounded-md border border-[#F2D7A1] bg-[#FFF0D6] p-3 text-xs text-[#785015] flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Supabase Not Connected</p>
                <p className="mt-0.5">
                  Configure <code className="bg-[#FBE6C0] px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and{' '}
                  <code className="bg-[#FBE6C0] px-1 py-0.5 rounded font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> in
                  your environment to enable cloud memory.
                </p>
              </div>
            </div>
          )}

          {!isSent ? (
            <form onSubmit={handleSendMagicLink} className="space-y-4">
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-[#555B55] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#777B73]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoFocus
                    required
                    disabled={isLoading || !configured}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D8D3C8] rounded-md focus:outline-none focus:border-[#2546C4] font-mono"
                  />
                </div>
                <p className="text-[11px] text-[#777B73] mt-1.5 leading-relaxed">
                  Enter your email address to receive a secure, one-click magic sign-in link. No password required.
                </p>
              </div>

              {statusMessage && (
                <div
                  className={`p-2.5 rounded-md text-xs flex items-start gap-2 ${
                    statusMessage.type === 'error'
                      ? 'bg-[#FBECEC] text-[#A12D2D] border border-[#F5C2C2]'
                      : 'bg-[#EAF1E8] text-[#285840] border border-[#C5DDC0]'
                  }`}
                >
                  {statusMessage.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !configured}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs font-bold text-white bg-[#2546C4] rounded-md hover:bg-[#1C369B] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending magic link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Magic Link</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5 text-center py-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#EAF1E8] border border-[#C5DDC0] flex items-center justify-center text-[#285840]">
                <Mail className="h-6 w-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-[#20221F]">Check your email</h3>
                <p className="text-xs text-[#555B55] mt-1.5 leading-relaxed">
                  We've sent a magic sign-in link to:
                </p>
                <p className="font-mono text-xs font-bold text-[#20221F] mt-1 px-3 py-1 bg-[#F5F1E8] rounded border border-[#D8D3C8] inline-block">
                  {submittedEmail}
                </p>
              </div>

              <div className="text-xs text-[#777B73] bg-[#F5F1E8]/60 p-3 rounded-md border border-[#E8E8E3] text-left space-y-1.5 leading-relaxed">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#285840] shrink-0 mt-0.5" />
                  <span>Click the sign-in link in your email to log in instantly.</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#285840] shrink-0 mt-0.5" />
                  <span>You can safely close this dialog or keep it open while you check your inbox.</span>
                </p>
              </div>

              {statusMessage && (
                <div
                  className={`p-2.5 rounded-md text-xs flex items-start gap-2 text-left ${
                    statusMessage.type === 'error'
                      ? 'bg-[#FBECEC] text-[#A12D2D] border border-[#F5C2C2]'
                      : 'bg-[#EAF1E8] text-[#285840] border border-[#C5DDC0]'
                  }`}
                >
                  {statusMessage.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-mono text-[#555B55] hover:text-[#20221F] border border-[#D8D3C8] bg-white hover:bg-[#F5F1E8] rounded-md transition-colors"
                >
                  Use different email
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMagicLink()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-[#2546C4] hover:text-[#1C369B] border border-[#2546C4]/30 bg-blue-50/50 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>Resend link</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#D8D3C8] px-5 py-2.5 bg-[#F5F1E8] text-[11px] text-[#777B73] flex justify-between items-center font-mono">
          <span>Private & Encrypted</span>
          <button onClick={onClose} className="hover:text-[#20221F] underline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
