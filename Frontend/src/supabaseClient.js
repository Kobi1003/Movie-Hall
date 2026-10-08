import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xbksqvrwmlkboxvvrrjp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia3NxdnJ3bWxrYm94dnZycmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjE4NDEsImV4cCI6MjEwNDUzNzg0MX0.ESKWJbxjn-NAI2EU7W38CYya1-svv-5VAO9gtFRYJLE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
