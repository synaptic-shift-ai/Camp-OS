-- Track auth user who moved a housekeeping task to in_progress / done

ALTER TABLE public.housekeeping_tasks
  ADD COLUMN IF NOT EXISTS start_by UUID,
  ADD COLUMN IF NOT EXISTS completed_by UUID;

COMMENT ON COLUMN public.housekeeping_tasks.start_by IS
  'auth.users id of the user who last set status to in_progress.';
COMMENT ON COLUMN public.housekeeping_tasks.completed_by IS
  'auth.users id of the user who set status to done.';
