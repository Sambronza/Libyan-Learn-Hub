import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware
vi.mock('../lib/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 1, role: 'student' };
    next();
  },
  invalidateDeviceCheckCache: vi.fn(),
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  sum: vi.fn(),
  count: vi.fn(),
  desc: vi.fn(),
}));

// Mock database chain (vi.hoisted so the vi.mock factory can reference it)
const dbChain = vi.hoisted(() => {
  const chain: any = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  // Chainable by default
  for (const key of ['select', 'from', 'where', 'insert', 'values', 'update', 'set', 'delete']) {
    chain[key].mockReturnValue(chain);
  }
  chain.limit.mockReturnValue(chain);
  chain.returning.mockReturnValue(chain);
  return chain;
});

vi.mock('@workspace/db', () => ({
  db: dbChain,
  paymentsTable: {},
  teacherEarningsTable: {},
  enrollmentsTable: {},
  coursesTable: {},
  liveSessionsTable: {},
  usersTable: {},
  platformSettingsTable: {},
  redeemCardsTable: {},
  withdrawalRequestsTable: {},
  tutoringRequestsTable: {},
  walletTransactionsTable: {},
  liveSessionCoursesTable: {},
  sessionRegistrationsTable: {},
}));

const { default: paymentsRouter } = await import('./payments.js');

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

const paidCourse = {
  id: 123,
  price: '100.00',
  priceMonth1: '100.00',
  priceMonth3: '270.00',
  priceMonth6: '500.00',
  priceMonth12: '900.00',
  currency: 'LYD',
  teacherId: 7,
};

function resetChain() {
  vi.clearAllMocks();
  for (const key of ['select', 'from', 'where', 'insert', 'values', 'update', 'set', 'delete']) {
    (dbChain as any)[key].mockReturnValue(dbChain);
  }
  dbChain.limit.mockReturnValue(dbChain);
  dbChain.returning.mockReturnValue(dbChain);
}

describe('Payments API Route (subscriptions)', () => {
  beforeEach(resetChain);

  it('POST /create-session creates a pending payment for a paid course with a valid duration', async () => {
    dbChain.limit.mockResolvedValueOnce([paidCourse]); // course lookup
    dbChain.limit.mockResolvedValueOnce([]); // not enrolled
    dbChain.returning.mockResolvedValueOnce([{ id: 999 }]); // payment insert

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123, durationMonths: 3 });

    expect(response.status).toBe(200);
    expect(response.body.url).toContain('/api/payments/mock-gateway?paymentId=999');
    // Payment row records the chosen duration and the 3-month price
    const inserted = dbChain.values.mock.calls[0][0];
    expect(inserted.durationMonths).toBe(3);
    expect(inserted.amount).toBe('270.00');
  });

  it('POST /create-session rejects a paid course without durationMonths', async () => {
    dbChain.limit.mockResolvedValueOnce([paidCourse]);
    dbChain.limit.mockResolvedValueOnce([]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid subscription duration');
  });

  it('POST /create-session rejects an invalid duration', async () => {
    dbChain.limit.mockResolvedValueOnce([paidCourse]);
    dbChain.limit.mockResolvedValueOnce([]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123, durationMonths: 2 });

    expect(response.status).toBe(400);
  });

  it('POST /create-session rejects a duration whose price is not set', async () => {
    dbChain.limit.mockResolvedValueOnce([{ ...paidCourse, priceMonth6: null }]);
    dbChain.limit.mockResolvedValueOnce([]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123, durationMonths: 6 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Plan not available');
  });

  it('POST /create-session auto-enrolls for a free course', async () => {
    dbChain.limit.mockResolvedValueOnce([{ id: 124, price: '0.00', currency: 'LYD' }]);
    dbChain.limit.mockResolvedValueOnce([]);
    dbChain.values.mockResolvedValueOnce([{ id: 1 }]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 124 });

    expect(response.status).toBe(200);
    expect(response.body.url).toBe('/dashboard?success=true');
  });

  it('POST /create-session allows renewal when the enrollment has an expiry', async () => {
    dbChain.limit.mockResolvedValueOnce([paidCourse]);
    // Already enrolled but expiring subscription → renewal allowed
    dbChain.limit.mockResolvedValueOnce([{ id: 1, courseId: 123, userId: 1, expiresAt: new Date() }]);
    dbChain.returning.mockResolvedValueOnce([{ id: 1000 }]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123, durationMonths: 1 });

    expect(response.status).toBe(200);
    expect(response.body.url).toContain('paymentId=1000');
  });

  it('POST /create-session blocks re-purchase of a permanent enrollment', async () => {
    dbChain.limit.mockResolvedValueOnce([paidCourse]);
    // Permanent enrollment (no expiry) on a paid course
    dbChain.limit.mockResolvedValueOnce([{ id: 1, courseId: 123, userId: 1, expiresAt: null }]);

    const response = await request(app)
      .post('/api/payments/create-session')
      .send({ type: 'course', itemId: 123, durationMonths: 1 });

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
