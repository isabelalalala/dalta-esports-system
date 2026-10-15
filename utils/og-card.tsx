// Link preview images (Open Graph, 1200x630) for Facebook/Messenger, used by the
// opengraph-image.tsx files under app/(site)/t. Server only.
// next/og draws plain HTML with inline styles (it doesn't support Tailwind classes), and every
// element with more than one child needs display: 'flex'.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const OG_SIZE = { width: 1200, height: 630 };

const GOLD = '#fccb35';
const BROWN = '#5c241c';
const BG = '#120d0b';
const CARD = '#1f1714';

// The logo from public/, as a data URL the image renderer can draw
async function logoDataUrl() {
  const file = await readFile(join(process.cwd(), 'public', 'daltaesportslogo.jpg'));
  return `data:image/jpeg;base64,${file.toString('base64')}`;
}

export async function ogCard({ eyebrow, title, subtitle, footer }: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  footer?: string;
}) {
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: BG, padding: 40 }}>
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: CARD, border: `6px solid ${GOLD}`, boxShadow: `16px 16px 0 ${BROWN}`, padding: 48,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og needs a plain img */}
            <img src={logo} width={110} height={110} alt="" style={{ border: `4px solid ${GOLD}` }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: GOLD, fontSize: 34, fontWeight: 700, letterSpacing: 6 }}>DALTA ESPORTS</div>
              <div style={{ color: '#9ca3af', fontSize: 26 }}>{eyebrow}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ color: 'white', fontSize: title.length > 40 ? 58 : 72, fontWeight: 700, lineHeight: 1.1 }}>
              {title}
            </div>
            {subtitle && <div style={{ color: GOLD, fontSize: 36 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', color: '#9ca3af', fontSize: 26 }}>{footer ?? 'Game With Purpose'}</div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
