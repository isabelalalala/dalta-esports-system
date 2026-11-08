import { describe, expect, it } from 'vitest';
import { can, isOrganizer, PERMISSIONS, toRole } from '@/utils/permissions';

describe('toRole', () => {
  it('keeps known roles', () => {
    expect(toRole('admin')).toBe('admin');
    expect(toRole('staff')).toBe('staff');
    expect(toRole('player')).toBe('player');
  });
  it('treats logged-out and unknown values as spectators', () => {
    expect(toRole(null)).toBe('spectator');
    expect(toRole(undefined)).toBe('spectator');
    expect(toRole('superuser')).toBe('spectator');
  });
});

describe('can', () => {
  it('gives logged-out visitors no actions', () => {
    expect(can(null, 'stream.watch')).toBe(false);
    expect(can(undefined, 'feedback.submit')).toBe(false);
  });

  it('keeps player-only actions away from spectators and organizers', () => {
    for (const action of ['tournament.register', 'team.create', 'team.join'] as const) {
      expect(can('player', action)).toBe(true);
      expect(can('spectator', action)).toBe(false);
      expect(can('staff', action)).toBe(false);
      expect(can('admin', action)).toBe(false);
    }
  });

  it('keeps organizer actions away from players and spectators', () => {
    for (const action of ['team.remove', 'match.manage', 'stream.configure', 'bracket.generate'] as const) {
      expect(can('admin', action)).toBe(true);
      expect(can('staff', action)).toBe(true);
      expect(can('player', action)).toBe(false);
      expect(can('spectator', action)).toBe(false);
    }
  });

  it('keeps admin-only actions away from staff', () => {
    for (const action of ['team.restore', 'tournament.delete', 'report.generate', 'user.manage', 'announcement.post'] as const) {
      expect(can('admin', action)).toBe(true);
      expect(can('staff', action)).toBe(false);
    }
  });

  it('lets organizers watch but not pick', () => {
    expect(can('staff', 'stream.watch')).toBe(true);
    expect(can('staff', 'prediction.pick')).toBe(false);
    expect(can('spectator', 'prediction.pick')).toBe(true);
  });

  it('lists every action at most once per role', () => {
    for (const actions of Object.values(PERMISSIONS)) {
      expect(new Set(actions).size).toBe(actions.length);
    }
  });
});

describe('moderation permissions', () => {
  it('lets every logged-in role comment, but not logged-out visitors', () => {
    for (const role of ['admin', 'staff', 'player', 'spectator']) expect(can(role, 'comment.post')).toBe(true);
    expect(can(null, 'comment.post')).toBe(false);
  });
  it('lets staff review the queue but only admins handle bans', () => {
    expect(can('staff', 'moderation.review')).toBe(true);
    expect(can('staff', 'moderation.ban')).toBe(false);
    expect(can('admin', 'moderation.ban')).toBe(true);
    expect(can('player', 'moderation.review')).toBe(false);
  });
});

describe('isOrganizer', () => {
  it('is true only for admin and staff', () => {
    expect(isOrganizer('admin')).toBe(true);
    expect(isOrganizer('staff')).toBe(true);
    expect(isOrganizer('player')).toBe(false);
    expect(isOrganizer(null)).toBe(false);
  });
});
