-- Migration: tax engine (S-3.1)
-- NOTE: Idempotent for branch creation support.
-- Description: Replaces the single `pricing_config.tax_rate` / `tax_name` pair with a
--              configurable list of taxes per property. A tax carries its own authority,
--              rate type, duration gate, tax base, effective dates and exemptibility;
--              `tax_applicability` decides which charge categories each tax reaches.
--              Existing properties are backfilled to one lodging tax so behaviour is
--              unchanged on deploy.
-- Created: 2026-11-08

-- ============================================================================
-- tax_categories — classification only. Deliberately carries no rate: a rate
-- belongs to a tax, because two authorities can tax the same category at
-- different rates and must be remitted separately.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tax_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL
        CHECK (code IN ('lodging', 'retail', 'prepared_food', 'alcohol', 'tobacco', 'service', 'exempt')),
    label TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT tax_categories_property_id_id_key UNIQUE (property_id, id)
);

-- Partial unique so a soft-deleted category does not block re-creating its code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_categories_property_code_active
    ON public.tax_categories (property_id, code)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tax_categories_property_id
    ON public.tax_categories (property_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE public.tax_categories IS
    'Per-property charge classifications used to decide which taxes apply. Carries no rate.';
COMMENT ON COLUMN public.tax_categories.code IS
    'Stable classification key. A sellable item or stay charge points at one of these.';

-- ============================================================================
-- property_taxes — one row per tax levied, per authority.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    -- Who the tax is remitted to, e.g. 'Ohio Department of Taxation'. Free text:
    -- the platform never needs to interpret it, only report by it.
    authority TEXT,

    rate_type VARCHAR(16) NOT NULL
        CHECK (rate_type IN ('percentage', 'per_night', 'flat')),
    -- Basis points, so 650 = 6.50%. Integer deliberately: the legacy
    -- pricing_config.tax_rate is a float decimal and financial_invoices.tax_rate
    -- disagrees with it. Only used by rate_type = 'percentage'.
    rate_bp INTEGER CHECK (rate_bp BETWEEN 0 AND 10000),
    -- Used by rate_type 'per_night' (× nights) and 'flat' (once per charge).
    amount_cents INTEGER CHECK (amount_cents >= 0),
    CONSTRAINT property_taxes_rate_shape CHECK (
        (rate_type = 'percentage' AND rate_bp IS NOT NULL AND amount_cents IS NULL)
        OR (rate_type IN ('per_night', 'flat') AND amount_cents IS NOT NULL AND rate_bp IS NULL)
    ),

    -- Duration gate. Ohio's lodging tax applies below 30 nights, so max_nights = 29.
    -- A charge with no night count (a store sale) is never matched by a gated tax.
    min_nights INTEGER CHECK (min_nights >= 0),
    max_nights INTEGER CHECK (max_nights >= 0),
    CONSTRAINT property_taxes_night_range CHECK (
        min_nights IS NULL OR max_nights IS NULL OR max_nights >= min_nights
    ),

    -- 'compounds_on_tax' levies this tax on the taxes computed before it, ordered
    -- by priority. Rare, but some jurisdictions require it.
    basis VARCHAR(20) NOT NULL DEFAULT 'pre_tax'
        CHECK (basis IN ('pre_tax', 'compounds_on_tax')),
    priority INTEGER NOT NULL DEFAULT 0,

    -- Whether a discount reduces this tax's base. Per tax, not per property:
    -- two authorities can genuinely disagree. Seeded from the property setting.
    discounts_reduce_taxable_amount BOOLEAN NOT NULL DEFAULT TRUE,

    -- Whether a guest exemption certificate can waive this tax.
    exemptible BOOLEAN NOT NULL DEFAULT TRUE,

    -- Resolved against the charge's own date (stay check-in, or posting date for
    -- goods), never against "today", so a future stay is taxed at its own rate.
    effective_from DATE,
    effective_to DATE,
    CONSTRAINT property_taxes_effective_range CHECK (
        effective_from IS NULL OR effective_to IS NULL OR effective_to >= effective_from
    ),

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT property_taxes_property_id_id_key UNIQUE (property_id, id)
);

CREATE INDEX IF NOT EXISTS idx_property_taxes_property_id
    ON public.property_taxes (property_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_property_taxes_property_enabled_priority
    ON public.property_taxes (property_id, priority)
    WHERE deleted_at IS NULL AND enabled;

COMMENT ON TABLE public.property_taxes IS
    'One row per tax a property levies, per authority. Each is remitted separately, so each produces its own tax line.';
COMMENT ON COLUMN public.property_taxes.rate_bp IS
    'Rate in basis points (650 = 6.50%). Percentage taxes only.';
COMMENT ON COLUMN public.property_taxes.max_nights IS
    'Inclusive upper bound on stay length. Ohio exempts stays of 30+ nights, so max_nights = 29.';
COMMENT ON COLUMN public.property_taxes.effective_from IS
    'Resolved against the charge date, not the current date, so a booked future stay keeps its own rate.';

-- ============================================================================
-- tax_applicability — which taxes reach which categories.
-- The composite foreign keys make cross-tenant rows impossible at the database
-- level, not just in application filters (BP-4, D-2).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tax_applicability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
    property_tax_id UUID NOT NULL,
    tax_category_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_applicability_tax_fk
        FOREIGN KEY (property_id, property_tax_id)
        REFERENCES public.property_taxes (property_id, id) ON DELETE CASCADE,
    CONSTRAINT tax_applicability_category_fk
        FOREIGN KEY (property_id, tax_category_id)
        REFERENCES public.tax_categories (property_id, id) ON DELETE CASCADE,
    CONSTRAINT tax_applicability_unique UNIQUE (property_tax_id, tax_category_id)
);

CREATE INDEX IF NOT EXISTS idx_tax_applicability_property_tax
    ON public.tax_applicability (property_tax_id);

CREATE INDEX IF NOT EXISTS idx_tax_applicability_property_id
    ON public.tax_applicability (property_id);

COMMENT ON TABLE public.tax_applicability IS
    'Join of tax x charge category. A tax with no rows here applies to nothing.';

-- ============================================================================
-- guest_tax_exemptions — a certificate on file, property-scoped.
-- `guests.property_id` is nullable, so the exemption carries its own.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guest_tax_exemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests (id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL,
    issuer TEXT,
    notes TEXT,
    -- NULL means no expiry on file.
    expires_on DATE,
    -- TRUE exempts every exemptible tax; FALSE exempts only the taxes listed in
    -- guest_tax_exemption_taxes.
    exempts_all BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT guest_tax_exemptions_property_id_id_key UNIQUE (property_id, id)
);

CREATE INDEX IF NOT EXISTS idx_guest_tax_exemptions_guest
    ON public.guest_tax_exemptions (guest_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_guest_tax_exemptions_property_id
    ON public.guest_tax_exemptions (property_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE public.guest_tax_exemptions IS
    'Tax exemption certificate on file for a guest at a property. A folio with no guest cannot be exempt.';

CREATE TABLE IF NOT EXISTS public.guest_tax_exemption_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
    exemption_id UUID NOT NULL,
    property_tax_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guest_tax_exemption_taxes_exemption_fk
        FOREIGN KEY (property_id, exemption_id)
        REFERENCES public.guest_tax_exemptions (property_id, id) ON DELETE CASCADE,
    CONSTRAINT guest_tax_exemption_taxes_tax_fk
        FOREIGN KEY (property_id, property_tax_id)
        REFERENCES public.property_taxes (property_id, id) ON DELETE CASCADE,
    CONSTRAINT guest_tax_exemption_taxes_unique UNIQUE (exemption_id, property_tax_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_tax_exemption_taxes_exemption
    ON public.guest_tax_exemption_taxes (exemption_id);

COMMENT ON TABLE public.guest_tax_exemption_taxes IS
    'Which specific taxes an exemption waives, when exempts_all is false.';

-- ============================================================================
-- Row Level Security
-- Read for anyone with property access; write restricted to owners, since tax
-- configuration determines what guests are charged.
-- ============================================================================

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'tax_categories',
        'property_taxes',
        'tax_applicability',
        'guest_tax_exemptions',
        'guest_tax_exemption_taxes'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

        EXECUTE format(
            'DROP POLICY IF EXISTS "Service role full access on %1$s" ON public.%1$I', tbl);
        EXECUTE format(
            'CREATE POLICY "Service role full access on %1$s" ON public.%1$I
                 FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl);

        EXECUTE format(
            'DROP POLICY IF EXISTS "%1$s_select_authenticated" ON public.%1$I', tbl);
        EXECUTE format(
            'CREATE POLICY "%1$s_select_authenticated" ON public.%1$I
                 FOR SELECT TO authenticated
                 USING (property_id IN (SELECT public.get_accessible_property_ids()))', tbl);

        EXECUTE format(
            'DROP POLICY IF EXISTS "%1$s_insert_authenticated" ON public.%1$I', tbl);
        EXECUTE format(
            'CREATE POLICY "%1$s_insert_authenticated" ON public.%1$I
                 FOR INSERT TO authenticated
                 WITH CHECK (public.is_property_owner(property_id))', tbl);

        EXECUTE format(
            'DROP POLICY IF EXISTS "%1$s_update_authenticated" ON public.%1$I', tbl);
        EXECUTE format(
            'CREATE POLICY "%1$s_update_authenticated" ON public.%1$I
                 FOR UPDATE TO authenticated
                 USING (public.is_property_owner(property_id))
                 WITH CHECK (public.is_property_owner(property_id))', tbl);

        EXECUTE format(
            'DROP POLICY IF EXISTS "%1$s_delete_authenticated" ON public.%1$I', tbl);
        EXECUTE format(
            'CREATE POLICY "%1$s_delete_authenticated" ON public.%1$I
                 FOR DELETE TO authenticated
                 USING (public.is_property_owner(property_id))', tbl);

        EXECUTE format('GRANT SELECT ON public.%I TO authenticated', tbl);
        EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    END LOOP;
END;
$$;

-- ============================================================================
-- updated_at triggers
-- ============================================================================

-- Scoped to this migration's tables rather than named as a platform-wide
-- helper, so it cannot collide with one added later. The repo's convention is
-- one such function per table; three identical copies would be noise.
CREATE OR REPLACE FUNCTION public.tax_tables_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['tax_categories', 'property_taxes', 'guest_tax_exemptions']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trigger_%1$s_updated_at ON public.%1$I', tbl);
        EXECUTE format(
            'CREATE TRIGGER trigger_%1$s_updated_at
                 BEFORE UPDATE ON public.%1$I
                 FOR EACH ROW EXECUTE FUNCTION public.tax_tables_set_updated_at()', tbl);
    END LOOP;
END;
$$;

-- ============================================================================
-- Seed categories for every existing property.
-- ============================================================================

INSERT INTO public.tax_categories (property_id, code, label, display_order)
SELECT p.id, c.code, c.label, c.display_order
FROM public.properties p
CROSS JOIN (
    VALUES
        ('lodging', 'Lodging', 10),
        ('retail', 'Retail goods', 20),
        ('prepared_food', 'Prepared food', 30),
        ('service', 'Services', 40),
        ('exempt', 'Not taxed', 50)
) AS c (code, label, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM public.tax_categories existing
    WHERE existing.property_id = p.id
      AND existing.code = c.code
      AND existing.deleted_at IS NULL
);

-- ============================================================================
-- Backfill: one lodging tax per property that has a configured rate, so every
-- existing property is charged exactly what it is charged today. A property
-- with tax_rate 0 or null gets no tax row, which is also what it charges today.
-- ============================================================================

-- Every tax-rate input in the UI is step="0.01" on a percentage, i.e. one basis
-- point, so basis points represent every configurable rate exactly. A rate
-- written straight into the JSONB can be finer than that; it is rounded to the
-- nearest basis point and named here rather than changed silently.
DO $$
DECLARE
    offender RECORD;
BEGIN
    FOR offender IN
        SELECT p.id, p.name, (p.pricing_config->>'tax_rate')::numeric AS rate
        FROM public.properties p
        WHERE p.pricing_config ? 'tax_rate'
          AND (p.pricing_config->>'tax_rate') ~ '^[0-9]*\.?[0-9]+$'
          AND (p.pricing_config->>'tax_rate')::numeric > 0
          AND (p.pricing_config->>'tax_rate')::numeric * 10000
              <> ROUND((p.pricing_config->>'tax_rate')::numeric * 10000)
    LOOP
        RAISE NOTICE
            'Tax rate % on property % (%) is finer than one basis point; rounded to % bp.',
            offender.rate, offender.name, offender.id,
            ROUND(offender.rate * 10000);
    END LOOP;
END;
$$;

INSERT INTO public.property_taxes (
    property_id,
    name,
    rate_type,
    rate_bp,
    discounts_reduce_taxable_amount,
    enabled
)
SELECT
    p.id,
    COALESCE(NULLIF(TRIM(p.pricing_config->>'tax_name'), ''), 'Tax'),
    'percentage',
    LEAST(10000, GREATEST(0, ROUND((p.pricing_config->>'tax_rate')::numeric * 10000)))::int,
    COALESCE((p.pricing_config->>'discounts_reduce_taxable_amount')::boolean, TRUE),
    TRUE
FROM public.properties p
WHERE p.pricing_config ? 'tax_rate'
  AND (p.pricing_config->>'tax_rate') IS NOT NULL
  AND (p.pricing_config->>'tax_rate') ~ '^[0-9]*\.?[0-9]+$'
  AND (p.pricing_config->>'tax_rate')::numeric > 0
  AND NOT EXISTS (
      SELECT 1 FROM public.property_taxes existing
      WHERE existing.property_id = p.id AND existing.deleted_at IS NULL
  );

-- Those backfilled taxes apply to lodging only, with no duration gate: that is
-- precisely what a single property-wide rate meant.
INSERT INTO public.tax_applicability (property_id, property_tax_id, tax_category_id)
SELECT t.property_id, t.id, c.id
FROM public.property_taxes t
JOIN public.tax_categories c
  ON c.property_id = t.property_id
 AND c.code = 'lodging'
 AND c.deleted_at IS NULL
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.tax_applicability existing
      WHERE existing.property_tax_id = t.id
  );
