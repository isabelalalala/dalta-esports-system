'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { siteImageUrl } from '@/utils/site';
import { deleteSiteImage, uploadSiteImage } from '@/utils/site-images';
import { refreshSite } from './actions';
import ImageField from './ImageField';

// A row of any of the website tables (hero_images, campaigns, events, officers, ...)
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
  // Primary key column ('game_id' for game_divisions)
  idKey?: string;
  fields: FieldConfig[];
  titleOf: (row: Row) => string;
  subtitleOf?: (row: Row) => string;
  // Values for "+ Add" (must pass the table's checks); null = no Add button
  newRow?: Row | null;
  // Add by uploading a photo first (hero_images needs an image): the image field's name
  addWithImage?: string;
  canDelete?: boolean;
  hasPublish?: boolean;
  // Only rows where column = value (e.g. the players of one team)
  filter?: { column: string; value: string };
  imageFolder: string;
  // Runs before an edit is saved (e.g. "only one captain")
  beforeSave?: (row: Row) => Promise<void>;
  // Shown under a row while it is being edited (e.g. the team's players)
  renderExtra?: (row: Row) => ReactNode;
  viewHref?: (row: Row) => string | null;
}

const inputClass =
  'w-full border border-brownlight bg-sitebg px-3 py-2 text-white outline-none focus:border-gold';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

// Generic editor for one website list: add, edit, reorder (▲ ▼), publish/unpublish, delete,
// with image upload/replace. Every change refreshes the public pages (refreshSite()).
export default function ListEditor({
  table, idKey = 'id', fields, titleOf, subtitleOf, newRow = null, addWithImage, canDelete = true,
  hasPublish = true, filter, imageFolder, beforeSave, renderExtra, viewHref,
}: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Row>({});
  // Images uploaded during this edit; deleted again if the edit is cancelled
  const [uploads, setUploads] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Increase this to load the list again
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

  // Runs a change, then refreshes the public site and the list
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
      // Empty optional values are saved as null; text fields as trimmed text
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

      // Replaced or removed images aren't used anymore
      for (const name of imageFields) {
        if (original[name] && original[name] !== payload[name]) await deleteSiteImage(supabase, str(original[name]));
      }
      setEditingId(null);
      setUploads([]);
    }, 'Saved. The website is updated.', 'Failed to save');
  };

  const nextOrder = () => rows.reduce((max, r) => Math.max(max, Number(r.display_order) || 0), 0) + 1;

  const handleAdd = () => {
    if (!newRow) return;
    run(async () => {
      const row = { ...newRow, display_order: nextOrder(), ...(filter ? { [filter.column]: filter.value } : {}) };
      const { data, error: insertError } = await supabase.from(table).insert([row]).select('*').single();
      if (insertError) throw insertError;
      startEdit(data as Row);
    }, 'Added. Fill it in and save.', 'Failed to add');
  };

  const handleAddWithImage = (file: File | undefined) => {
    if (!file || !addWithImage) return;
    run(async () => {
      const path = await uploadSiteImage(supabase, file, imageFolder);
      const { error: insertError } = await supabase.from(table).insert([{ [addWithImage]: path, display_order: nextOrder() }]);
      if (insertError) {
        await deleteSiteImage(supabase, path);
        throw insertError;
      }
    }, 'Photo added.', 'Failed to add the photo');
  };

  const handleDelete = (row: Row) => {
    if (!confirm(`Delete "${titleOf(row)}"? This can't be undone.`)) return;
    run(async () => {
      const { data, error: deleteError } = await supabase.from(table).delete().eq(idKey, row[idKey] as string).select(idKey);
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error('Nothing was deleted.');
      for (const name of imageFields) await deleteSiteImage(supabase, str(row[name]));
    }, 'Deleted.', 'Failed to delete');
  };

  const togglePublish = (row: Row) => {
    run(async () => {
      const { error: updateError } = await supabase
        .from(table).update({ is_published: !row.is_published }).eq(idKey, row[idKey] as string);
      if (updateError) throw updateError;
    }, row.is_published ? 'Hidden from the website.' : 'Published on the website.', 'Failed to change');
  };

  // Moves a row up or down, then saves the order as 1, 2, 3, ... for every row that changed
  const move = (index: number, step: number) => {
    const target = index + step;
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
        <label key={f.name} className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="accent-gold" />
          {f.label}
        </label>
      );
    }
    return (
      <label key={f.name} className={`block text-sm font-semibold text-gray-300 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
        {f.label}{f.required && ' *'}
        {f.type === 'textarea' ? (
          <textarea value={str(value)} onChange={(e) => set(e.target.value)} rows={5} className={`${inputClass} mt-1 font-normal`} />
        ) : f.type === 'select' ? (
          <select value={str(value)} onChange={(e) => set(e.target.value)} className={`${inputClass} mt-1 font-normal`}>
            {!f.required && <option value="">None</option>}
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            type={f.type === 'date' ? 'date' : 'text'}
            value={f.type === 'date' ? str(value).slice(0, 10) : str(value)}
            onChange={(e) => set(e.target.value)}
            className={`${inputClass} mt-1 font-normal`}
          />
        )}
        {f.help && <span className="block text-xs text-gray-400 font-normal mt-1">{f.help}</span>}
      </label>
    );
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3">{error}</div>}
      {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3">{message}</div>}

      {newRow && (
        <button onClick={handleAdd} disabled={busy || !!editingId}
          className="bg-gold text-black px-4 py-2 font-bold hover:bg-golddark disabled:opacity-50">
          + Add
        </button>
      )}
      {addWithImage && (
        <label className={`inline-block cursor-pointer bg-gold text-black px-4 py-2 font-bold hover:bg-golddark ${busy ? 'opacity-50' : ''}`}>
          + Add photo
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={busy}
            onChange={(e) => { handleAddWithImage(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}

      {rows.length === 0 ? (
        <p className="text-gray-400 py-6 text-center">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const id = str(row[idKey]);
            const editing = editingId === id;
            const thumb = imageFields.length ? siteImageUrl(str(row[imageFields[0]]) || null) : null;
            const href = viewHref?.(row);
            return (
              <li key={id} className={`bg-sitecard border p-4 ${editing ? 'border-gold' : 'border-brown'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  {imageFields.length > 0 && (
                    <div className="relative w-16 h-12 bg-black border border-gray-700 overflow-hidden shrink-0">
                      {thumb && <Image src={thumb} alt="" fill unoptimized className="object-cover" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{titleOf(row) || <span className="italic text-gray-400">Untitled</span>}</p>
                    {subtitleOf && <p className="text-xs text-gray-400 truncate">{subtitleOf(row)}</p>}
                  </div>
                  {hasPublish && (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${row.is_published
                      ? 'border-green-500/60 text-green-300' : 'border-gray-500/60 text-gray-400'}`}>
                      {row.is_published ? 'Published' : 'Hidden'}
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-sm">
                    <button onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label="Move up"
                      className="px-2 py-1 border border-gray-600 disabled:opacity-30">▲</button>
                    <button onClick={() => move(index, 1)} disabled={busy || index === rows.length - 1} aria-label="Move down"
                      className="px-2 py-1 border border-gray-600 disabled:opacity-30">▼</button>
                  </div>
                  {!editing && (
                    <div className="flex flex-wrap gap-3 text-sm font-semibold">
                      <button onClick={() => startEdit(row)} disabled={busy || !!editingId} className="text-gold hover:underline disabled:opacity-40">Edit</button>
                      {hasPublish && (
                        <button onClick={() => togglePublish(row)} disabled={busy} className="text-yellow-300 hover:underline disabled:opacity-40">
                          {row.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      {href && row.is_published !== false && (
                        <Link href={href} target="_blank" className="text-gray-300 hover:underline">View ↗</Link>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(row)} disabled={busy} className="text-red-400 hover:underline disabled:opacity-40">Delete</button>
                      )}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="mt-4 space-y-4 border-t border-gray-700 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.map(renderField)}</div>
                    <div className="flex gap-3">
                      <button onClick={() => handleSave(row)} disabled={busy}
                        className="bg-gold text-black px-5 py-2 font-bold hover:bg-golddark disabled:opacity-50">
                        {busy ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} disabled={busy} className="text-gray-400 hover:text-white">Cancel</button>
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
