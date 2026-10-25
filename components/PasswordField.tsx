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
}

const strengthStyles = {
  weak: { label: 'Weak', bar: 'w-1/3 bg-red-500', text: 'text-red-300' },
  fair: { label: 'Good', bar: 'w-2/3 bg-yellow-400', text: 'text-yellow-200' },
  strong: { label: 'Strong', bar: 'w-full bg-green-500', text: 'text-green-300' },
};

// Password input with a show/hide button. With `rules` it also shows which password
// rules are met (utils/password.ts); with `matches` it checks the confirmation.
// Either way the browser refuses to submit the form until the field is valid.
export default function PasswordField({ value, onChange, className, placeholder, autoComplete, rules, matches }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [visible, setVisible] = useState(false);

  const ruleError = rules && value ? getPasswordError(value, rules) : null;
  const mismatch = matches !== undefined && value !== '' && value !== matches;
  const validity = ruleError ?? (mismatch ? 'The passwords do not match.' : '');

  useEffect(() => {
    inputRef.current?.setCustomValidity(validity);
  }, [validity]);

  const strength = rules && value ? strengthStyles[getPasswordStrength(value, rules)] : null;

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
          className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gold"
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {rules && (
        <div id={hintId} className="mt-2 space-y-2">
          {strength && (
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 bg-sitebg border border-brownlight">
                <div className={`h-full ${strength.bar}`} />
              </div>
              <span className={`text-xs font-semibold ${strength.text}`}>{strength.label}</span>
            </div>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {getPasswordChecks(value, rules).map((check) => (
              <li key={check.label} className={`flex items-start gap-1.5 ${check.ok ? 'text-green-300' : 'text-gray-400'}`}>
                {check.ok
                  ? <Check className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
                  : <X className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />}
                <span>
                  {check.label}
                  <span className="sr-only">{check.ok ? ' (done)' : ' (missing)'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mismatch && (
        <p id={hintId} className="mt-1 text-sm text-red-300">The passwords do not match.</p>
      )}
    </div>
  );
}
