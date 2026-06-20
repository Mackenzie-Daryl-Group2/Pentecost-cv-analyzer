-- Run this once in the Supabase SQL Editor for the active project.

alter table public.applications
  add column if not exists onboarding_required_documents text[] default array[
    'Signed offer letter',
    'Ghana Card or passport',
    'Academic and professional certificates',
    'SSNIT card or SSNIT number',
    'Tax identification details',
    'Recent passport photograph',
    'Two referee contact details'
  ]::text[],
  add column if not exists onboarding_documents jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_hr_notes text,
  add column if not exists orientation_details text,
  add column if not exists staff_id text,
  add column if not exists onboarding_updated_at timestamptz default now();

create unique index if not exists applications_staff_id_key
  on public.applications (staff_id)
  where staff_id is not null;

insert into storage.buckets (id, name, public)
values ('onboarding-documents', 'onboarding-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Applicants upload onboarding documents" on storage.objects;
create policy "Applicants upload onboarding documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'onboarding-documents'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.applications
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Applicants view onboarding documents" on storage.objects;
create policy "Applicants view onboarding documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'onboarding-documents'
  and (
    (storage.foldername(name))[1] in (
      select id::text
      from public.applications
      where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('hr', 'hr_manager', 'admin')
  )
);

drop policy if exists "HR manages onboarding documents" on storage.objects;
create policy "HR manages onboarding documents"
on storage.objects for all to authenticated
using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('hr', 'hr_manager', 'admin'))
with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('hr', 'hr_manager', 'admin'));

drop policy if exists "HR updates onboarding" on public.applications;
create policy "HR updates onboarding"
on public.applications for update to authenticated
using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('hr', 'hr_manager', 'admin'))
with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('hr', 'hr_manager', 'admin'));

notify pgrst, 'reload schema';
