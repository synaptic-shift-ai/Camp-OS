-- Migration: Rename tenant_id → company_id in automations tables
-- Description: Aligns column naming with actual semantics (tenant = company)
-- Created: 2026-04-18

-- ============================================================================
-- 1. Rename columns
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.automations RENAME COLUMN tenant_id TO company_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'automation_execution_log' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.automation_execution_log RENAME COLUMN tenant_id TO company_id;
    END IF;
END $$;

-- ============================================================================
-- 2. Rename indexes
-- ============================================================================

ALTER INDEX IF EXISTS idx_automations_tenant_id RENAME TO idx_automations_company_id;
ALTER INDEX IF EXISTS idx_automation_execution_log_tenant_id RENAME TO idx_automation_execution_log_company_id;

-- ============================================================================
-- 3. Recreate helper function with company_id naming
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_automation_company_member(aut_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM public.automations WHERE id = aut_id;
    IF v_company_id IS NULL THEN RETURN false; END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = v_company_id
        AND c.owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.property_staff ps ON ps.property_id = p.id
        WHERE p.company_id = v_company_id
        AND ps.user_id = auth.uid()
    );
END;
$$;

-- ============================================================================
-- 4. Update RLS policies — automations
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "automations_select_authenticated" ON public.automations;
CREATE POLICY "automations_select_authenticated"
    ON public.automations
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

-- INSERT
DROP POLICY IF EXISTS "automations_insert_authenticated" ON public.automations;
CREATE POLICY "automations_insert_authenticated"
    ON public.automations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    );

-- UPDATE
DROP POLICY IF EXISTS "automations_update_authenticated" ON public.automations;
CREATE POLICY "automations_update_authenticated"
    ON public.automations
    FOR UPDATE
    TO authenticated
    USING (
        company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    );

-- DELETE
DROP POLICY IF EXISTS "automations_delete_authenticated" ON public.automations;
CREATE POLICY "automations_delete_authenticated"
    ON public.automations
    FOR DELETE
    TO authenticated
    USING (
        company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- 5. Update RLS policies — condition_groups (via helper function)
-- ============================================================================

DROP POLICY IF EXISTS "automation_condition_groups_select_authenticated" ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_select_authenticated"
    ON public.automation_condition_groups
    FOR SELECT
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_condition_groups_insert_authenticated" ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_insert_authenticated"
    ON public.automation_condition_groups
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_condition_groups_update_authenticated" ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_update_authenticated"
    ON public.automation_condition_groups
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_company_member(automation_id))
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_condition_groups_delete_authenticated" ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_delete_authenticated"
    ON public.automation_condition_groups
    FOR DELETE
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

-- ============================================================================
-- 6. Update RLS policies — conditions (via helper function)
-- ============================================================================

DROP POLICY IF EXISTS "automation_conditions_select_authenticated" ON public.automation_conditions;
CREATE POLICY "automation_conditions_select_authenticated"
    ON public.automation_conditions
    FOR SELECT
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_conditions_insert_authenticated" ON public.automation_conditions;
CREATE POLICY "automation_conditions_insert_authenticated"
    ON public.automation_conditions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_conditions_update_authenticated" ON public.automation_conditions;
CREATE POLICY "automation_conditions_update_authenticated"
    ON public.automation_conditions
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_company_member(automation_id))
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_conditions_delete_authenticated" ON public.automation_conditions;
CREATE POLICY "automation_conditions_delete_authenticated"
    ON public.automation_conditions
    FOR DELETE
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

-- ============================================================================
-- 7. Update RLS policies — actions (via helper function)
-- ============================================================================

DROP POLICY IF EXISTS "automation_actions_select_authenticated" ON public.automation_actions;
CREATE POLICY "automation_actions_select_authenticated"
    ON public.automation_actions
    FOR SELECT
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_actions_insert_authenticated" ON public.automation_actions;
CREATE POLICY "automation_actions_insert_authenticated"
    ON public.automation_actions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_actions_update_authenticated" ON public.automation_actions;
CREATE POLICY "automation_actions_update_authenticated"
    ON public.automation_actions
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_company_member(automation_id))
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_actions_delete_authenticated" ON public.automation_actions;
CREATE POLICY "automation_actions_delete_authenticated"
    ON public.automation_actions
    FOR DELETE
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

-- ============================================================================
-- 8. Update RLS policies — branches (via helper function)
-- ============================================================================

DROP POLICY IF EXISTS "automation_branches_select_authenticated" ON public.automation_branches;
CREATE POLICY "automation_branches_select_authenticated"
    ON public.automation_branches
    FOR SELECT
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_branches_insert_authenticated" ON public.automation_branches;
CREATE POLICY "automation_branches_insert_authenticated"
    ON public.automation_branches
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_branches_update_authenticated" ON public.automation_branches;
CREATE POLICY "automation_branches_update_authenticated"
    ON public.automation_branches
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_company_member(automation_id))
    WITH CHECK (public.is_automation_company_member(automation_id));

DROP POLICY IF EXISTS "automation_branches_delete_authenticated" ON public.automation_branches;
CREATE POLICY "automation_branches_delete_authenticated"
    ON public.automation_branches
    FOR DELETE
    TO authenticated
    USING (public.is_automation_company_member(automation_id));

-- ============================================================================
-- 9. Update RLS policies — execution_log
-- ============================================================================

DROP POLICY IF EXISTS "automation_execution_log_select_authenticated" ON public.automation_execution_log;
CREATE POLICY "automation_execution_log_select_authenticated"
    ON public.automation_execution_log
    FOR SELECT
    TO authenticated
    USING (
        company_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

-- ============================================================================
-- 10. Drop old helper, grant new helper
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_automation_tenant_member(UUID);
GRANT EXECUTE ON FUNCTION public.is_automation_company_member(UUID) TO authenticated, anon;
