-- BillShield 4-Table Relational Schema Migration
-- Enables persistent memory for bills, charges, arithmetic analyses, and clarification messages.
-- All tables are protected by Row Level Security (RLS) linked to auth.users.

-- ============================================================================
-- 1. TABLE: bills
-- Root entity for an uploaded/audited bill, directly owned by the authenticated user.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bills (
    bill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT,
    service TEXT,
    expected_amount BIGINT,              -- minor units (paise for INR)
    billed_amount BIGINT,                -- minor units (paise for INR)
    bill_date TEXT,                      -- exact date string from document
    account_reference TEXT,              -- booking ID, PNR, or account number
    currency TEXT NOT NULL DEFAULT 'INR',
    file_name TEXT,
    session_ref TEXT,                    -- human-readable audit reference (e.g. REV-2026-CLEARTRIP-1234)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at DESC);

-- ============================================================================
-- 2. TABLE: bill_charges
-- Itemized line items extracted from the bill, user selection, and cached explanations.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bill_charges (
    charge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(bill_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount BIGINT,                       -- minor units (paise), null if unreadable
    selected BOOLEAN NOT NULL DEFAULT false, -- whether selected for clarification
    type TEXT NOT NULL,                  -- charge, fee, tax, credit, refund, etc.
    explanation_shows TEXT,              -- whatBillShows (cached plain English explanation)
    explanation_means TEXT,              -- whatThisUsuallyMeans (cached explanation)
    explanation_unclear TEXT,            -- whatRemainsUnclear (cached explanation)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_charges_bill_id ON public.bill_charges(bill_id);

-- ============================================================================
-- 3. TABLE: bill_analyses
-- Deterministic arithmetic verification records.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bill_analyses (
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(bill_id) ON DELETE CASCADE,
    calculated_total BIGINT,             -- sum of individual line items in minor units
    difference BIGINT,                   -- arithmetic difference: calculated_total - billed_amount
    expected_difference BIGINT,          -- expectation difference: billed_amount - expected_amount
    status TEXT NOT NULL,                -- 'match' | 'mismatch' | 'incomplete'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_analyses_bill_id ON public.bill_analyses(bill_id);

-- ============================================================================
-- 4. TABLE: clarification_requests
-- Clarification message drafting, user edits, and approval audit timestamps.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clarification_requests (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(bill_id) ON DELETE CASCADE,
    draft_text TEXT NOT NULL DEFAULT '',
    final_text TEXT NOT NULL DEFAULT '',
    is_drafted BOOLEAN NOT NULL DEFAULT false,
    approved_at TIMESTAMPTZ,             -- timestamp of explicit customer approval
    copied_at TIMESTAMPTZ,               -- timestamp when copied to clipboard
    sent_status TEXT NOT NULL DEFAULT 'not_sent', -- 'not_sent' | 'sent'
    additional_reference TEXT,           -- user-modified customer reference
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clarification_requests_bill_id ON public.clarification_requests(bill_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict isolation: Users can only access their own bills and related child records.
-- ============================================================================

-- Enable RLS on all 4 tables
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clarification_requests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Policies for public.bills
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own bills" ON public.bills;
CREATE POLICY "Users can view their own bills"
    ON public.bills FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bills" ON public.bills;
CREATE POLICY "Users can insert their own bills"
    ON public.bills FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bills" ON public.bills;
CREATE POLICY "Users can update their own bills"
    ON public.bills FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bills" ON public.bills;
CREATE POLICY "Users can delete their own bills"
    ON public.bills FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Policies for public.bill_charges (Guarded via parent bill ownership)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view charges of their own bills" ON public.bill_charges;
CREATE POLICY "Users can view charges of their own bills"
    ON public.bill_charges FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_charges.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert charges for their own bills" ON public.bill_charges;
CREATE POLICY "Users can insert charges for their own bills"
    ON public.bill_charges FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_charges.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update charges of their own bills" ON public.bill_charges;
CREATE POLICY "Users can update charges of their own bills"
    ON public.bill_charges FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_charges.bill_id
              AND public.bills.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_charges.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete charges of their own bills" ON public.bill_charges;
CREATE POLICY "Users can delete charges of their own bills"
    ON public.bill_charges FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_charges.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- Policies for public.bill_analyses (Guarded via parent bill ownership)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view analyses of their own bills" ON public.bill_analyses;
CREATE POLICY "Users can view analyses of their own bills"
    ON public.bill_analyses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_analyses.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert analyses for their own bills" ON public.bill_analyses;
CREATE POLICY "Users can insert analyses for their own bills"
    ON public.bill_analyses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_analyses.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update analyses of their own bills" ON public.bill_analyses;
CREATE POLICY "Users can update analyses of their own bills"
    ON public.bill_analyses FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_analyses.bill_id
              AND public.bills.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_analyses.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete analyses of their own bills" ON public.bill_analyses;
CREATE POLICY "Users can delete analyses of their own bills"
    ON public.bill_analyses FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.bill_analyses.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- Policies for public.clarification_requests (Guarded via parent bill ownership)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view clarification requests of their own bills" ON public.clarification_requests;
CREATE POLICY "Users can view clarification requests of their own bills"
    ON public.clarification_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.clarification_requests.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert clarification requests for their own bills" ON public.clarification_requests;
CREATE POLICY "Users can insert clarification requests for their own bills"
    ON public.clarification_requests FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.clarification_requests.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update clarification requests of their own bills" ON public.clarification_requests;
CREATE POLICY "Users can update clarification requests of their own bills"
    ON public.clarification_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.clarification_requests.bill_id
              AND public.bills.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.clarification_requests.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete clarification requests of their own bills" ON public.clarification_requests;
CREATE POLICY "Users can delete clarification requests of their own bills"
    ON public.clarification_requests FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.bills
            WHERE public.bills.bill_id = public.clarification_requests.bill_id
              AND public.bills.user_id = auth.uid()
        )
    );
