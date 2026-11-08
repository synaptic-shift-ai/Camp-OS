-- Migration: upsert_property_tax (S-3.3)
-- NOTE: Idempotent for branch creation support.
-- Description: Writes a tax and its applicability in one transaction.
--              Needed because a tax must always name at least one category:
--              a tax row written without its applicability rows would charge
--              nothing, and a quote loading it would reject it. The Supabase
--              JS client cannot span two statements in a transaction, so the
--              two writes happen here instead.
-- Created: 2026-11-08

CREATE OR REPLACE FUNCTION public.upsert_property_tax(
    p_id UUID,
    p_property_id UUID,
    p_name TEXT,
    p_authority TEXT,
    p_rate_type TEXT,
    p_rate_bp INTEGER,
    p_amount_cents INTEGER,
    p_min_nights INTEGER,
    p_max_nights INTEGER,
    p_basis TEXT,
    p_priority INTEGER,
    p_discounts_reduce_taxable_amount BOOLEAN,
    p_exemptible BOOLEAN,
    p_effective_from DATE,
    p_effective_to DATE,
    p_enabled BOOLEAN,
    p_category_codes TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
-- INVOKER so the caller's RLS still decides. The service-role client used by
-- the settings route bypasses RLS as it does for every other settings write.
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_missing TEXT[];
BEGIN
    IF p_category_codes IS NULL OR array_length(p_category_codes, 1) IS NULL THEN
        RAISE EXCEPTION 'A tax must apply to at least one tax category';
    END IF;

    -- Name the codes that do not resolve, rather than silently writing fewer
    -- applicability rows than the caller asked for.
    -- The unnest alias is named distinctly: an unqualified `code` inside the
    -- subquery would bind to tax_categories.code, making the comparison
    -- c.code = c.code and the check always pass.
    SELECT array_agg(requested.code) INTO v_missing
    FROM unnest(p_category_codes) AS requested (code)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.tax_categories c
        WHERE c.property_id = p_property_id
          AND c.code = requested.code
          AND c.deleted_at IS NULL
    );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Unknown tax category code(s) for this property: %',
            array_to_string(v_missing, ', ');
    END IF;

    INSERT INTO public.property_taxes AS t (
        id, property_id, name, authority, rate_type, rate_bp, amount_cents,
        min_nights, max_nights, basis, priority,
        discounts_reduce_taxable_amount, exemptible,
        effective_from, effective_to, enabled
    )
    VALUES (
        p_id, p_property_id, p_name, p_authority, p_rate_type, p_rate_bp, p_amount_cents,
        p_min_nights, p_max_nights, p_basis, p_priority,
        p_discounts_reduce_taxable_amount, p_exemptible,
        p_effective_from, p_effective_to, p_enabled
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        authority = EXCLUDED.authority,
        rate_type = EXCLUDED.rate_type,
        rate_bp = EXCLUDED.rate_bp,
        amount_cents = EXCLUDED.amount_cents,
        min_nights = EXCLUDED.min_nights,
        max_nights = EXCLUDED.max_nights,
        basis = EXCLUDED.basis,
        priority = EXCLUDED.priority,
        discounts_reduce_taxable_amount = EXCLUDED.discounts_reduce_taxable_amount,
        exemptible = EXCLUDED.exemptible,
        effective_from = EXCLUDED.effective_from,
        effective_to = EXCLUDED.effective_to,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    -- An update must not reach across properties, whatever the caller passes.
    WHERE t.property_id = p_property_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tax % does not belong to property %', p_id, p_property_id;
    END IF;

    DELETE FROM public.tax_applicability
    WHERE property_tax_id = p_id
      AND tax_category_id NOT IN (
          SELECT c.id FROM public.tax_categories c
          WHERE c.property_id = p_property_id
            AND c.code = ANY (p_category_codes)
            AND c.deleted_at IS NULL
      );

    INSERT INTO public.tax_applicability (property_id, property_tax_id, tax_category_id)
    SELECT p_property_id, p_id, c.id
    FROM public.tax_categories c
    WHERE c.property_id = p_property_id
      AND c.code = ANY (p_category_codes)
      AND c.deleted_at IS NULL
    ON CONFLICT (property_tax_id, tax_category_id) DO NOTHING;

    RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_property_tax IS
    'Writes a property tax and its category applicability in one transaction, so a tax is never stored without the categories it charges on.';

GRANT EXECUTE ON FUNCTION public.upsert_property_tax(
    UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT,
    INTEGER, BOOLEAN, BOOLEAN, DATE, DATE, BOOLEAN, TEXT[]
) TO authenticated, service_role;
