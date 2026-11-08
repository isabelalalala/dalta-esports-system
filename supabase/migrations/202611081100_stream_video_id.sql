-- Phase 2.3: Facebook links are saved in canonical form, with the video id.
--
-- The stream form now turns share links (/share/v/, /share/r/, fb.watch), embed code and other
-- link forms into one canonical address (https://www.facebook.com/<page>/videos/<id>/ or
-- https://www.facebook.com/watch/?v=<id>) before saving. That address already passes
-- streams_facebook_url_check (202610181310). This adds the video id next to it.
--
-- facebook_video_id is empty for older rows and for the id-less forms the check still accepts
-- (a page's /live, story.php). The app canonicalizes those when it embeds them.
--
-- Run in the Supabase SQL Editor after 202611081000_team_removal.sql.

begin;

alter table public.streams
  add column if not exists facebook_video_id text;

alter table public.streams drop constraint if exists streams_facebook_video_id_check;
alter table public.streams add constraint streams_facebook_video_id_check
  check (facebook_video_id is null or facebook_video_id ~ '^[0-9]{5,30}$');

-- Fill it in for existing rows whose link already carries an id
update public.streams
set facebook_video_id = coalesce(
  substring(facebook_url from '[?&]v=([0-9]{5,30})'),
  substring(facebook_url from '/videos/(?:[^/?#]+/)*([0-9]{5,30})'),
  substring(facebook_url from '/reel/([0-9]{5,30})')
)
where facebook_video_id is null;

commit;
