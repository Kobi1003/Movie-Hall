/**
 * clear-demo-data.js
 * Clears ALL user-entered data from Supabase for a clean demo.
 * Preserves: nothing (all rows deleted from all tables below).
 * Run: node tixora-backend/scripts/clear-demo-data.js
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

// Delete order matters — child tables first (FK constraints)
const TABLES_TO_CLEAR = [
  // Transactions / money
  'payments',
  'settlements',
  'escrow_transactions',

  // Bookings & reservations
  'booking_seats',
  'bookings',
  'reservations',
  'seat_locks',

  // Notifications
  'notifications',

  // Shows / showtimes
  'shows',

  // Movies
  'movies',

  // Cinema hall structure
  'seat_rows',
  'seat_categories',
  'seat_layouts',
  'screens',
  'cinemas',
  'cinema_halls',

  // Authorisations / certificates
  'exhibition_authorizations',
  'cinema_verifications',
  'authorizations',

  // Users / profiles  (last — others may reference them)
  'profiles',
  'users',
];

async function clearTable(table) {
  // Delete all rows — Supabase requires a filter; use gte id trick or just use neq on a uuid
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // matches everything

  if (error) {
    if (error.code === '42P01') {
      // Table doesn't exist — skip quietly
      console.log(`  ⚪ ${table.padEnd(32)} (table not found — skipped)`);
    } else {
      console.error(`  ❌ ${table.padEnd(32)} ERROR: ${error.message}`);
    }
  } else {
    console.log(`  ✅ ${table.padEnd(32)} deleted ${count ?? '?'} rows`);
  }
}

async function main() {
  console.log('\n🗑️  TIXORA — Clear Demo Data');
  console.log('='.repeat(50));
  console.log(`📡 Supabase: ${process.env.SUPABASE_URL}\n`);

  for (const table of TABLES_TO_CLEAR) {
    await clearTable(table);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Done! Database is clean and ready for a fresh demo.\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

