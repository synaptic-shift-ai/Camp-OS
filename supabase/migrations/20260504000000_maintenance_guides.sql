-- Maintenance Guides: step-by-step instruction templates for maintenance tasks
CREATE TABLE IF NOT EXISTS public.maintenance_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_guides_property_id_lower_name_idx
  ON public.maintenance_guides (property_id, lower(name));

ALTER TABLE public.maintenance_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_maintenance_guides" ON public.maintenance_guides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_crud_maintenance_guides" ON public.maintenance_guides
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = maintenance_guides.property_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = maintenance_guides.property_id
    )
  );
