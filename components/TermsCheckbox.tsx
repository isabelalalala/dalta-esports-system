import Link from 'next/link';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Terms of Service + age declaration checkbox, used on /auth/register and /terms/accept.
// Accepting also records the declaration "at least 18, or parent/guardian consent"
// (profiles.tos_version + tos_accepted_at via accept_tos). The terms open in a new tab
// so the form isn't lost.
export default function TermsCheckbox({ checked, onChange }: Props) {
  return (
    <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-gold"
        required
      />
      <span>
        I agree to the{' '}
        <Link href="/terms" target="_blank" className="text-gold underline">
          Terms of Service
        </Link>{' '}
        and confirm I am at least 18 years old, or have my parent&apos;s or guardian&apos;s consent.
      </span>
    </label>
  );
}
