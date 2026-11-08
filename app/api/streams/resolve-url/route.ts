import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { can } from '@/utils/permissions';
import { FACEBOOK_LINK_HELP, parseFacebookInput } from '@/utils/streams';
import { checkFacebookEmbed, resolveFacebookShareLink } from '@/utils/facebook-resolve';

// Following a redirect chain and checking the embed page: two requests of up to 8 s each
export const maxDuration = 20;

// POST /api/streams/resolve-url  { url }  ->  { canonicalUrl, videoId, embeddable }
// Turns whatever staff pasted (share link, fb.watch, embed code, /watch, /videos/) into the
// canonical video address that the embedded player needs. Organizers only: it makes requests to
// Facebook on the server's behalf.
// embeddable: false when Facebook's own embed page says the video can't be shown (private,
// embedding off, restricted); null when we couldn't tell. It's a warning for the form, not a block.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }
  const { data: role } = await supabase.rpc('get_my_role');
  if (!can(role, 'stream.configure')) {
    return NextResponse.json({ error: 'Only organizers can configure streams.' }, { status: 403 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const input = typeof body.url === 'string' ? body.url.slice(0, 4000) : '';

  const parsed = parseFacebookInput(input);
  if (parsed.kind === 'invalid') {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  const resolved = parsed.kind === 'video'
    ? { canonicalUrl: parsed.canonicalUrl, videoId: parsed.videoId }
    : await resolveFacebookShareLink(parsed.url);
  if (!resolved) {
    return NextResponse.json({ error: FACEBOOK_LINK_HELP }, { status: 422 });
  }
  const embeddable = await checkFacebookEmbed(resolved.canonicalUrl);
  return NextResponse.json({ ...resolved, embeddable });
}
