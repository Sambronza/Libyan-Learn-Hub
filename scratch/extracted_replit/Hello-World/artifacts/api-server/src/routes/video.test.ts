import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import videoRouter from './video.js';

// Mock auth middleware
vi.mock('../lib/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 1, role: 'student' };
    next();
  }
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// Mock db
const dbChain = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
};

vi.mock('@workspace/db', () => ({
  db: dbChain,
  lessonsTable: {},
  enrollmentsTable: {},
  coursesTable: {},
}));

const app = express();
app.use(express.json());
app.use('/api/video', videoRouter);

describe('Video API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_jwt_key_for_dev_only";

  describe('POST /generate-token', () => {
    it('Generates a playback token for a free lesson without enrollment', async () => {
      // Mock lesson lookup (free)
      dbChain.limit.mockResolvedValueOnce([{ id: 10, isFree: true }]);
      
      const response = await request(app)
        .post('/api/video/generate-token')
        .send({ lessonId: 10, courseId: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.url).toContain('/api/video/secure-stream/10?token=');
      
      const decoded: any = jwt.verify(response.body.token, JWT_SECRET);
      expect(decoded.lessonId).toBe(10);
      expect(decoded.action).toBe('playback');
      expect(decoded.userId).toBe(1);
    });

    it('Fails to generate token for paid lesson if not enrolled', async () => {
      // Mock lesson lookup (paid)
      dbChain.limit.mockResolvedValueOnce([{ id: 10, isFree: false }]);
      // Mock enrollment check (not enrolled)
      dbChain.limit.mockResolvedValueOnce([]);
      // Mock course check (not the teacher either)
      dbChain.limit.mockResolvedValueOnce([{ teacherId: 99 }]);
      
      const response = await request(app)
        .post('/api/video/generate-token')
        .send({ lessonId: 10, courseId: 100 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Not enrolled in this course');
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
      const token = jwt.sign({ userId: 1, lessonId: 11, action: "playback" }, JWT_SECRET);
      const response = await request(app).get('/api/video/secure-stream/10?token=' + token);
      
      expect(response.status).toBe(403);
      expect(response.text).toBe('Token mismatch or invalid action');
    });
    
    // Note: A full stream proxy test would require mocking `https.get` and streams. 
    // We cover the basic authentication and structural flow here.
  });
});
