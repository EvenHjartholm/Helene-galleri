
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectContent() {
  console.log("Fetching gallery content...");
  const { data, error } = await supabase
    .from('gallery_content')
    .select('data')
    .eq('id', 1)
    .single();

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  const pages = data.data;
  console.log(`Found ${pages.length} pages.`);

  if (pages.length > 0) {
    console.log("--- PAGE 1 CONTENTS ---");
    const page1 = pages[0];
    page1.items.forEach((item, index) => {
      if (item.type === 'image') {
        console.log(`[Item ${index}] ID: ${item.id}`);
        console.log(` - Original URL: ${item.originalUrl}`);
        console.log(` - Large URL:    ${item.largeUrl}`);
        console.log(` - StorageName:  ${item.storageName || 'NONE'}`);
        console.log("---------------------------------------------------");
      } else {
        console.log(`[Item ${index}] TEXT ITEM`);
        console.log("---------------------------------------------------");
      }
    });
  } else {
    console.log("Page 1 does not exist in DB data.");
  }
}

inspectContent();
