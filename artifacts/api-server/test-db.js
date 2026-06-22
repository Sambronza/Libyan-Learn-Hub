import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT id, full_name, role, is_tutoring_enabled, tutoring_subjects, tutoring_levels FROM users').then(res => { console.log(JSON.stringify(res.rows, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
