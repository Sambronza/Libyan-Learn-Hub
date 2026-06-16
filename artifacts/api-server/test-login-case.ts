import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function test() {
  const passwordHash = await bcrypt.hash("Password123", 10);
  
  // Clear any existing test user
  await db.delete(usersTable).where(eq(usersTable.email, "test.user@domain.com"));

  // Register
  const [user] = await db.insert(usersTable).values({
    email: "test.user@domain.com",
    passwordHash,
    fullName: "Test User",
    role: "student",
    language: "ar",
    tier: "free"
  }).returning();

  console.log("Registered user:", user.email);

  // Now let's simulate the login process as defined in auth.ts
  const loginCases = [
    { email: "test.user@domain.com", password: "Password123", expected: true },
    { email: "TEST.user@domain.com", password: "Password123", expected: true },
    { email: "Test.User@Domain.com", password: "WrongPassword", expected: false },
    { email: "test.user@domain.com", password: "password123", expected: false },
  ];

  for (const c of loginCases) {
    const inputEmail = c.email.toLowerCase(); // Simulate auth.ts req.body.email = req.body.email.toLowerCase()
    
    const [found] = await db.select().from(usersTable).where(eq(usersTable.email, inputEmail)).limit(1);
    
    if (!found) {
      console.log(`Test ${c.expected === false ? 'PASSED' : 'FAILED'}: ${c.email} with ${c.password} -> User not found (Expected ${c.expected})`);
      continue;
    }
    
    const valid = await bcrypt.compare(c.password, found.passwordHash);
    if (valid === c.expected) {
      console.log(`Test PASSED: ${c.email} with ${c.password} -> login success: ${valid}`);
    } else {
      console.log(`Test FAILED: ${c.email} with ${c.password} -> login success: ${valid} (Expected ${c.expected})`);
    }
  }

  // Cleanup
  await db.delete(usersTable).where(eq(usersTable.id, user.id));
  process.exit(0);
}

test().catch(console.error);
