'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import {
  getPasswordChecks,
  getPasswordError,
  getPasswordStrength,
  type PasswordContext,
} from '@/utils/password';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  // New password: show the rules checklist and strength bar, and block weak passwords
  rules?: PasswordContext;
  // Confirm field: the password it must equal
  matches?: string;
  dark?: boolean;
  hideRules?: boolean;
}

const strengthStyles = {
  weak: { label: 'Weak', bar: 'w-1/3 bg-red-600', text: 'text-red-700', darkText: 'text-red-400' },
  fair: { label: 'Good', bar: 'w-2/3 bg-amber-500', text: 'text-amber-800', darkText: 'text-amber-300' },
  strong: { label: 'Strong', bar: 'w-full bg-green-600', text: 'text-green-800', darkText: 'text-emerald-300' },
};

export function PasswordRules({
  value,
  rules,
  dark,
  className = '',
}: {
  value: string;
  rules?: PasswordContext;
  dark?: boolean;
  className?: string;
}) {
  if (!rules) return null;
  const strength = value ? strengthStyles[getPasswordStrength(value, rules)] : null;
  const checks = getPasswordChecks(value, rules);

  return (
    <div className={`mt-2.5 space-y-2.5 ${className}`}>
      {strength && (
        <div className="flex items-center gap-3">
          <div className={`h-2 flex-1 rounded-full overflow-hidden ${dark ? 'bg-stone-800 border border-white/20' : 'bg-stone-100 border border-stone-200'}`}>
            <div className={`h-full ${strength.bar}`} />
          </div>
          <span className={`text-xs font-black uppercase tracking-wider ${dark ? strength.darkText : strength.text}`}>
            {strength.label}
          </span>
        </div>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs uppercase tracking-wide">
        {checks.map((check) => (
          <li
            key={check.label}
            className={`flex items-start gap-1.5 font-bold ${
              check.ok
                ? (dark ? 'text-emerald-300' : 'text-green-800')
                : (dark ? 'text-stone-400' : 'text-stone-500')
            }`}
          >
            {check.ok ? (
              <Check className={`h-3.5 w-3.5 mt-px shrink-0 ${dark ? 'text-emerald-400' : 'text-green-700'}`} aria-hidden />
            ) : (
              <X className={`h-3.5 w-3.5 mt-px shrink-0 ${dark ? 'text-stone-500' : 'text-stone-400'}`} aria-hidden />
            )}
            <span>
              {check.label}
              <span className="sr-only">{check.ok ? ' (done)' : ' (missing)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Password input with a show/hide button. With `rules` it also shows which password
// rules are met (utils/password.ts); with `matches` it checks the confirmation.
// Either way the browser refuses to submit the form until the field is valid.
export default function PasswordField({ value, onChange, className, placeholder, autoComplete, rules, matches, dark, hideRules }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [visible, setVisible] = useState(false);

  const ruleError = rules && value ? getPasswordError(value, rules) : null;
  const mismatch = matches !== undefined && value !== '' && value !== matches;
  const validity = ruleError ?? (mismatch ? 'The passwords do not match.' : '');

  useEffect(() => {
    inputRef.current?.setCustomValidity(validity);
  }, [validity]);

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!validity}
          aria-describedby={rules || mismatch ? hintId : undefined}
          className={`${className} pr-12`}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className={`absolute inset-y-0 right-0 px-3 ${dark ? 'text-stone-400 hover:text-amber-400' : 'text-gray-400 hover:text-gold'}`}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {rules && !hideRules && (
        <div id={hintId}>
          <PasswordRules value={value} rules={rules} dark={dark} />
        </div>
      )}

      {mismatch && (
        <p id={hintId} className={`mt-1 text-xs font-bold uppercase tracking-wider ${dark ? 'text-red-400' : 'text-red-700'}`}>The passwords do not match.</p>
      )}
    </div>
  );
}
