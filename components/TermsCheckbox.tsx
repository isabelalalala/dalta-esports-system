import Link from 'next/link';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  dark?: boolean;
}

// Terms of Service + age declaration checkbox, used on /auth/register and /terms/accept.
// Accepting also records the declaration "at least 18, or parent/guardian consent"
// (profiles.tos_version + tos_accepted_at via accept_tos). The terms open in a new tab
// so the form isn't lost.
export default function TermsCheckbox({ checked, onChange, dark }: Props) {
  return (
    <label className={`flex items-start gap-3 text-xs sm:text-sm ${dark ? 'text-stone-200' : 'text-stone-800'} font-semibold uppercase tracking-wide cursor-pointer`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-amber-500"
        required
      />
      <span>
        I agree to the{' '}
        <Link href="/terms" target="_blank" className={`${dark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-800 hover:text-amber-950'} font-black uppercase underline`}>
          Terms of Service
        </Link>{' '}
        and confirm I am at least 18 years old, or have my parent&apos;s or guardian&apos;s consent.
      </span>
    </label>
  );
}
