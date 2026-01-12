
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_ID = 'img-1768218433787-0';
const LOCAL_FILE = 'public/images/thumbs/B0007717 (2).jpg';
const BUCKET = 'Helene-gallery-image';

async function repairItem() {
  console.log(`🛠️ Repairing item ${TARGET_ID}...`);
  
  // 1. Fetch content
  const { data: dbData } = await supabase.from('gallery_content').select('data').eq('id', 1).single();
  let pages = dbData.data;
  
  let targetItem = null;
  for (const page of pages) {
    targetItem = page.items.find(i => i.id === TARGET_ID);
    if (targetItem) break;
  }
  
  if (!targetItem) {
    console.error("❌ Target item not found in DB!");
    return;
  }

  // 2. Upload file
  if (!fs.existsSync(LOCAL_FILE)) {
    console.error(`❌ Local file not found: ${LOCAL_FILE}`);
    return;
  }

  const fileBuffer = fs.readFileSync(LOCAL_FILE);
  const storageName = `fixed-B0007717_2.jpg`;

  console.log(`📤 Uploading to Supabase as ${storageName}...`);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storageName, fileBuffer, { upsert: true, contentType: 'image/jpeg' });

  if (uploadError) {
    console.error("❌ Upload failed:", uploadError.message);
    return;
  }

  // 3. Update DB
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageName);
  
  targetItem.storageName = storageName;
  targetItem.originalUrl = publicUrl;
  targetItem.largeUrl = publicUrl;
  targetItem.thumbnailUrl = `${publicUrl}?width=480&quality=70&format=auto&resize=cover`;
  
  console.log("💾 Saving to DB...");
  const { error: saveError } = await supabase.from('gallery_content').upsert({ id: 1, data: pages });

  if (saveError) {
    console.error("❌ Save failed:", saveError.message);
  } else {
    console.log("✅ SUCCESS! Image repaired.");
  }
}

repairItem();
