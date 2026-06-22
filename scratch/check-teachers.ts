import { db } from "../artifacts/api-server/src/db.js";
import { usersTable } from "../lib/db/src/schema/users.js";

async function main() {
  const teachers = await db.select().from(usersTable);
  console.log(teachers.map(t => ({ id: t.id, name: t.fullName, role: t.role, isTutoringEnabled: t.isTutoringEnabled, subjects: t.tutoringSubjects, levels: t.tutoringLevels })));
  process.exit(0);
}
main();
