const fs = require('fs');
const path = require('path');

function getEnv() {
  const envFiles = [
    path.resolve(__dirname, '../../bot-telegram/.env'),
    path.resolve(__dirname, '../../.env.local')
  ];
  const env = {};
  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!env[key]) env[key] = val;
        }
      });
    }
  }
  return env;
}

const env = getEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log(JSON.stringify({ error: 'Faltan credenciales de Supabase' }));
  process.exit(1);
}

const { createClient } = require(path.resolve(__dirname, '../../bot-telegram/node_modules/@supabase/supabase-js'));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: tickets, error } = await supabase
    .from('dev_tickets')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !tickets || tickets.length === 0) {
    console.log('NO_APPROVED_TICKETS');
    return;
  }

  console.log('TICKET_FOUND:' + JSON.stringify(tickets[0]));
}

main();
