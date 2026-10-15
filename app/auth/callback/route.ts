import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

// Email links (e.g. "reset your password") land here. This logs the user in
// from the link, then sends them on to `next`.
//
// Two link formats are supported:
// - ?code=...                      Supabase's default link. Only works in the same
//                                  browser that asked for the email.
// - ?token_hash=...&type=recovery  Works on any device; needs the email template
//                                  changed in Supabase (see CLAUDE.md).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  // Only allow paths inside this app, so a crafted link can't redirect to another site.
  const nextParam = params.get('next') ?? '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';

  const supabase = await createClient();
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  }

  // Always continue to `next`, even if the link was invalid or expired:
  // the next page sees there is no session and explains what to do
  // (the reset password page says the link expired; protected pages go to login).
  return NextResponse.redirect(new URL(next, request.url));
}
