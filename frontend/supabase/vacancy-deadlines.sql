-- Run this in the active Supabase project's SQL Editor.

alter table public.jobs
  add column if not exists application_deadline timestamptz;

create index if not exists jobs_application_deadline_idx
  on public.jobs(application_deadline);

notify pgrst, 'reload schema';
