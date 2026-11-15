/**
 * clear-demo-data-v2.js
 * Clears remaining tables (seats → seat_categories) blocked by FK in round 1.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES = [
  'seats',           // must go before seat_categories
  'seat_categories', // now safe
];

async function clearTable(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    if (error.code === '42P01') {
      console.log(`  ⚪ ${table.padEnd(32)} (table not found — skipped)`);
    } else {
      console.error(`  ❌ ${table.padEnd(32)} ERROR: ${error.message}`);
    }
  } else {
    console.log(`  ✅ ${table.padEnd(32)} deleted ${count ?? '?'} rows`);
  }
}

async function main() {
  console.log('\n🗑️  TIXORA — Clear remaining seat tables');
  console.log('='.repeat(50));
  for (const t of TABLES) await clearTable(t);
  console.log('\n✅ All seat data cleared.\n');
}

main().catch(console.error);

