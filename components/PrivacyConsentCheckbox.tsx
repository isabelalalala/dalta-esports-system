import Link from 'next/link';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// The Data Privacy Act consent checkbox, used on /auth/register and /privacy/consent.
// The Privacy Notice opens in a new tab so the form isn't lost.
export default function PrivacyConsentCheckbox({ checked, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#00d2ff]"
          required
        />
        <span>
          I agree to the collection and processing of my personal data as described in the{' '}
          <Link href="/privacy" target="_blank" className="text-[#00d2ff] underline">
            Privacy Notice
          </Link>
          .
        </span>
      </label>
      <p className="text-xs text-gray-500 pl-7">
        Under 18? Your parent or guardian must read the Privacy Notice and agree to it with you.
      </p>
    </div>
  );
}
