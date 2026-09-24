const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read environment
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error('Error: Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSqlFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');
  console.log(`Executing migration: ${filePath}...`);

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error(`❌ Migration failed:`, error);
    process.exit(1);
  }

  console.log(`✅ Migration applied successfully: ${filePath}`);
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Usage: node scripts/run_sql.js <path-to-sql-file>');
  process.exit(1);
}

runSqlFile(targetFile);
