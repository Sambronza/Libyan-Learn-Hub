import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock auth middleware
vi.mock('../lib/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 1, role: 'student' };
    next();
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// Controllable enrollment-access result (vi.hoisted so mock factory can use it)
const accessState = vi.hoisted(() => ({
  result: { ok: true, enrollment: null } as any,
}));

vi.mock('../lib/subscriptions.js', () => ({
  requireActiveEnrollment: vi.fn(async () => accessState.result),
  SUBSCRIPTION_EXPIRED_ERROR: {
    code: 'SUBSCRIPTION_EXPIRED',
    error: 'Subscription expired',
    message: 'Your subscription to this course has expired. Renew to regain access.',
    messageAr: 'انتهى اشتراكك في هذه الدورة. جدّد الاشتراك لاستعادة الوصول.',
  },
  NOT_ENROLLED_ERROR: {
    code: 'NOT_ENROLLED',
    error: 'Not enrolled',
    message: 'You are not enrolled in this course.',
    messageAr: 'أنت غير مسجّل في هذه الدورة.',
  },
}));

// Mock db (vi.hoisted to survive vi.mock hoisting)
const dbChain = vi.hoisted(() => {
  const chain: any = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
  };
  for (const key of ['select', 'from', 'where', 'insert']) chain[key].mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
});

vi.mock('@workspace/db', () => ({
  db: dbChain,
  lessonsTable: {},
  enrollmentsTable: {},
  coursesTable: {},
}));

const { default: videoRouter } = await import('./video.js');

const app = express();
app.use(express.json());
app.use('/api/video', videoRouter);

const PLAYBACK_SECRET = process.env.JWT_SECRET || 'default_super_secret_jwt_key_for_dev_only';
const AUTH_SECRET = process.env.JWT_SECRET || 'lms-libya-secret-2024-dev';

function authHeader(payload = { userId: 1, role: 'student' }) {
  return `Bearer ${jwt.sign(payload, AUTH_SECRET)}`;
}

describe('Video API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ['select', 'from', 'where', 'insert']) (dbChain as any)[key].mockReturnValue(dbChain);
    dbChain.limit.mockReturnValue(dbChain);
    accessState.result = { ok: true, enrollment: null };
  });

  describe('POST /generate-token', () => {
    it('Generates a playback token for a free lesson without enrollment', async () => {
      dbChain.limit.mockResolvedValueOnce([{ id: 10, isFree: true }]);

      const response = await request(app)
        .post('/api/video/generate-token')
        .send({ lessonId: 10, courseId: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.url).toContain('/api/video/secure-stream/10?token=');

      const decoded: any = jwt.verify(response.body.token, PLAYBACK_SECRET);
      expect(decoded.lessonId).toBe(10);
      expect(decoded.action).toBe('playback');
    });

    it('Fails for a paid lesson when not enrolled', async () => {
      dbChain.limit.mockResolvedValueOnce([{ id: 10, isFree: false }]);
      accessState.result = { ok: false, reason: 'not_enrolled' };

      const response = await request(app)
        .post('/api/video/generate-token')
        .set('Authorization', authHeader())
        .send({ lessonId: 10, courseId: 100 });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('NOT_ENROLLED');
    });

    it('Fails for a paid lesson when the subscription is expired', async () => {
      dbChain.limit.mockResolvedValueOnce([{ id: 10, isFree: false }]);
      accessState.result = { ok: false, reason: 'expired', expiredAt: new Date('2026-01-01') };

      const response = await request(app)
        .post('/api/video/generate-token')
        .set('Authorization', authHeader())
        .send({ lessonId: 10, courseId: 100 });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('SUBSCRIPTION_EXPIRED');
      expect(response.body.messageAr).toBeTruthy();
    });

    it('Succeeds for a paid lesson with an active subscription', async () => {
      dbChain.limit.mockResolvedValueOnce([{ id: 10, isFree: false, videoFilePath: null }]);
      accessState.result = { ok: true, enrollment: { id: 5, expiresAt: new Date(Date.now() + 86400000) } };

      const response = await request(app)
        .post('/api/video/generate-token')
        .set('Authorization', authHeader())
        .send({ lessonId: 10, courseId: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
  });

  describe('GET /secure-stream/:lessonId', () => {
    it('Requires a playback token', async () => {
      const response = await request(app).get('/api/video/secure-stream/10');
      expect(response.status).toBe(401);
      expect(response.text).toBe('No playback token provided');
    });

    it('Rejects invalid token', async () => {
      const response = await request(app).get('/api/video/secure-stream/10?token=invalid.jwt.token');
      expect(response.status).toBe(401);
      expect(response.text).toBe('Invalid or expired playback token');
    });

    it('Rejects valid token for wrong lessonId', async () => {
      const token = jwt.sign({ userId: 1, lessonId: 11, action: 'playback' }, PLAYBACK_SECRET);
      const response = await request(app).get('/api/video/secure-stream/10?token=' + token);

      expect(response.status).toBe(403);
      expect(response.text).toBe('Token mismatch or invalid action');
    });
  });
});
