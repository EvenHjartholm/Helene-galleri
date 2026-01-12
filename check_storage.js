
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
  console.log("Checking bucket 'Helene-gallery-image'...");
  const { data, error } = await supabase
    .storage
    .from('Helene-gallery-image')
    .list('', { limit: 100 });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${data.length} files:`);
  data.forEach(f => console.log(` - ${f.name} (${(f.metadata.size / 1024).toFixed(1)} KB)`));
}

listFiles();
