CREATE TABLE IF NOT EXISTS public.maintenance_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_guides_name_unique UNIQUE (property_id, LOWER(name))
);

ALTER TABLE public.maintenance_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.maintenance_guides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_crud" ON public.maintenance_guides
  FOR ALL TO authenticated
  USING (
    property_id IN (SELECT id FROM public.properties WHERE company_id = (SELECT company_id FROM public.properties WHERE id = property_id))
  )
  WITH CHECK (
    property_id IN (SELECT id FROM public.properties WHERE company_id = (SELECT company_id FROM public.properties WHERE id = property_id))
  );
