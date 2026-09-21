// Applies SQL migrations in supabase/migrations in order, tracking applied
// files in a _migrations table. Uses the direct Postgres connection string
// (SUPABASE_DB_URL). Idempotent — already-applied files are skipped.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations');

async function main() {
  if (!env.supabase.dbUrl) {
    console.error('SUPABASE_DB_URL is not set. Add it to backend/.env to run migrations.');
    process.exit(1);
  }

  // pg is an optional peer for migrations only; require lazily with a clear hint.
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('The "pg" package is required to run migrations. Install it with:  npm i pg');
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: env.supabase.dbUrl });
  await client.connect();

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('select name from _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`⏭  ${file} (already applied)`);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`▶  applying ${file}...`);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations(name) values ($1)', [file]);
      await client.query('commit');
      console.log(`✅ ${file}`);
    } catch (err) {
      await client.query('rollback');
      console.error(`❌ ${file} failed:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('All migrations applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
