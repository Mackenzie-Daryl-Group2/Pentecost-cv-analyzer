-- Run this in the active Supabase project's SQL Editor.

create table if not exists public.recruitment_settings (
  id smallint primary key default 1 check (id = 1),
  cv_pass_threshold smallint not null default 55 check (cv_pass_threshold between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.recruitment_settings (id, cv_pass_threshold)
values (1, 55)
on conflict (id) do nothing;

alter table public.recruitment_settings enable row level security;

drop policy if exists "Staff read recruitment settings" on public.recruitment_settings;
create policy "Staff read recruitment settings"
on public.recruitment_settings for select to authenticated
using (
  coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  ) in ('hr', 'hr_manager', 'admin')
);

notify pgrst, 'reload schema';
