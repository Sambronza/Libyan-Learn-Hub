import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import paymentsRouter from './payments.js';

// Mock auth middleware
vi.mock('../lib/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 1, role: 'student' };
    next();
  }
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sum: vi.fn(),
  count: vi.fn(),
}));

// Mock database chain
const dbChain = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  then: vi.fn(),
};

vi.mock('@workspace/db', () => ({
  db: dbChain,
  paymentsTable: {},
  teacherEarningsTable: {},
  enrollmentsTable: {},
  coursesTable: {},
  liveSessionsTable: {},
  usersTable: {},
}));

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

describe('Payments API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /create-session creates a payment session for a paid course', async () => {
    // Mock course lookup
    dbChain.limit.mockResolvedValueOnce([{ price: "100.00", currency: "LYD" }]);
    
    // Mock existing enrollment (empty array means not enrolled)
    dbChain.limit.mockResolvedValueOnce([]);
    
    // Mock payment insert returning
    dbChain.returning.mockResolvedValueOnce([{ id: 999 }]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body.url).toContain('/api/payments/mock-gateway?paymentId=999');
  });

  it('POST /create-session auto-enrolls for a free course', async () => {
    // Mock course lookup (free)
    dbChain.limit.mockResolvedValueOnce([{ price: "0.00", currency: "LYD" }]);
    
    // Mock existing enrollment check
    dbChain.limit.mockResolvedValueOnce([]);
    
    // Mock insert enrollment (no returning needed as we don't read it)
    dbChain.values.mockResolvedValueOnce([{ id: 1 }]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 124 });

    expect(response.status).toBe(200);
    expect(response.body.url).toBe('/dashboard?success=true');
  });

  it('POST /create-session returns 400 if already enrolled', async () => {
    // Mock course lookup
    dbChain.limit.mockResolvedValueOnce([{ price: "100.00", currency: "LYD" }]);
    
    // Mock existing enrollment check (returns one record)
    dbChain.limit.mockResolvedValueOnce([{ id: 1, courseId: 123, userId: 1 }]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Already enrolled');
  });

  it('GET /mock-gateway returns the mock payment HTML page', async () => {
    const response = await request(app).get('/api/payments/mock-gateway?paymentId=999');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Secure Payment');
    expect(response.text).toContain('name="paymentId" value="999"');
  });
});
