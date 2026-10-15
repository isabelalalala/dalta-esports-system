-- Feedback and Sentiment Analysis (Module 5)  [DFD: D4 Feedback DB]
-- - Logged-in users submit a rating (1-5) and a comment, optionally about one tournament.
-- - Admin/staff classify the sentiment with Gemini (server route /api/feedback/classify);
--   only they can write the sentiment fields, so results can't be faked.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- Emptied when the account is deleted, so the feedback stays for reports
  user_id uuid references public.profiles (id) on delete set null,
  -- Empty = general feedback about the event or the system
  tournament_id uuid references public.tournaments (id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text not null check (length(trim(comment)) between 3 and 1000),
  -- Filled in by the classification (Gemini)
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  sentiment_score numeric(3, 2) check (sentiment_score between -1 and 1),  -- -1 very negative .. 1 very positive
  topics text[] not null default '{}',  -- short "common concern" labels, e.g. {"stream quality"}
  classified_at timestamptz,
  created_at timestamptz not null default now()
);

create index feedback_tournament_idx on public.feedback (tournament_id);
-- The classify route looks for feedback that hasn't been classified yet
create index feedback_unclassified_idx on public.feedback (created_at) where sentiment is null;

alter table public.feedback enable row level security;

-- Users send their own feedback, without a sentiment (that is the organizers' job).
create policy "Users submit their own feedback"
  on public.feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and sentiment is null and sentiment_score is null
    and topics = '{}' and classified_at is null
  );

create policy "Users read their own feedback"
  on public.feedback for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admin/staff read all feedback"
  on public.feedback for select
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'));

-- Classification results (the trigger below only allows the sentiment fields to change)
create policy "Admin/staff save sentiment results"
  on public.feedback for update
  to authenticated
  using (public.get_my_role() in ('admin', 'staff'))
  with check (public.get_my_role() in ('admin', 'staff'));

create policy "Admins delete feedback"
  on public.feedback for delete
  to authenticated
  using (public.get_my_role() = 'admin');

-- Nobody edits what a user wrote: only the sentiment fields may change.
create or replace function public.protect_feedback()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The links may only be cleared (that's what happens when the account or
  -- tournament is deleted), never pointed somewhere else.
  if new.rating is distinct from old.rating
     or new.comment is distinct from old.comment
     or new.created_at is distinct from old.created_at
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or (new.tournament_id is distinct from old.tournament_id and new.tournament_id is not null) then
    raise exception 'Feedback can''t be edited; only its sentiment can be saved.';
  end if;
  return new;
end $$;

create trigger feedback_protect
  before update on public.feedback
  for each row execute function public.protect_feedback();

commit;
