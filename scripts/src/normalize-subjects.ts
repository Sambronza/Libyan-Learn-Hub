import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

import { db, usersTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";

const TUTORING_SUBJECTS = [
  'Mathematics / الرياضيات',
  'Physics / الفيزياء',
  'Chemistry / الكيمياء',
  'Biology / الأحياء',
  'English / اللغة الإنجليزية',
  'Arabic / اللغة العربية',
  'History / التاريخ',
  'Geography / الجغرافيا',
  'Computer Science / علوم الحاسوب',
  'Islamic Studies / التربية الإسلامية',
];

const matchSubject = (raw: string): string | null => {
  const s = raw.toLowerCase().trim();
  if (!s) return null;

  if (s.includes('math') || s.includes('رياضيات')) return 'Mathematics / الرياضيات';
  if (s.includes('phys') || s.includes('فيزياء')) return 'Physics / الفيزياء';
  if (s.includes('chem') || s.includes('كيمياء')) return 'Chemistry / الكيمياء';
  if (s.includes('bio') || s.includes('أحياء')) return 'Biology / الأحياء';
  if (s.includes('eng') || s.includes('انجليز') || s.includes('إنجليز')) return 'English / اللغة الإنجليزية';
  if (s.includes('arab') || s.includes('عرب')) return 'Arabic / اللغة العربية';
  if (s.includes('hist') || s.includes('تاريخ')) return 'History / التاريخ';
  if (s.includes('geo') || s.includes('جغرافيا')) return 'Geography / الجغرافيا';
  if (s.includes('comp') || s.includes('cs') || s.includes('حاسوب')) return 'Computer Science / علوم الحاسوب';
  if (s.includes('islam') || s.includes('دين') || s.includes('إسلام')) return 'Islamic Studies / التربية الإسلامية';

  // exact matches from original list
  const exactMatch = TUTORING_SUBJECTS.find(subj => subj.toLowerCase() === s);
  if (exactMatch) return exactMatch;

  return null;
};

async function main() {
  console.log('Starting subject normalization migration...');
  const teachers = await db.select().from(usersTable).where(isNotNull(usersTable.tutoringSubjects));
  let updatedCount = 0;

  for (const teacher of teachers) {
    if (!teacher.tutoringSubjects) continue;
    
    // Split by comma
    const parts = teacher.tutoringSubjects.split(',');
    const normalizedSet = new Set<string>();

    for (const p of parts) {
      const match = matchSubject(p);
      if (match) {
        normalizedSet.add(match);
      } else {
        // if no match, keep original so we don't lose data, but they should update their profile
        normalizedSet.add(p.trim());
      }
    }

    const newSubjects = Array.from(normalizedSet).join(',');

    if (newSubjects !== teacher.tutoringSubjects) {
      console.log(`Updating teacher ${teacher.id} from "${teacher.tutoringSubjects}" to "${newSubjects}"`);
      await db.update(usersTable)
        .set({ tutoringSubjects: newSubjects })
        .where(eq(usersTable.id, teacher.id));
      updatedCount++;
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} teachers.`);
  process.exit(0);
}

main().catch(console.error);
