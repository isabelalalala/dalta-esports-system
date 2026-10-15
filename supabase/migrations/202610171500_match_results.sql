-- Match result submission (part 2 of check-in and result submission)
-- - Storage bucket "match-proofs" (private): screenshots, images only, max 5 MB.
--   Files are stored as <match id>/<random name>. Captains of the two teams upload;
--   members of both teams and staff view (through signed URLs). Nobody overwrites or deletes.
-- - match_result_submissions: a captain submits the score with a screenshot; the other captain
--   confirms or disputes; staff approve, override (their own score) or reject.
--   Approving/overriding updates the match, and the advance trigger moves the winner on.
--   All changes go through the functions below; one open submission per match.
-- - Notifications: result submitted / confirmed / disputed / approved / rejected.
-- - get_needs_attention() also lists open results.
--
-- Runs as one transaction: if any statement fails, nothing is changed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Helpers: who may upload and see a match's files
-- ---------------------------------------------------------------------------

-- The logged-in user captains one of the two teams of the match
create or replace function public.is_match_captain(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    join public.teams t on t.id in (m.team_a_id, m.team_b_id)
    where m.id = p_match_id and t.captain_id = auth.uid()
  )
$$;

-- Staff, or a member of either team of the match
create or replace function public.can_view_match_results(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.get_my_role(), '') in ('admin', 'staff')
    or exists (
      select 1 from public.matches m
      join public.team_members tm on tm.team_id in (m.team_a_id, m.team_b_id)
      where m.id = p_match_id and tm.user_id = auth.uid()
    )
$$;

-- Storage paths are "<match id>/<file>". These take the folder name (text) and return
-- false for anything that isn't a match id, instead of failing on a bad uuid.
create or replace function public.match_proof_folder_match(p_folder text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_folder::uuid
  end
$$;

-- Used by the policies below, which run as the logged-in user
revoke execute on function public.is_match_captain(uuid) from public, anon;
revoke execute on function public.can_view_match_results(uuid) from public, anon;
revoke execute on function public.match_proof_folder_match(text) from public, anon;
grant execute on function public.is_match_captain(uuid) to authenticated;
grant execute on function public.can_view_match_results(uuid) to authenticated;
grant execute on function public.match_proof_folder_match(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Storage bucket and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-proofs', 'match-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Captains upload match proofs" on storage.objects;
create policy "Captains upload match proofs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'match-proofs'
    and public.is_match_captain(public.match_proof_folder_match((storage.foldername(name))[1]))
  );

drop policy if exists "Teams and staff view match proofs" on storage.objects;
create policy "Teams and staff view match proofs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'match-proofs'
    and public.can_view_match_results(public.match_proof_folder_match((storage.foldername(name))[1]))
  );
-- No update or delete policies: proofs can't be replaced or removed from the app.

-- ---------------------------------------------------------------------------
-- 3. match_result_submissions
-- ---------------------------------------------------------------------------
create table public.match_result_submissions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,   -- the submitting team
  submitted_by uuid references public.profiles (id) on delete set null,
  score_a int not null check (score_a >= 0),
  score_b int not null check (score_b >= 0),
  proof_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'disputed', 'approved', 'overridden', 'rejected')),
  dispute_reason text check (length(dispute_reason) <= 500),
  responded_by uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  review_note text check (length(review_note) <= 500),
  -- The score staff applied (differs from score_a/score_b when overridden)
  final_score_a int,
  final_score_b int,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (score_a <> score_b)  -- elimination matches can't end in a tie
);

-- Only one open (not yet reviewed) result per match
create unique index match_results_one_open
  on public.match_result_submissions (match_id)
  where status in ('pending', 'confirmed', 'disputed');

create index match_results_match_idx on public.match_result_submissions (match_id, created_at desc);

alter table public.match_result_submissions enable row level security;

create policy "Teams and staff view results"
  on public.match_result_submissions for select
  to authenticated
  using (public.can_view_match_results(match_id));
-- No insert/update/delete policies: everything goes through the functions below.

-- Realtime: the match page updates when a result is submitted, answered or reviewed
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_result_submissions'
  ) then
    alter publication supabase_realtime add table public.match_result_submissions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Notifications
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved', 'registration_rejected',
  'match_scheduled', 'match_rescheduled', 'match_live',
  'checkin_open', 'match_forfeit',
  'result_submitted', 'result_confirmed', 'result_disputed', 'result_approved', 'result_rejected',
  'announcement',
  'team_invite', 'invite_accepted', 'invite_declined', 'team_captain',
  'team_added',  -- no longer sent (players join by invite); kept for older rows
  'member_left', 'member_removed',
  'student_verified', 'student_rejected', 'student_revoked'
));

-- All admins and staff (for disputed / ready-to-approve results)
create or replace function public.staff_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role in ('admin', 'staff')
$$;

revoke execute on function public.staff_ids() from public, anon, authenticated;

-- "Team A 2 - 1 Team B (Tournament)" for notification texts
create or replace function public.match_result_label(p_match_id uuid, p_score_a int, p_score_b int)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select format('%s %s-%s %s (%s)', ta.name, p_score_a, p_score_b, tb.name, tr.name)
  from public.matches m
  join public.teams ta on ta.id = m.team_a_id
  join public.teams tb on tb.id = m.team_b_id
  join public.tournaments tr on tr.id = m.tournament_id
  where m.id = p_match_id
$$;

revoke execute on function public.match_result_label(uuid, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. submit_match_result(match, score_a, score_b, proof_path): either captain, once the
--    match is live or its time has passed, while it isn't completed.
-- ---------------------------------------------------------------------------
create or replace function public.submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_proof_path text
)
returns uuid  -- the new submission's id
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  my_team uuid;
  other_captain uuid;
  new_id uuid;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;

  select t.id into my_team from public.teams t
  where t.id in (m.team_a_id, m.team_b_id) and t.captain_id = auth.uid();
  if my_team is null then
    raise exception 'Only the captain of a team in this match can submit the result.';
  end if;

  if m.status = 'completed' then
    raise exception 'This match already has a result.';
  end if;
  if m.team_a_id is null or m.team_b_id is null then
    raise exception 'Both teams must be known before a result can be submitted.';
  end if;
  if m.status <> 'live' and (m.scheduled_at is null or now() < m.scheduled_at) then
    raise exception 'You can submit the result once the match has started.';
  end if;

  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'Enter both scores.';
  end if;
  if p_score_a = p_score_b then
    raise exception 'A match can''t end in a tie. Enter the final score.';
  end if;

  -- The screenshot must be in this match's folder and actually uploaded
  if p_proof_path is null or p_proof_path not like p_match_id::text || '/%'
     or not exists (select 1 from storage.objects where bucket_id = 'match-proofs' and name = p_proof_path) then
    raise exception 'Upload a screenshot of the result first.';
  end if;

  if exists (
    select 1 from public.match_result_submissions
    where match_id = p_match_id and status in ('pending', 'confirmed', 'disputed')
  ) then
    raise exception 'A result was already submitted for this match. Confirm or dispute it instead.';
  end if;

  insert into public.match_result_submissions (match_id, team_id, submitted_by, score_a, score_b, proof_path)
  values (p_match_id, my_team, auth.uid(), p_score_a, p_score_b, p_proof_path)
  returning id into new_id;

  select captain_id into other_captain from public.teams
  where id = case when my_team = m.team_a_id then m.team_b_id else m.team_a_id end;

  perform public.notify_users(array[other_captain], 'result_submitted', 'Result submitted',
    'Please confirm or dispute: ' || public.match_result_label(p_match_id, p_score_a, p_score_b) || '.',
    '/matches/' || p_match_id);

  return new_id;
end $$;

revoke execute on function public.submit_match_result(uuid, int, int, text) from public, anon;
grant execute on function public.submit_match_result(uuid, int, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. respond_to_match_result(submission, confirm, reason): the OTHER team's captain.
--    Disputing needs a reason.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_match_result(
  p_submission_id uuid,
  p_confirm boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  m record;
  label text;
begin
  select * into s from public.match_result_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;
  select * into m from public.matches where id = s.match_id;

  if not exists (
    select 1 from public.teams t
    where t.id in (m.team_a_id, m.team_b_id) and t.id <> s.team_id and t.captain_id = auth.uid()
  ) then
    raise exception 'Only the other team''s captain can confirm or dispute this result.';
  end if;
  if s.status <> 'pending' then
    raise exception 'This result has already been answered.';
  end if;
  if not p_confirm and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Please explain what is wrong with the result.';
  end if;

  update public.match_result_submissions
  set status = case when p_confirm then 'confirmed' else 'disputed' end,
      dispute_reason = case when p_confirm then null else left(trim(p_reason), 500) end,
      responded_by = auth.uid(),
      responded_at = now()
  where id = p_submission_id;

  label := public.match_result_label(s.match_id, s.score_a, s.score_b);
  if p_confirm then
    perform public.notify_users(public.staff_ids(), 'result_confirmed', 'Result ready to approve',
      'Both captains agree: ' || label || '.', '/matches/' || s.match_id);
  else
    perform public.notify_users(public.staff_ids() || s.submitted_by, 'result_disputed', 'Result disputed',
      label || ' was disputed: ' || left(trim(p_reason), 200), '/matches/' || s.match_id);
  end if;
end $$;

revoke execute on function public.respond_to_match_result(uuid, boolean, text) from public, anon;
grant execute on function public.respond_to_match_result(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. review_match_result(submission, action, score_a, score_b, note): admin/staff.
--    'approve'  -> the submitted score is applied to the match
--    'override' -> the given score is applied instead
--    'reject'   -> nothing is applied; the captains can submit again (note required)
-- ---------------------------------------------------------------------------
create or replace function public.review_match_result(
  p_submission_id uuid,
  p_action text,
  p_score_a int default null,
  p_score_b int default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  m record;
  final_a int;
  final_b int;
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only tournament staff can review results.';
  end if;
  if p_action not in ('approve', 'override', 'reject') then
    raise exception 'Unknown action.';
  end if;

  select * into s from public.match_result_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;
  if s.status not in ('pending', 'confirmed', 'disputed') then
    raise exception 'This result has already been reviewed.';
  end if;
  select * into m from public.matches where id = s.match_id for update;

  if p_action = 'reject' then
    if length(trim(coalesce(p_note, ''))) = 0 then
      raise exception 'Please give a reason, so the captains know what to submit.';
    end if;
    update public.match_result_submissions
    set status = 'rejected', review_note = left(trim(p_note), 500), reviewed_by = auth.uid(), reviewed_at = now()
    where id = s.id;

    perform public.notify_users(
      array(select captain_id from public.teams where id in (m.team_a_id, m.team_b_id)),
      'result_rejected', 'Result not accepted',
      'The submitted result was not accepted: ' || left(trim(p_note), 200) || ' Please submit it again.',
      '/matches/' || s.match_id);
    return;
  end if;

  if p_action = 'approve' then
    final_a := s.score_a;
    final_b := s.score_b;
  else
    if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
      raise exception 'Enter both scores for the override.';
    end if;
    if p_score_a = p_score_b then
      raise exception 'A match can''t end in a tie.';
    end if;
    final_a := p_score_a;
    final_b := p_score_b;
  end if;

  -- The match triggers check the rules and move the winner into the next match
  -- (refused if the next match has already started).
  update public.matches
  set score_a = final_a,
      score_b = final_b,
      winner_team_id = case when final_a > final_b then m.team_a_id else m.team_b_id end,
      status = 'completed'
  where id = m.id;

  update public.match_result_submissions
  set status = case when p_action = 'approve' then 'approved' else 'overridden' end,
      final_score_a = final_a, final_score_b = final_b,
      review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = s.id;

  perform public.notify_users(public.team_member_ids(array[m.team_a_id, m.team_b_id]),
    'result_approved', 'Result confirmed',
    'Final result: ' || public.match_result_label(m.id, final_a, final_b) ||
      case when p_action = 'override' then ' (set by tournament staff).' else '.' end,
    '/matches/' || m.id);
end $$;

revoke execute on function public.review_match_result(uuid, text, int, int, text) from public, anon;
grant execute on function public.review_match_result(uuid, text, int, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. "Needs attention": same as 202610171400_match_checkin, plus open results
--    (disputed, confirmed = ready to approve, pending = waiting for the other captain).
-- ---------------------------------------------------------------------------
create or replace function public.get_needs_attention()
returns table (
  kind text,              -- 'no_checkin', 'result_disputed', 'result_confirmed', 'result_pending'
  match_id uuid,
  tournament_id uuid,
  tournament_name text,
  round int,
  round_count int,
  match_number int,
  team_a text,
  team_b text,
  detail text,
  since timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
-- (the output columns match_id, round, ... share names with table columns; use the columns)
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'staff') then
    raise exception 'Only tournament staff can see this list.';
  end if;

  return query
  select 'no_checkin'::text, m.id, tr.id, tr.name, m.round,
         (select max(m2.round) from public.matches m2 where m2.tournament_id = m.tournament_id),
         m.match_number, ta.name, tb.name,
         'Not checked in: ' || concat_ws(', ',
           case when not exists (select 1 from public.match_checkins c where c.match_id = m.id and c.team_id = m.team_a_id) then ta.name end,
           case when not exists (select 1 from public.match_checkins c where c.match_id = m.id and c.team_id = m.team_b_id) then tb.name end),
         m.scheduled_at
  from public.matches m
  join public.tournaments tr on tr.id = m.tournament_id
  join public.teams ta on ta.id = m.team_a_id
  join public.teams tb on tb.id = m.team_b_id
  where m.status = 'scheduled'
    and m.scheduled_at is not null
    and m.scheduled_at <= now()
    and tr.checkin_window_minutes > 0
    and (select count(*) from public.match_checkins c where c.match_id = m.id) < 2
    -- a submitted result is listed below instead
    and not exists (
      select 1 from public.match_result_submissions s
      where s.match_id = m.id and s.status in ('pending', 'confirmed', 'disputed')
    )

  union all

  select 'result_' || s.status, m.id, tr.id, tr.name, m.round,
         (select max(m2.round) from public.matches m2 where m2.tournament_id = m.tournament_id),
         m.match_number, ta.name, tb.name,
         format('%s-%s submitted by %s', s.score_a, s.score_b, st.name) ||
           case when s.status = 'disputed' then ': ' || coalesce(s.dispute_reason, '') else '' end,
         coalesce(s.responded_at, s.created_at)
  from public.match_result_submissions s
  join public.matches m on m.id = s.match_id
  join public.tournaments tr on tr.id = m.tournament_id
  join public.teams ta on ta.id = m.team_a_id
  join public.teams tb on tb.id = m.team_b_id
  join public.teams st on st.id = s.team_id
  where s.status in ('pending', 'confirmed', 'disputed')

  order by 11;
end $$;

commit;
