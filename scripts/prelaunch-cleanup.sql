-- PRE-LAUNCH CLEANUP of test / placeholder data (written 2026-11-09 from the pre-launch audit;
-- 2026-11-10: fixed the A6b pattern, added A8-A12 for announcements, people, site texts, streams)
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
   or t.description ~* '(.)\1{3,}|^[^aeiou\s]{6,}$|test|asd|qwe|lorem'  -- (.)\1{3,} = one character 4+ times in a row
order by t.created_at;

-- A7. Test feedback and comments
select 'feedback' as kind, id, comment as text, created_at from public.feedback
where comment ~* 'test|asd|qwe|lorem|(.)\1{3,}'
union all
select 'comment', id, content, created_at from public.stream_comments
where content ~* 'test|asd|qwe|lorem|(.)\1{3,}'
order by created_at;

-- Keyboard mash and placeholder words seen during the audits:
--   (.)\1{3,}                     one character 4+ times in a row ("hhhhhb", "cccccgggg")
--   (..)\2{2,}                    one pair 3+ times in a row ("ererererererere")
-- Found live on 2026-11-10 (public pages): announcements "rewrreerew" (body "ererererererere") and
-- "rehgedh" ("eherhehe"); campaigns "TRYOUTS - DALTA ESPORTS" and "CAMPAIGN LEVEL UP" and events
-- "CAMPUS ROADSHOW", "ALLIANCE GAMES SEASON 6 SOUTH LUZON", "allstar tournament" ("(DRAFT) FOR
-- TESTING ONLY" / "for testing": hidden by B2).
--   bla(la)+ | rehgedh | eh(e?r?h?e){2,} | sadsad | fddf | dbfh   mashes reported by testers
--   lorem | sample | dummy | for testing | create a context | subname | IGN – ROLE   placeholders

-- A8. Announcements (drafts are never shown to spectators; published ones are)
select id, title, is_draft, publish_at, created_at, left(body, 80) as body_start
from public.announcements
where title ~* '(.)\1{3,}|(..)\2{2,}|bla(la)+|rehgedh|rewrreerew|test|lorem|sample|dummy|draft'
   or body ~* '(.)\1{3,}|(..)\2{2,}|bla(la)+|rehgedh|eherhehe|for testing|lorem|create a context|sample text'
order by created_at;

-- A9. Officers, official teams and their players (names must be final and spelled right)
select 'officer' as kind, id, name, position as detail, is_published::text as published from public.officers
where name ~* '(.)\1{3,}|test|sample|dummy|lorem|^\s*$' or position ~* 'test|sample|lorem'
union all
select 'official team', id, name || coalesce(' / ' || subname, ''), description, is_published::text from public.official_teams
where name ~* 'team\s*\d|test|sample|subname' or subname ~* 'subname|sample|test' or description ~* 'lorem|sample|test|draft|create a context'
union all
select 'official player', p.id, p.ign || ' / ' || p.name, p.role, t.is_published::text
from public.official_team_players p join public.official_teams t on t.id = p.team_id
where p.ign ~* '^\s*ign\s*$|test|sample|(.)\1{3,}' or p.name ~* 'test|sample|player\s*\d' or p.role ~* '^\s*role\s*$';

-- A10. Site texts with placeholder wording (About, Mission, Vision, motto, footer, contact)
select key, left(value, 120) as value from public.site_content
where value ~* 'lorem|sample|placeholder|create a context|tbd|to follow|example\.com|(.)\1{3,}|draft'
order by key;

-- A11. "Connect With Us" links: check each one opens the real account (the footer hides non-https values)
select key, value from public.site_content where key like 'social_%' or key like 'contact_%' order by key;

-- A12. Keyboard mash in tournaments, events, campaigns, streams
select 'tournament' as kind, id, name as title, left(description, 80) as text from public.tournaments
where name ~* 'bla(la)+|(.)\1{3,}|test' or description ~* '(.)\1{3,}|bla(la)+|rehgedh|eh(e?r?h?e){2,}|sadsad|for testing'
union all
select 'event', id, title, left(description, 80) from public.events
where title ~* '(.)\1{3,}|test' or description ~* '(.)\1{3,}|rehgedh|for testing|lorem'
union all
select 'campaign', id, title, left(description, 80) from public.campaigns
where title ~* '(.)\1{3,}|test' or description ~* '(.)\1{3,}|rehgedh|for testing|lorem'
union all
select 'stream', id, title, facebook_url from public.streams
where title ~* '(.)\1{3,}|test|letsgo|lezgo';

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

-- B3c. Test announcements: turn them back into drafts (hidden from everyone but organizers,
--      reversible). Delete them on /announcements instead if they should go for good.
update public.announcements set is_draft = true, pinned = false
where title ~* '(.)\1{3,}|(..)\2{2,}|bla(la)+|rehgedh|rewrreerew|for testing|lorem'
   or body ~* '(.)\1{3,}|(..)\2{2,}|bla(la)+|rehgedh|eherhehe|for testing|lorem|create a context';

-- B3d. Test streams still marked live (the LIVE banner shows them on every page): mark them ended.
update public.streams set status = 'ended'
where status = 'live' and title ~* '(.)\1{3,}|test|letsgo|lezgo';

-- B4. Test accounts, teams, feedback and comments: no automatic deletes. After checking A5–A7,
--     delete accounts on /admin/users (it also removes their auth login), remove teams on
--     /admin/teams, and delete feedback/comments on /admin/feedback and /admin/moderation.

-- Check the result before deciding:
select (select count(*) from public.tournaments) as tournaments_left,
       (select count(*) from public.events where is_published) as published_events,
       (select count(*) from public.campaigns where is_published) as published_campaigns,
       (select count(*) from public.teams where description ~* '^\s*(fddfdfd|dbfhhhhshsjd|letsgo)\s*$') as test_team_descriptions_left;

rollback;  -- change to: commit;
