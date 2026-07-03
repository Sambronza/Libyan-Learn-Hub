import { describe, it, expect, vi } from 'vitest';

// The pure helpers import @workspace/db at module level — stub it out.
vi.mock('@workspace/db', () => ({
  db: {},
  enrollmentsTable: {},
  coursesTable: {},
  usersTable: {},
  teacherEarningsTable: {},
  platformSettingsTable: {},
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn() }));

const { isValidDuration, getPlanPrice, isFreeCourse, parsePlanPrices, hasIncompletePlanPrices } =
  await import('./subscriptions.js');
const { euclideanDistance, bestMatchDistance, hasFaceProfile } = await import('./face.js');

const paidCourse: any = {
  price: '100.00',
  priceMonth1: '100.00',
  priceMonth3: '270.00',
  priceMonth6: '500.00',
  priceMonth12: '900.00',
};

describe('subscription helpers', () => {
  it('isValidDuration accepts only 1/3/6/12', () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(3)).toBe(true);
    expect(isValidDuration(6)).toBe(true);
    expect(isValidDuration(12)).toBe(true);
    expect(isValidDuration(2)).toBe(false);
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration('3' as any)).toBe(false);
  });

  it('getPlanPrice returns the matching plan price', () => {
    expect(getPlanPrice(paidCourse, 1)).toBe(100);
    expect(getPlanPrice(paidCourse, 3)).toBe(270);
    expect(getPlanPrice(paidCourse, 6)).toBe(500);
    expect(getPlanPrice(paidCourse, 12)).toBe(900);
    expect(getPlanPrice({ ...paidCourse, priceMonth6: null }, 6)).toBeNull();
  });

  it('isFreeCourse checks the legacy price', () => {
    expect(isFreeCourse({ price: '0' } as any)).toBe(true);
    expect(isFreeCourse(paidCourse)).toBe(false);
  });

  it('parsePlanPrices returns nulls for a free course', () => {
    const result = parsePlanPrices({});
    expect(result.error).toBeUndefined();
    expect(result.values).toEqual({
      price: '0', priceMonth1: null, priceMonth3: null, priceMonth6: null, priceMonth12: null,
    });
  });

  it('parsePlanPrices errors when a paid course misses a duration', () => {
    const result = parsePlanPrices({ priceMonth1: 50, priceMonth3: 120 });
    expect(result.error).toBeDefined();
    expect(result.error!.messageAr).toBeTruthy();
  });

  it('parsePlanPrices accepts a complete paid setup and mirrors 1-month into price', () => {
    const result = parsePlanPrices({ priceMonth1: 50, priceMonth3: 120, priceMonth6: 220, priceMonth12: 400 });
    expect(result.error).toBeUndefined();
    expect(result.values).toEqual({
      price: '50.00', priceMonth1: '50.00', priceMonth3: '120.00', priceMonth6: '220.00', priceMonth12: '400.00',
    });
  });

  it('parsePlanPrices derives plan prices from a legacy single price', () => {
    const result = parsePlanPrices({ price: 100 });
    expect(result.error).toBeUndefined();
    expect(result.values!.priceMonth1).toBe('100.00');
    expect(result.values!.priceMonth3).toBe('270.00');
    expect(result.values!.priceMonth6).toBe('500.00');
    expect(result.values!.priceMonth12).toBe('900.00');
  });

  it('hasIncompletePlanPrices flags paid courses missing prices, not free ones', () => {
    expect(hasIncompletePlanPrices(paidCourse)).toBe(false);
    expect(hasIncompletePlanPrices({ ...paidCourse, priceMonth12: null })).toBe(true);
    expect(hasIncompletePlanPrices({ price: '0' } as any)).toBe(false);
  });
});

describe('face matching helpers', () => {
  const a = new Array(128).fill(0);
  const b = new Array(128).fill(0);
  const far = new Array(128).fill(1);

  it('euclideanDistance is 0 for identical descriptors', () => {
    expect(euclideanDistance(a, b)).toBe(0);
  });

  it('euclideanDistance grows with difference', () => {
    expect(euclideanDistance(a, far)).toBeCloseTo(Math.sqrt(128));
  });

  it('euclideanDistance is Infinity for mismatched lengths', () => {
    expect(euclideanDistance(a, [1, 2, 3])).toBe(Infinity);
  });

  it('bestMatchDistance picks the closest stored pose', () => {
    const stored = { front: far, left: a };
    expect(bestMatchDistance(b, stored)).toBe(0);
  });

  it('hasFaceProfile requires all five poses', () => {
    expect(hasFaceProfile({ front: a, left: a, right: a, up: a, down: a })).toBe(true);
    expect(hasFaceProfile({ front: a, left: a })).toBe(false);
    expect(hasFaceProfile(null)).toBe(false);
  });
});
