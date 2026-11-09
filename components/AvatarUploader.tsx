'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import { refreshViewer } from '@/utils/use-viewer';
import {
  AVATAR_INPUT_TYPES, AVATAR_MAX_BYTES, AVATAR_OUTPUT_PX, AVATARS_BUCKET, TEAM_LOGOS_BUCKET, avatarPath, avatarPathFromUrl,
  cropSquare, validateAvatarFile,
} from '@/utils/avatars';
import Avatar from '@/components/Avatar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/Toaster';

interface Props {
  // The user (profile picture) or the team (team logo): row id and storage folder
  userId: string;
  name: string | null;
  url: string | null;
  // Called with the new address (or null after removing)
  onChange: (url: string | null) => void;
  // 'team-logo': saves teams.logo_url in the team-logos bucket (captain only: RLS + storage policies)
  kind?: 'avatar' | 'team-logo';
  // Shown instead of the round avatar (the team logo box)
  preview?: ReactNode;
}

// What differs between a profile picture and a team logo
const KINDS = {
  avatar: {
    bucket: AVATARS_BUCKET, noun: 'picture',
    savedText: 'Profile picture saved.', removedText: 'Profile picture removed.',
    help: 'JPG, PNG or WebP. Shown on rosters, comments and feedback.',
    removeText: 'Your initials are shown instead. You can add a new picture any time.',
    guide: 'rounded-full', guideText: 'The circle shows what others will see.',
  },
  'team-logo': {
    bucket: TEAM_LOGOS_BUCKET, noun: 'logo',
    savedText: 'Team logo saved.', removedText: 'Team logo removed.',
    help: 'JPG, PNG or WebP, square. Shown on team cards and the team page.',
    removeText: 'The team initials are shown instead. You can add a new logo any time.',
    guide: 'rounded-2xl', guideText: 'The square shows what others will see.',
  },
} as const;

const VIEW = 256; // size of the crop window in CSS pixels

// Inline styles: the crop window's size and the picture's position are computed while dragging,
// so they can't be Tailwind classes (the other exception besides utils/og-card.tsx).

// "Change picture" on /profile: pick a JPG/PNG/WebP, crop it to a square (drag to move, slider or
// +/- to zoom, arrow keys to move), and it is saved as a 512x512 picture in the avatars bucket.
// Also used for team logos on the team page (kind="team-logo").
export default function AvatarUploader({ userId, name, url, onChange, kind = 'avatar', preview }: Props) {
  const supabase = createClient();
  const cfg = KINDS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Free the temporary image address when the cropper closes
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const pick = (file: File | undefined) => {
    setError('');
    if (!file) return;
    const problem = validateAvatarFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    const address = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setObjectUrl(address);
      setImage(img);
      setZoom(1);
      setCenter({ x: 0.5, y: 0.5 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(address);
      setError('That file could not be opened as a picture.');
    };
    img.src = address;
  };

  const closeCropper = () => {
    setImage(null);
    setObjectUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Where the picture sits in the crop window for the current zoom and centre
  const crop = image ? cropSquare(image.naturalWidth, image.naturalHeight, zoom, center.x, center.y) : null;
  const scale = crop ? VIEW / crop.size : 1;

  const moveBy = (dxPx: number, dyPx: number) => {
    if (!image) return;
    setCenter((c) => {
      // Recompute from the clamped crop, so dragging past an edge doesn't "store up" movement
      const now = cropSquare(image.naturalWidth, image.naturalHeight, zoom, c.x, c.y);
      const s = VIEW / now.size;
      return {
        x: (now.sx + now.size / 2 - dxPx / s) / image.naturalWidth,
        y: (now.sy + now.size / 2 - dyPx / s) / image.naturalHeight,
      };
    });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    moveBy(e.clientX - drag.current.x, e.clientY - drag.current.y);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 10;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => moveBy(step, 0), ArrowRight: () => moveBy(-step, 0),
      ArrowUp: () => moveBy(0, step), ArrowDown: () => moveBy(0, -step),
      '+': () => setZoom((z) => Math.min(z + 0.1, 3)), '=': () => setZoom((z) => Math.min(z + 0.1, 3)),
      '-': () => setZoom((z) => Math.max(z - 0.1, 1)),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  // Writes the address on the user's profile or the team (RLS: own profile / captain of the team)
  const saveUrl = (value: string | null) =>
    kind === 'avatar'
      ? supabase.from('profiles').update({ avatar_url: value }).eq('id', userId).select('id')
      : supabase.from('teams').update({ logo_url: value }).eq('id', userId).select('id');

  const save = async () => {
    if (!image || !crop) return;
    setBusy(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_OUTPUT_PX;
      canvas.height = AVATAR_OUTPUT_PX;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser could not prepare the picture.');
      ctx.drawImage(image, crop.sx, crop.sy, crop.size, crop.size, 0, 0, AVATAR_OUTPUT_PX, AVATAR_OUTPUT_PX);
      // WebP where the browser can make it; older Safari silently gives PNG instead
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      if (!blob) throw new Error('Your browser could not prepare the picture.');
      if (blob.size > AVATAR_MAX_BYTES) throw new Error('The picture is still over 2 MB. Try zooming in or another picture.');
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
      const path = avatarPath(userId, ext);

      const { error: uploadError } = await supabase.storage
        .from(cfg.bucket)
        .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
      const { data, error: saveError } = await saveUrl(publicUrl);
      if (saveError || !data?.length) {
        // Don't leave an unused file behind
        await supabase.storage.from(cfg.bucket).remove([path]);
        throw saveError ?? new Error(`The ${cfg.noun} could not be saved.`);
      }

      // The old file isn't needed any more (a failure here only leaves an unused file)
      const oldPath = avatarPathFromUrl(url, cfg.bucket);
      if (oldPath) await supabase.storage.from(cfg.bucket).remove([oldPath]);

      onChange(publicUrl);
      if (kind === 'avatar') await refreshViewer();
      closeCropper();
      toast.success(cfg.savedText);
    } catch (err) {
      setError(getErrorMessage(err, `The ${cfg.noun} could not be saved.`));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: saveError } = await saveUrl(null);
      if (saveError || !data?.length) throw saveError ?? new Error(`The ${cfg.noun} could not be removed.`);
      const oldPath = avatarPathFromUrl(url, cfg.bucket);
      if (oldPath) await supabase.storage.from(cfg.bucket).remove([oldPath]);
      onChange(null);
      if (kind === 'avatar') await refreshViewer();
      setConfirmRemove(false);
      toast.success(cfg.removedText);
    } catch (err) {
      setError(getErrorMessage(err, `The ${cfg.noun} could not be removed.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      {preview ?? <Avatar url={url} name={name} size="xl" />}
      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold hover:bg-golddark text-stone-950 text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            <Camera className="h-4 w-4" /> {url ? `Change ${cfg.noun}` : `Add ${cfg.noun}`}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-300 bg-white text-stone-700 hover:text-red-700 text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
        <p className="text-sm text-stone-600">{cfg.help}</p>
        {error && !image && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_INPUT_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {image && objectUrl && crop && (
        <ConfirmDialog
          title={`Crop your ${cfg.noun}`}
          confirmLabel={`Save ${cfg.noun}`}
          busy={busy}
          busyLabel="Uploading..."
          error={error}
          onConfirm={save}
          onClose={closeCropper}
        >
          <p>Drag to move the picture and use the slider to zoom. {cfg.guideText}</p>
          <div
            role="application"
            aria-label="Crop area. Arrow keys move the picture, plus and minus zoom."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onKeyDown={onKeyDown}
            className="relative mx-auto overflow-hidden rounded-2xl bg-stone-900 touch-none cursor-grab active:cursor-grabbing select-none"
            style={{ width: VIEW, height: VIEW }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, not a page image */}
            <img
              src={objectUrl}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: image.naturalWidth * scale,
                height: image.naturalHeight * scale,
                left: -crop.sx * scale,
                top: -crop.sy * scale,
              }}
            />
            {/* Circle (or square) guide: everything outside it is dimmed */}
            <div className={`pointer-events-none absolute inset-0 ${cfg.guide} shadow-[0_0_0_999px_rgba(0,0,0,0.45)] ring-2 ring-white/80`} />
          </div>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-stone-700">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-maroon"
            />
          </label>
        </ConfirmDialog>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title={`Remove the ${cfg.noun}?`}
          confirmLabel={`Remove ${cfg.noun}`}
          tone="danger"
          busy={busy}
          busyLabel="Removing..."
          error={error}
          onConfirm={remove}
          onClose={() => setConfirmRemove(false)}
        >
          <p>{cfg.removeText}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
