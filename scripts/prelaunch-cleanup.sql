-- PRE-LAUNCH CLEANUP of test / placeholder data (written 2026-11-09 from the pre-launch audit)
--
-- NOT a migration: run it by hand in the Supabase SQL Editor, AFTER reviewing it.
--   1. Run PART A (read-only) and check every row it lists.
--   2. Edit PART B: delete the lines for anything you want to KEEP.
--   3. Run PART B as it is: it ends with ROLLBACK, so you see the effect but nothing is saved.
--   4. When happy, change the last line from `rollback;` to `commit;` and run PART B again.
-- Take a backup first (Supabase dashboard → Database → Backups, or Project Settings → export).
--
-- Deleting a tournament also deletes its registrations, matches (with check-ins, result
-- submissions and pick'em picks), announcements and streams (with views and comments).
-- Feedback about it is kept but loses its tournament link. Teams are NOT deleted.

-- =========================================================================================
-- PART A: REVIEW (read-only)
-- =========================================================================================

-- A1. Tournaments found by the audit (test names / keyboard-mash descriptions)
select id, name, description, start_date, created_at
from public.tournaments
order by created_at;

-- A2. Website items that say draft / test
select 'event' as kind, id, title, description, is_published from public.events
where description ~* 'draft|test' or title ~* 'draft|test'
union all
select 'campaign', id, title, description, is_published from public.campaigns
where description ~* 'draft|test' or title ~* 'draft|test'
union all
select 'official team', id, name, description, is_published from public.official_teams
where description ~* 'draft|test' or name ~* 'draft|test';

-- A3. Site texts and division descriptions that still start with "(draft)"
select 'site_content' as kind, key, value from public.site_content where value ~* '^\s*[(\[]\s*draft'
union all
select 'division', game_id, description from public.game_divisions where description ~* '^\s*[(\[]\s*draft';

-- A4. Streams (the audit saw two live ones pointing at non-esports test videos)
select s.id, s.title, s.status, s.facebook_url, t.name as tournament
from public.streams s join public.tournaments t on t.id = s.tournament_id
order by s.created_at;

-- A5. Possible test accounts (check by hand; real students may have odd names)
select id, email, full_name, role, created_at
from public.profiles
where email ~* 'test|example|mailinator|yopmail|\+'
   or full_name ~* 'test|asd|qwe|sample|dummy|(.)\1{3,}'
order by created_at;

-- A6. Possible test teams
select t.id, t.name, g.name as game, t.created_at, t.is_removed
from public.teams t join public.games g on g.id = t.game_id
where t.name ~* 'test|asd|qwe|sample|dummy|bla|(.)\1{3,}' or length(t.name) <= 3
order by t.created_at;

-- A6b. Test team descriptions (keyboard mash on team cards: "fddfdfd", "dbfhhhhshsjd", "Letsgo")
select t.id, t.name, t.description
from public.teams t
where t.description ~* '^\s*(fddfdfd|dbfhhhhshsjd|letsgo)\s*$'
   or t.description ~* '(.){3,}|^[^aeiou\s]{6,}$|test|asd|qwe|lorem'
order by t.created_at;

-- A7. Test feedback and comments
select 'feedback' as kind, id, comment as text, created_at from public.feedback
where comment ~* 'test|asd|qwe|lorem|(.)\1{3,}'
union all
select 'comment', id, content, created_at from public.stream_comments
where content ~* 'test|asd|qwe|lorem|(.)\1{3,}'
order by created_at;

-- =========================================================================================
-- PART B: CLEANUP (ends with ROLLBACK until you change it)
-- =========================================================================================
begin;

-- B1. Remove the "(draft)" marker from About texts and division descriptions.
--     Only do this once the wording itself is final (otherwise edit it on /admin/website).
update public.site_content
set value = regexp_replace(value, '^\s*[(\[]\s*draft\s*[)\]]\s*[:\-–]?\s*', '', 'i'), updated_at = now()
where value ~* '^\s*[(\[]\s*draft';

update public.game_divisions
set description = regexp_replace(description, '^\s*[(\[]\s*draft\s*[)\]]\s*[:\-–]?\s*', '', 'i')
where description ~* '^\s*[(\[]\s*draft';

-- B2. Hide test website items (reversible: re-publish them on /admin/website after editing).
update public.events set is_published = false, is_featured = false
where description ~* 'draft|for testing';
update public.campaigns set is_published = false
where description ~* 'draft|for testing';
update public.official_teams set is_published = false
where description ~* 'draft|for testing';

-- B3. Delete the test tournaments (and everything under them, see the top of this file).
--     "VALORANT Championship" (f58a6eb3…) has an empty description: it is NOT in this list.
--     Remove ids from the list for any tournament you want to keep.
delete from public.tournaments where id in (
  '4e35cf24-71d2-4564-b5cb-2ff93b96f5c0', -- CODM Championship ("sadsad")
  '483654b9-6fd8-4fab-b49d-23a4176e89a7', -- BLALALALAL
  '2a777c67-1093-4cc4-b5e9-154bf9d50ae2', -- CODM SEMI-FINALS ("(DRAFT) FOR TESTING ONLY")
  '6f87aeac-8494-4676-8705-032cb60e7929', -- VALORANT ("hhhhh"; live stream "LETSGO" = a MYX music video)
  '829b00b9-c044-49db-8226-f4b6fe6c4560', -- MLBB ("hhhhhbv. ccccc")
  '126bcd7d-9326-47ac-ad71-6cb96ef0ba2c', -- LoL
  'a3bd496a-ba02-47a3-af65-049edab4547f', -- CODM Elim (live stream "LEZGO")
  '8468e34f-aea8-4cb5-bf3d-4648d2232aca'  -- Tekken elim
);

-- B3b. Clear test team descriptions (the card then hides the description). Only the three
--      found by the Phase 10 review; add others from A6b if you checked them.
update public.teams set description = null
where description ~* '^\s*(fddfdfd|dbfhhhhshsjd|letsgo)\s*$';

-- B4. Test accounts, teams, feedback and comments: no automatic deletes. After checking A5–A7,
--     delete accounts on /admin/users (it also removes their auth login), remove teams on
--     /admin/teams, and delete feedback/comments on /admin/feedback and /admin/moderation.

-- Check the result before deciding:
select (select count(*) from public.tournaments) as tournaments_left,
       (select count(*) from public.events where is_published) as published_events,
       (select count(*) from public.campaigns where is_published) as published_campaigns,
       (select count(*) from public.teams where description ~* '^\s*(fddfdfd|dbfhhhhshsjd|letsgo)\s*$') as test_team_descriptions_left;

rollback;  -- change to: commit;
