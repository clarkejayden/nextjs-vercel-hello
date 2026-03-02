const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = envText.split(/\r?\n/).filter(Boolean).reduce((acc, line) => {
  if (line.startsWith('#')) return acc;
  const i = line.indexOf('=');
  if (i === -1) return acc;
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  acc[key] = value;
  return acc;
}, {});

const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('Missing env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const { data, error } = await supabase
    .from('captions')
    .select('id,content,is_public,created_datetime_utc')
    .eq('is_public', true)
    .order('created_datetime_utc', { ascending: false })
    .limit(20);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const rows = (data || []).map((row) => ({
    id: row.id,
    content: row.content,
    hasContent: Boolean(row.content && row.content.trim()),
    created: row.created_datetime_utc,
  }));

  console.log('Rows:', rows.length);
  console.log(JSON.stringify(rows, null, 2));
})();
