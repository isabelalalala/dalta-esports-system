// Gets a readable message from anything thrown in a try/catch.
// Supabase errors are objects with a `message`, but not always `Error` instances.
export function getErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}
