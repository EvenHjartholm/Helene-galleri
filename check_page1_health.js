
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPage1() {
  console.log("Checking Page 1 Health...");
  const { data } = await supabase.from('gallery_content').select('data').eq('id', 1).single();
  const page1 = data.data[0];

  for (let i = 0; i < page1.items.length; i++) {
    const item = page1.items[i];
    if (item.type !== 'image') continue;

    console.log(`Checking [${i}] ${item.storageName || 'LOCAL'}...`);
    
    const urls = [item.thumbnailUrl, item.largeUrl, item.originalUrl];
    for (const url of urls) {
        if (!url) continue;
        if (!url.startsWith('http')) {
            console.log(`  ❌ BAD URL: ${url}`);
            continue;
        }
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) {
                console.log(`  ✅ OK: ${url.substring(0, 100)}...`);
            } else {
                console.log(`  ❌ FAIL (${res.status}): ${url}`);
            }
        } catch (e) {
            console.log(`  ❌ ERROR: ${url}`);
        }
    }
    console.log("-------------------");
  }
}

checkPage1();
