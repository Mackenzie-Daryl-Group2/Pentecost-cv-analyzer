-- Run once in the active Supabase project's SQL Editor.
-- Applicants may access onboarding files only after passing the interview.

drop policy if exists "Applicants upload onboarding documents" on storage.objects;
create policy "Applicants upload onboarding documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'onboarding-documents'
  and (storage.foldername(name))[1] in (
    select id::text
    from public.applications
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(coalesce(interview_passed::text, '')) in ('true', 'yes', '1', 'passed')
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
        and lower(coalesce(interview_passed::text, '')) in ('true', 'yes', '1', 'passed')
    )
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('hr', 'hr_manager', 'admin')
  )
);

notify pgrst, 'reload schema';
