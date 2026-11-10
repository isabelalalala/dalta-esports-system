import { describe, expect, it } from 'vitest';
import { activeItem, breadcrumbsFor, isInnerPage, isNavActive, navFor } from '@/utils/navigation';

const hrefs = (role: string | null, loggedIn = true) =>
  navFor(role, loggedIn).groups.flatMap((g) => g.items.map((i) => i.href));

describe('navFor', () => {
  it('gives spectators (and logged-out visitors) the audience menu only', () => {
    const items = hrefs('spectator');
    expect(items).toEqual(expect.arrayContaining(['/', '/events', '/tournaments', '/live', '/teams?tab=all', '/feedback']));
    expect(items).not.toContain('/admin/users');
    expect(items).not.toContain('/teams?tab=mine');
    expect(hrefs(null, false)).not.toContain('/dashboard');
    // No links that would bounce a visitor to the login page
    for (const href of ['/live', '/teams?tab=all', '/feedback']) expect(hrefs(null, false)).not.toContain(href);
    expect(navFor(null, false).bottom).toHaveLength(0);
  });

  it('adds player pages for players', () => {
    expect(hrefs('player')).toEqual(expect.arrayContaining(['/profile', '/teams?tab=mine', '/schedule', '/teams?tab=all&recruiting=1']));
  });

  it('gives staff the operations menu without admin pages or player actions', () => {
    const items = hrefs('staff');
    expect(items).toEqual(expect.arrayContaining(['/dashboard', '/matches', '/live', '/tournaments', '/admin/teams']));
    expect(items).not.toContain('/admin/users');
    expect(items).not.toContain('/teams?tab=all&recruiting=1');
  });

  it('gives admins the management menu', () => {
    expect(hrefs('admin')).toEqual(expect.arrayContaining(
      ['/dashboard', '/tournaments', '/admin/teams', '/admin/users', '/announcements', '/admin/feedback', '/analytics']));
  });

  it('starts the bottom bar with Dashboard (grid icon) for every logged-in role', () => {
    for (const role of ['admin', 'staff', 'player', 'spectator']) {
      const first = navFor(role, true).bottom[0];
      expect(first).toMatchObject({ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' });
      // The bar shows the page's own name, never another page's ("Home" for the dashboard)
      expect(first.short).toBeUndefined();
    }
  });

  it('keeps Home (house icon) reachable from every menu', () => {
    for (const role of ['admin', 'staff', 'player', 'spectator', null]) {
      const home = navFor(role, role !== null).groups.flatMap((g) => g.items).find((i) => i.href === '/');
      expect(home).toMatchObject({ label: 'Home', icon: 'home' });
    }
  });

  it('only shortens a label to a part of the same name', () => {
    for (const role of ['admin', 'staff', 'player', 'spectator']) {
      for (const item of navFor(role, true).groups.flatMap((g) => g.items)) {
        if (item.short) expect(item.label.toLowerCase()).toContain(item.short.toLowerCase());
      }
    }
  });

  it('keeps the phone bottom bar at 4 items', () => {
    for (const role of ['admin', 'staff', 'player', 'spectator']) {
      expect(navFor(role, true).bottom.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('isNavActive / activeItem', () => {
  const items = navFor('player', true).groups.flatMap((g) => g.items);
  const q = (s: string) => new URLSearchParams(s);

  it('matches by path prefix', () => {
    expect(activeItem('/tournaments/abc/edit', q(''), items)?.label).toBe('Tournaments');
    expect(activeItem('/', q(''), items)?.label).toBe('Home');
    expect(activeItem('/events', q(''), items)?.label).toBe('Events');
  });

  it('tells My Teams, Teams and Recruiting apart by query', () => {
    expect(activeItem('/teams', q(''), items)?.label).toBe('My Teams');
    expect(activeItem('/teams', q('tab=all'), items)?.label).toBe('Teams');
    expect(activeItem('/teams', q('tab=all&recruiting=1'), items)?.label).toBe('Recruiting');
  });

  it('highlights Dashboard on admin pages for admins', () => {
    const admin = navFor('admin', true).groups.flatMap((g) => g.items);
    expect(isNavActive('/admin/website/x', q(''), admin[0])).toBe(true);
    expect(activeItem('/admin/users', q(''), admin)?.label).toBe('Users');
  });
});

describe('breadcrumbsFor', () => {
  it('builds labelled crumbs, skipping /admin', () => {
    expect(breadcrumbsFor('/tournaments/abc/edit')).toEqual([
      { href: '/', label: 'Home' },
      { href: '/tournaments', label: 'Tournaments' },
      { href: '/tournaments/abc', label: 'Tournament' },
      { href: '/tournaments/abc/edit', label: 'Edit' },
    ]);
    expect(breadcrumbsFor('/admin/users').map((c) => c.label)).toEqual(['Home', 'Users']);
  });

  it('starts at Dashboard for logged-in users and uses menu names for menu pages', () => {
    expect(breadcrumbsFor('/teams/xyz', {}, true)).toEqual([
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/teams', label: 'Teams' },
      { href: '/teams/xyz', label: 'Team' },
    ]);
    expect(breadcrumbsFor('/admin/feedback', {}, true).map((c) => c.label)).toEqual(['Dashboard', 'Feedback & Sentiment']);
    expect(breadcrumbsFor('/analytics/engagement', {}, true).map((c) => c.label)).toEqual(['Dashboard', 'Reports', 'Engagement Stats']);
    // A tournament's own matches page is not Match Control
    expect(breadcrumbsFor('/tournaments/a/matches', {}, true).at(-1)?.label).toBe('Matches');
    expect(breadcrumbsFor('/matches/m1', {}, true)[1]).toEqual({ href: '/matches', label: 'Match Control' });
  });

  it('uses names a page supplies', () => {
    expect(breadcrumbsFor('/teams/xyz', { '/teams/xyz': 'Fuego Alta' }).at(-1)?.label).toBe('Fuego Alta');
  });

  it('skips /t and marks crumbs without a page of their own', () => {
    expect(breadcrumbsFor('/t/abc')).toEqual([{ href: '/', label: 'Home' }, { href: '/t/abc', label: 'Tournament' }]);
    expect(breadcrumbsFor('/t/abc/match/xyz')).toEqual([
      { href: '/', label: 'Home' },
      { href: '/t/abc', label: 'Tournament' },
      { href: null, label: 'Match' },
      { href: '/t/abc/match/xyz', label: 'Match' },
    ]);
    expect(breadcrumbsFor('/analytics/reports/r1')[2]).toEqual({ href: null, label: 'Saved report' });
  });
});

describe('isInnerPage', () => {
  it('is true from two levels deep', () => {
    expect(isInnerPage('/teams')).toBe(false);
    expect(isInnerPage('/teams/abc')).toBe(true);
  });
});
