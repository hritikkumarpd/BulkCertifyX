// Seed the five sample certificate templates into an organization.
//
// Usage:  node src/scripts/seedTemplates.js <org_id> [created_by_user_id]
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in the environment. Templates are
// inserted with the service role (RLS bypassed); org_id scopes them correctly.

import { supabaseAdmin } from '../lib/supabase.js';
import { sampleTemplates } from '../data/sampleTemplates.js';
import { logger } from '../lib/logger.js';

async function main() {
  const orgId = process.argv[2];
  const createdBy = process.argv[3] || null;

  if (!orgId) {
    console.error('Usage: node src/scripts/seedTemplates.js <org_id> [created_by_user_id]');
    process.exit(1);
  }

  const rows = sampleTemplates.map((t) => ({
    org_id: orgId,
    created_by: createdBy,
    name: t.name,
    description: t.description,
    page_size: t.page_size,
    design: t.design,
    is_published: true,
  }));

  const { data, error } = await supabaseAdmin.from('templates').insert(rows).select('id, name');
  if (error) {
    logger.error({ err: error }, 'seed failed');
    process.exit(1);
  }

  console.log(`Seeded ${data.length} templates into org ${orgId}:`);
  data.forEach((t) => console.log(`  • ${t.name} (${t.id})`));
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'seed crashed');
  process.exit(1);
});
