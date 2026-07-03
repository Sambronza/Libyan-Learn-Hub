import { sql, type SQL } from "drizzle-orm";

/**
 * Arabic-aware search helpers.
 *
 * Arabic text has several visually-interchangeable letter variants that users
 * type inconsistently (أ/إ/آ vs ا, ة vs ه, ى vs ي, and diacritics). Normalizing
 * both sides of an ILIKE comparison makes "الفيزياء" match "فيزياء" typed with
 * any hamza/teh-marbuta variant.
 */

/** Normalize Arabic variants in a JS string (for the query text). */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ْٰ]/g, "") // diacritics (tashkeel)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, ""); // tatweel
}

/**
 * SQL expression that applies the same normalization to a column.
 * Uses nested translate/replace — no extension required.
 */
export function normalizedColumn(column: SQL | any): SQL {
  return sql`
    replace(replace(replace(replace(translate(${column},
      'أإآٱىةؤئـ',
      'اااايهوي'),
      'ً',''), 'ٌ',''), 'ٍ',''), 'ّ','')
  `;
}

/** Case-insensitive, Arabic-normalized ILIKE condition. */
export function searchCondition(column: SQL | any, term: string): SQL {
  const normalized = `%${normalizeArabic(term).toLowerCase()}%`;
  return sql`lower(${normalizedColumn(column)}) LIKE ${normalized}`;
}
