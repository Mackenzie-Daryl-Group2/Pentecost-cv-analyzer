-- Run once in the active Supabase project's SQL Editor.

alter table public.applications
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists talent_pool_consent boolean not null default false,
  add column if not exists talent_pool_added_at timestamptz,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawal_reason text,
  add column if not exists cv_replaced_at timestamptz,
  add column if not exists data_deletion_requested_at timestamptz,
  add column if not exists retention_until timestamptz,
  add column if not exists offer_status text,
  add column if not exists offer_details jsonb not null default '{}'::jsonb,
  add column if not exists offer_generated_at timestamptz,
  add column if not exists offer_responded_at timestamptz;

create index if not exists applications_talent_pool_idx
  on public.applications (talent_pool_consent, talent_pool_added_at desc);

create index if not exists applications_retention_idx
  on public.applications (retention_until)
  where retention_until is not null;

update public.applications
set retention_until = coalesce(submitted_at, now()) + interval '24 months'
where retention_until is null;

notify pgrst, 'reload schema';
