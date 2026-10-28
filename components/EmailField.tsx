'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { getEmailError } from '@/utils/auth';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder?: string;
  dark?: boolean;
}

// Email input with a format check (utils/auth.ts). The error shows under the field
// once the user leaves it, and the browser refuses to submit the form with the same message.
export default function EmailField({ value, onChange, className, placeholder = 'Email', dark }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  // Only complain after the user has left the field, not while they're still typing
  const [touched, setTouched] = useState(false);
  const error = getEmailError(value);

  // An empty field is already caught by `required`, so only a wrong format is set here
  useEffect(() => {
    inputRef.current?.setCustomValidity(value.trim() && error ? error : '');
  }, [value, error]);

  const showError = touched && !!error;

  return (
    <div>
      <input
        ref={inputRef}
        type="email"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
        className={`${className} ${showError ? 'border-red-500' : ''}`}
        autoComplete="email"
        required
      />
      {showError && (
        <p id={errorId} className={`mt-1 text-xs font-bold uppercase tracking-wider ${dark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
      )}
    </div>
  );
}
