

const SUPABASE_URL = 'https://ghwtecscpjxkrcrvadkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdod3RlY3NjcGp4a3JjcnZhZGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzA0NjYsImV4cCI6MjA4Nzk0NjQ2Nn0.EHkZtsqSOQ8O0ookIKBZMRiL2Bqw_DXz4DgS6N28mzY';

// MUST BE 'supabaseDb', NOT 'supabase'
const supabaseDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
