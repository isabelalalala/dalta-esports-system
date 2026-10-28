import Link from 'next/link';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  dark?: boolean;
}

// The Data Privacy Act consent checkbox, used on /auth/register and /privacy/consent.
// The Privacy Notice opens in a new tab so the form isn't lost.
export default function PrivacyConsentCheckbox({ checked, onChange, dark }: Props) {
  return (
    <div className="space-y-2">
      <label className={`flex items-start gap-3 text-xs sm:text-sm ${dark ? 'text-stone-200' : 'text-stone-800'} font-semibold uppercase tracking-wide cursor-pointer`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-amber-500"
          required
        />
        <span>
          I agree to the collection and processing of my personal data as described in the{' '}
          <Link href="/privacy" target="_blank" className={`${dark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-800 hover:text-amber-950'} font-black uppercase underline`}>
            Privacy Notice
          </Link>
          .
        </span>
      </label>
      <p className={`text-xs ${dark ? 'text-stone-400' : 'text-stone-500'} font-medium uppercase tracking-wider pl-7`}>
        Under 18? Your parent or guardian must read the Privacy Notice and agree to it with you.
      </p>
    </div>
  );
}
