-- ZERO cloud database foundation
-- Run this script in Supabase SQL Editor. Safe to re-run.
create table if not exists public.zero_user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (module in ('watchlist','trades','holdings','finance')),
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, module),
  constraint zero_payload_is_array check (jsonb_typeof(payload) = 'array')
);

create index if not exists zero_user_data_updated_at_idx
  on public.zero_user_data (updated_at desc);

alter table public.zero_user_data enable row level security;

drop policy if exists "Users can read their own ZERO data" on public.zero_user_data;
create policy "Users can read their own ZERO data"
  on public.zero_user_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own ZERO data" on public.zero_user_data;
create policy "Users can insert their own ZERO data"
  on public.zero_user_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ZERO data" on public.zero_user_data;
create policy "Users can update their own ZERO data"
  on public.zero_user_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own ZERO data" on public.zero_user_data;
create policy "Users can delete their own ZERO data"
  on public.zero_user_data for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.zero_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists zero_user_data_updated_at on public.zero_user_data;
create trigger zero_user_data_updated_at
before update on public.zero_user_data
for each row execute function public.zero_set_updated_at();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.zero_user_data to authenticated;

-- No anon/public policies. Never expose the service_role key in browser code.
