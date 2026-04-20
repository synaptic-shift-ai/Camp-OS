-- Migration: Create automations tables
-- NOTE: Made idempotent for branch creation support
-- Description: Core automation engine tables for event-driven rule processing
-- Created: 2026-04-17

-- ============================================================================
-- 1. automations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    phase TEXT NOT NULL CHECK (phase IN ('GUARD', 'PRICE', 'ENFORCE', 'OPERATE', 'COMMUNICATE', 'LOG')),
    scope TEXT NOT NULL DEFAULT 'property' CHECK (scope IN ('property', 'system')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_terminal BOOLEAN NOT NULL DEFAULT false,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT terminal_guard_only CHECK (phase = 'GUARD' OR is_terminal = false),
    CONSTRAINT system_scope_no_property CHECK (scope != 'system' OR property_id IS NULL)
);

-- ============================================================================
-- 2. automation_condition_groups (no circular FK)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_condition_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    parent_group_id UUID REFERENCES public.automation_condition_groups(id) ON DELETE CASCADE,
    logic_operator TEXT NOT NULL CHECK (logic_operator IN ('AND', 'OR')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. automation_conditions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.automation_condition_groups(id) ON DELETE CASCADE,
    variable TEXT NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN (
        'IS', 'IS_NOT', 'GT', 'LT', 'GTE', 'LTE',
        'BETWEEN', 'BEFORE', 'AFTER', 'WITHIN_DATE_GROUP',
        'CONTAINS', 'NOT_CONTAINS', 'IS_TRUE', 'IS_FALSE'
    )),
    value JSONB NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. automation_actions (WITHOUT branch_id FK — added after branches)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    branch_id UUID,
    action_type TEXT NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    delay_value INTEGER,
    delay_unit TEXT CHECK (delay_unit IN ('minutes', 'hours', 'days')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. automation_branches
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    parent_action_id UUID NOT NULL REFERENCES public.automation_actions(id) ON DELETE CASCADE,
    branch_type TEXT NOT NULL CHECK (branch_type IN ('THEN', 'ELSE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Add deferred FK: automation_actions.branch_id → automation_branches.id
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'automation_actions_branch_id_fkey'
        AND table_name = 'automation_actions'
    ) THEN
        ALTER TABLE public.automation_actions
            ADD CONSTRAINT automation_actions_branch_id_fkey
            FOREIGN KEY (branch_id) REFERENCES public.automation_branches(id)
            ON DELETE CASCADE
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- ============================================================================
-- 6. automation_execution_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    conditions_passed BOOLEAN,
    actions_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_duration_ms INTEGER,
    skipped_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_automations_property_active_trigger
    ON public.automations (property_id, is_active, trigger_type);


CREATE INDEX IF NOT EXISTS idx_automation_execution_log_automation_id
    ON public.automation_execution_log (automation_id);

CREATE INDEX IF NOT EXISTS idx_automation_execution_log_property_created
    ON public.automation_execution_log (property_id, created_at DESC);

DO $$
BEGIN
    -- automations tenant_id index (column may have been renamed to company_id)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'tenant_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_automations_tenant_id
            ON public.automations (tenant_id);
    END IF;

    -- automation_execution_log tenant_id index (column may have been renamed to company_id)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'automation_execution_log' AND column_name = 'tenant_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_automation_execution_log_tenant_id
            ON public.automation_execution_log (tenant_id);
    END IF;
END $$;


-- ============================================================================
-- updated_at trigger for automations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_automations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_automations_updated_at
    ON public.automations;
CREATE TRIGGER trigger_update_automations_updated_at
    BEFORE UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_automations_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.automations IS
    'Automation rules scoped to a tenant/property, triggered by domain events.';
COMMENT ON TABLE public.automation_condition_groups IS
    'Nested AND/OR groups of conditions for an automation.';
COMMENT ON TABLE public.automation_conditions IS
    'Individual condition checks within a condition group.';
COMMENT ON TABLE public.automation_actions IS
    'Actions executed when conditions pass; optionally nested inside branches.';
COMMENT ON TABLE public.automation_branches IS
    'THEN/ELSE branches attached to a parent action for conditional chaining.';
COMMENT ON TABLE public.automation_execution_log IS
    'Audit log of automation executions, including skipped runs.';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_condition_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_log ENABLE ROW LEVEL SECURITY;

-- Helper: tenant membership check for automations
CREATE OR REPLACE FUNCTION public.is_automation_tenant_member(aut_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.automations WHERE id = aut_id;
    IF v_tenant_id IS NULL THEN RETURN false; END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = v_tenant_id
        AND c.owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.property_staff ps ON ps.property_id = p.id
        WHERE p.company_id = v_tenant_id
        AND ps.user_id = auth.uid()
    );
END;
$$;

-- ============================================================================
-- RLS: automations
-- ============================================================================

-- Service role
DROP POLICY IF EXISTS "Service role full access on automations"
    ON public.automations;
CREATE POLICY "Service role full access on automations"
    ON public.automations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- SELECT: owner or staff of tenant's properties
DROP POLICY IF EXISTS "automations_select_authenticated"
    ON public.automations;
CREATE POLICY "automations_select_authenticated"
    ON public.automations
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

-- INSERT: tenant owners only
DROP POLICY IF EXISTS "automations_insert_authenticated"
    ON public.automations;
CREATE POLICY "automations_insert_authenticated"
    ON public.automations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    );

-- UPDATE: tenant owners only
DROP POLICY IF EXISTS "automations_update_authenticated"
    ON public.automations;
CREATE POLICY "automations_update_authenticated"
    ON public.automations
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    );

-- DELETE: tenant owners only
DROP POLICY IF EXISTS "automations_delete_authenticated"
    ON public.automations;
CREATE POLICY "automations_delete_authenticated"
    ON public.automations
    FOR DELETE
    TO authenticated
    USING (
        tenant_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS: automation_condition_groups (tenant via automation_id)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on automation_condition_groups"
    ON public.automation_condition_groups;
CREATE POLICY "Service role full access on automation_condition_groups"
    ON public.automation_condition_groups
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "automation_condition_groups_select_authenticated"
    ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_select_authenticated"
    ON public.automation_condition_groups
    FOR SELECT
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_condition_groups_insert_authenticated"
    ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_insert_authenticated"
    ON public.automation_condition_groups
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_condition_groups_update_authenticated"
    ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_update_authenticated"
    ON public.automation_condition_groups
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id))
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_condition_groups_delete_authenticated"
    ON public.automation_condition_groups;
CREATE POLICY "automation_condition_groups_delete_authenticated"
    ON public.automation_condition_groups
    FOR DELETE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

-- ============================================================================
-- RLS: automation_conditions (tenant via automation_id)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on automation_conditions"
    ON public.automation_conditions;
CREATE POLICY "Service role full access on automation_conditions"
    ON public.automation_conditions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "automation_conditions_select_authenticated"
    ON public.automation_conditions;
CREATE POLICY "automation_conditions_select_authenticated"
    ON public.automation_conditions
    FOR SELECT
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_conditions_insert_authenticated"
    ON public.automation_conditions;
CREATE POLICY "automation_conditions_insert_authenticated"
    ON public.automation_conditions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_conditions_update_authenticated"
    ON public.automation_conditions;
CREATE POLICY "automation_conditions_update_authenticated"
    ON public.automation_conditions
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id))
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_conditions_delete_authenticated"
    ON public.automation_conditions;
CREATE POLICY "automation_conditions_delete_authenticated"
    ON public.automation_conditions
    FOR DELETE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

-- ============================================================================
-- RLS: automation_actions (tenant via automation_id)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on automation_actions"
    ON public.automation_actions;
CREATE POLICY "Service role full access on automation_actions"
    ON public.automation_actions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "automation_actions_select_authenticated"
    ON public.automation_actions;
CREATE POLICY "automation_actions_select_authenticated"
    ON public.automation_actions
    FOR SELECT
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_actions_insert_authenticated"
    ON public.automation_actions;
CREATE POLICY "automation_actions_insert_authenticated"
    ON public.automation_actions
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_actions_update_authenticated"
    ON public.automation_actions;
CREATE POLICY "automation_actions_update_authenticated"
    ON public.automation_actions
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id))
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_actions_delete_authenticated"
    ON public.automation_actions;
CREATE POLICY "automation_actions_delete_authenticated"
    ON public.automation_actions
    FOR DELETE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

-- ============================================================================
-- RLS: automation_branches (tenant via automation_id)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on automation_branches"
    ON public.automation_branches;
CREATE POLICY "Service role full access on automation_branches"
    ON public.automation_branches
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "automation_branches_select_authenticated"
    ON public.automation_branches;
CREATE POLICY "automation_branches_select_authenticated"
    ON public.automation_branches
    FOR SELECT
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_branches_insert_authenticated"
    ON public.automation_branches;
CREATE POLICY "automation_branches_insert_authenticated"
    ON public.automation_branches
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_branches_update_authenticated"
    ON public.automation_branches;
CREATE POLICY "automation_branches_update_authenticated"
    ON public.automation_branches
    FOR UPDATE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id))
    WITH CHECK (public.is_automation_tenant_member(automation_id));

DROP POLICY IF EXISTS "automation_branches_delete_authenticated"
    ON public.automation_branches;
CREATE POLICY "automation_branches_delete_authenticated"
    ON public.automation_branches
    FOR DELETE
    TO authenticated
    USING (public.is_automation_tenant_member(automation_id));

-- ============================================================================
-- RLS: automation_execution_log
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access on automation_execution_log"
    ON public.automation_execution_log;
CREATE POLICY "Service role full access on automation_execution_log"
    ON public.automation_execution_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- SELECT: tenant owners or staff of tenant's properties
DROP POLICY IF EXISTS "automation_execution_log_select_authenticated"
    ON public.automation_execution_log;
CREATE POLICY "automation_execution_log_select_authenticated"
    ON public.automation_execution_log
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT c.id FROM public.companies c
            WHERE c.owner_id = auth.uid()
        )
        OR property_id IN (SELECT public.get_accessible_property_ids())
    );

-- INSERT: service role only (no authenticated INSERT)
DROP POLICY IF EXISTS "automation_execution_log_insert_authenticated"
    ON public.automation_execution_log;

-- No UPDATE or DELETE policies for authenticated users

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.automations TO service_role;
GRANT ALL ON public.automation_condition_groups TO service_role;
GRANT ALL ON public.automation_conditions TO service_role;
GRANT ALL ON public.automation_actions TO service_role;
GRANT ALL ON public.automation_branches TO service_role;
GRANT ALL ON public.automation_execution_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_condition_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_conditions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_branches TO authenticated;
GRANT SELECT ON public.automation_execution_log TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_automation_tenant_member(UUID) TO authenticated, anon;
