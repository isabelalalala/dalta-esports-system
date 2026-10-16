'use client';

import { useState } from 'react';
import { getErrorMessage } from '@/utils/errors';

interface Props {
  // 'registrations' | 'rosters' | 'matches' | 'feedback' | 'users'
  type: string;
  label: string;
  // Extra query parameters, e.g. { tournament: id }
  params?: Record<string, string | null | undefined>;
}

// "Export ⬇ Excel / CSV" buttons. The file is built on the server (app/api/exports/[type]),
// which checks the role and logs the export. Errors show here instead of downloading an error page.
export default function ExportButtons({ type, label, params = {} }: Props) {
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null);
  const [error, setError] = useState('');

  const download = async (format: 'xlsx' | 'csv') => {
    setBusy(format);
    setError('');
    try {
      const query = new URLSearchParams({ format });
      for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
      const response = await fetch(`/api/exports/${type}?${query}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'The export failed.');
      }

      // The server names the file (Content-Disposition)
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${type}.${format}`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'The export failed.'));
    } finally {
      setBusy(null);
    }
  };

  const buttonClass =
    'border border-gold text-gold px-3 py-1.5 text-sm font-bold hover:bg-gold/10 disabled:opacity-50';

  return (
    <div className="inline-flex flex-col gap-1 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">{label}:</span>
        <button onClick={() => download('xlsx')} disabled={busy !== null} className={buttonClass}>
          {busy === 'xlsx' ? 'Preparing...' : '⬇ Excel'}
        </button>
        <button onClick={() => download('csv')} disabled={busy !== null} className={buttonClass}>
          {busy === 'csv' ? 'Preparing...' : '⬇ CSV'}
        </button>
      </div>
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
