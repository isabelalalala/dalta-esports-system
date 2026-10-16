-- Tighten streams.facebook_url: the embedded player (plugins/video.php) only
-- renders video/live posts, but the old CHECK accepted any facebook.com link
-- (pages, profiles, groups, events) which embed as a permanently broken player.
-- Keep this in sync with FACEBOOK_VIDEO_URL in utils/streams.ts.

begin;

alter table public.streams drop constraint streams_facebook_url_check;

alter table public.streams add constraint streams_facebook_url_check
  check (facebook_url ~* '^https://(www\.|m\.|web\.)?facebook\.com/(watch[/?#]|reel/|story\.php\?|[^/?#]+/(videos|live)([/?#]|$))');

commit;
