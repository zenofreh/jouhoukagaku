create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  client_attempt_id text not null,
  display_name text not null,
  mode text not null,
  correct integer not null,
  total integer not null,
  rate integer not null,
  wrong_count integer not null default 0,
  wrong_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.quiz_attempts enable row level security;

drop policy if exists "Anyone can submit quiz attempts" on public.quiz_attempts;
create policy "Anyone can submit quiz attempts"
on public.quiz_attempts
for insert
to anon
with check (
  char_length(display_name) between 1 and 18
  and correct >= 0
  and total > 0
  and correct <= total
  and rate between 0 and 100
);

create index if not exists quiz_attempts_score_idx
on public.quiz_attempts (rate desc, correct desc, created_at desc);
