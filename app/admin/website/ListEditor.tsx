'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { siteImageUrl } from '@/utils/site';
import { deleteSiteImage, uploadSiteImage } from '@/utils/site-images';
import { refreshSite } from './actions';
import ImageField from './ImageField';

export type Row = Record<string, unknown>;

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'link' | 'image' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
}

interface Props {
  table: string;
  idKey?: string;
  fields: FieldConfig[];
  titleOf: (row: Row) => string;
  subtitleOf?: (row: Row) => string;
  newRow?: Row | null;
  addWithImage?: string;
  canDelete?: boolean;
  hasPublish?: boolean;
  filter?: { column: string; value: string };
  imageFolder: string;
  beforeSave?: (row: Row) => Promise<void>;
  renderExtra?: (row: Row) => ReactNode;
  viewHref?: (row: Row) => string | null;
}

const inputClass =
  'w-full p-3 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 tracking-wide focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default function ListEditor({
  table, idKey = 'id', fields, titleOf, subtitleOf, newRow = null, addWithImage, canDelete = true,
  hasPublish = true, filter, imageFolder, beforeSave, renderExtra, viewHref,
}: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [uploads, setUploads] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const imageFields = fields.filter((f) => f.type === 'image').map((f) => f.name);
  const filterColumn = filter?.column;
  const filterValue = filter?.value;

  useEffect(() => {
    const load = async () => {
      let query = supabase.from(table).select('*').order('display_order');
      if (filterColumn) query = query.eq(filterColumn, filterValue);
      const { data, error: loadError } = await query;
      if (loadError) setError(getErrorMessage(loadError, 'Failed to load'));
      else setRows((data || []) as Row[]);
    };
    load();
  }, [supabase, table, filterColumn, filterValue, reloadCount]);

  const run = async (action: () => Promise<void>, done: string, fallback: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refreshSite();
      setMessage(done);
      setReloadCount((n) => n + 1);
    } catch (err) {
      setError(getErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (row: Row) => {
    setEditingId(str(row[idKey]));
    setDraft({ ...row });
    setUploads([]);
    setMessage('');
    setError('');
  };

  const cancelEdit = async () => {
    for (const path of uploads) await deleteSiteImage(supabase, path);
    setEditingId(null);
    setUploads([]);
  };

  const handleSave = (original: Row) => {
    for (const f of fields) {
      if (f.required && f.type !== 'checkbox' && !str(draft[f.name]).trim()) {
        return setError(`${f.label} is required.`);
      }
      const link = str(draft[f.name]).trim();
      if (f.type === 'link' && link && !link.startsWith('/') && !link.startsWith('https://')) {
        return setError(`${f.label} must start with / (a page on this site) or https://`);
      }
    }

    run(async () => {
      const payload: Row = {};
      for (const f of fields) {
        const value = draft[f.name];
        if (f.type === 'checkbox') payload[f.name] = !!value;
        else if (f.type === 'text' || f.type === 'textarea') payload[f.name] = str(value).trim();
        else payload[f.name] = str(value).trim() || null;
      }
      if (beforeSave) await beforeSave({ ...original, ...payload });

      const { data, error: saveError } = await supabase
        .from(table).update(payload).eq(idKey, original[idKey] as string).select(idKey);
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error('Nothing was saved. Are you still logged in as an admin?');

      for (const name of imageFields) {
        if (original[name] && original[name] !== payload[name]) await deleteSiteImage(supabase, str(original[name]));
      }
      setEditingId(null);
      setUploads([]);
    }, 'Changes saved.', 'Failed to save');
  };

  const handleAdd = () => {
    if (!newRow) return;
    run(async () => {
      const { error: insertError } = await supabase.from(table).insert([{ ...newRow, display_order: rows.length + 1 }]);
      if (insertError) throw insertError;
    }, 'Item added.', 'Failed to add item');
  };

  const handleAddWithImage = async (file: File | undefined) => {
    if (!file || !addWithImage) return;
    run(async () => {
      const path = await uploadSiteImage(supabase, file, imageFolder);
      const { error: insertError } = await supabase
        .from(table)
        .insert([{ [addWithImage]: path, display_order: rows.length + 1 }]);
      if (insertError) {
        await deleteSiteImage(supabase, path);
        throw insertError;
      }
    }, 'Item added.', 'Failed to upload and add item');
  };

  const handleDelete = (row: Row) => {
    if (!confirm(`Delete "${titleOf(row)}"? This action cannot be undone.`)) return;
    run(async () => {
      const { error: deleteError } = await supabase.from(table).delete().eq(idKey, row[idKey] as string);
      if (deleteError) throw deleteError;
      for (const name of imageFields) {
        if (row[name]) await deleteSiteImage(supabase, str(row[name]));
      }
    }, 'Item deleted.', 'Failed to delete item');
  };

  const togglePublish = (row: Row) => {
    const next = !row.is_published;
    run(async () => {
      const { error: updateError } = await supabase
        .from(table).update({ is_published: next }).eq(idKey, row[idKey] as string);
      if (updateError) throw updateError;
    }, next ? 'Published.' : 'Hidden.', 'Failed to update visibility');
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const ordered = [...rows];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    run(async () => {
      for (let i = 0; i < ordered.length; i++) {
        if (Number(ordered[i].display_order) !== i + 1) {
          const { error: orderError } = await supabase
            .from(table).update({ display_order: i + 1 }).eq(idKey, ordered[i][idKey] as string);
          if (orderError) throw orderError;
        }
      }
    }, 'Order saved.', 'Failed to reorder');
  };

  const renderField = (f: FieldConfig) => {
    const value = draft[f.name];
    const set = (v: unknown) => setDraft((d) => ({ ...d, [f.name]: v }));

    if (f.type === 'image') {
      return (
        <ImageField
          key={f.name}
          label={f.label}
          value={(value as string) || null}
          folder={imageFolder}
          required={f.required}
          onChange={(path) => {
            if (path) setUploads((u) => [...u, path]);
            set(path);
          }}
        />
      );
    }
    if (f.type === 'checkbox') {
      return (
        <label key={f.name} className="flex items-center gap-2.5 text-xs font-black text-stone-800 tracking-wider uppercase cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => set(e.target.checked)}
            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500/20 border-stone-300"
          />
          {f.label}
        </label>
      );
    }
    return (
      <label key={f.name} className={`block text-xs font-black text-stone-800 tracking-wider uppercase ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
        <span className="block mb-1.5">{f.label}{f.required && ' *'}</span>
        {f.type === 'textarea' ? (
          <textarea
            value={str(value)}
            onChange={(e) => set(e.target.value)}
            rows={4}
            className={`${inputClass} font-normal`}
          />
        ) : f.type === 'select' ? (
          <select
            value={str(value)}
            onChange={(e) => set(e.target.value)}
            className={`${inputClass} font-normal`}
          >
            {!f.required && <option value="">None</option>}
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={f.type === 'date' ? 'date' : 'text'}
            value={f.type === 'date' ? str(value).slice(0, 10) : str(value)}
            onChange={(e) => set(e.target.value)}
            className={`${inputClass} font-normal`}
          />
        )}
        {f.help && <span className="block text-[11px] text-stone-500 font-medium normal-case mt-1">{f.help}</span>}
      </label>
    );
  };

  return (
    <div className="space-y-6 text-stone-950">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-bold tracking-wider shadow-2xs">
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {newRow && (
          <button
            onClick={handleAdd}
            disabled={busy || !!editingId}
            className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 border border-amber-400 transition-all disabled:opacity-50 cursor-pointer"
          >
            + Add New
          </button>
        )}
        {addWithImage && (
          <label className={`inline-block cursor-pointer rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 border border-amber-400 transition-all ${busy ? 'opacity-50' : ''}`}>
            + Upload Photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={busy}
              onChange={(e) => { handleAddWithImage(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-stone-500 py-12 text-center font-bold tracking-wider">Nothing here yet.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => {
            const id = str(row[idKey]);
            const editing = editingId === id;
            const thumb = imageFields.length ? siteImageUrl(str(row[imageFields[0]]) || null) : null;
            const href = viewHref?.(row);
            return (
              <li
                key={id}
                className={`bg-white border rounded-2xl p-5 shadow-xs transition-all ${
                  editing ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-stone-200/90 hover:border-stone-300'
                }`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {imageFields.length > 0 && (
                    <div className="relative w-16 h-12 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden shrink-0 shadow-2xs">
                      {thumb ? (
                        <Image src={thumb} alt="" fill sizes="96px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] text-stone-400 font-bold uppercase">No img</div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-stone-950 text-sm tracking-wide truncate">
                      {titleOf(row) || <span className="italic text-stone-400">Untitled</span>}
                    </p>
                    {subtitleOf && (
                      <p className="text-xs text-stone-500 font-medium tracking-wide truncate mt-0.5 normal-case">
                        {subtitleOf(row)}
                      </p>
                    )}
                  </div>

                  {hasPublish && (
                    <span
                      className={`text-[11px] font-black uppercase px-3 py-1 rounded-full border ${
                        row.is_published
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 bg-stone-100 text-stone-600'
                      }`}
                    >
                      {row.is_published ? 'Published' : 'Hidden'}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label="Move up"
                      className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-stone-950 hover:bg-stone-100 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={busy || index === rows.length - 1}
                      aria-label="Move down"
                      className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-stone-950 hover:bg-stone-100 disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {!editing && (
                    <div className="flex flex-wrap items-center gap-3 text-xs font-black tracking-wider">
                      <button
                        onClick={() => startEdit(row)}
                        disabled={busy || !!editingId}
                        className="text-amber-700 hover:text-amber-800 underline disabled:opacity-40 cursor-pointer"
                      >
                        Edit
                      </button>
                      {hasPublish && (
                        <button
                          onClick={() => togglePublish(row)}
                          disabled={busy}
                          className="text-stone-700 hover:text-stone-950 underline disabled:opacity-40 cursor-pointer"
                        >
                          {row.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      {href && row.is_published !== false && (
                        <Link href={href} target="_blank" className="text-stone-600 hover:text-stone-950 underline">
                          View ↗
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={busy}
                          className="text-red-600 hover:text-red-700 underline disabled:opacity-40 cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mt-5 space-y-4 border-t border-stone-100 pt-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.map(renderField)}</div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleSave(row)}
                        disabled={busy}
                        className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-2.5 text-xs tracking-widest border border-amber-400 shadow-xs hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {busy ? 'Saving...' : 'Save Item'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={busy}
                        className="rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-bold px-5 py-2.5 text-xs tracking-wider transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    {renderExtra?.(row)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
