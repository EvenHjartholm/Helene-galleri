
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Config
const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';
const BUCKET = 'Helene-gallery-image';
const LOCAL_IMG_DIR = 'public/images/thumbs'; // Using thumbs as they are reasonably sized (1-4MB)

const supabase = createClient(supabaseUrl, supabaseKey);

// The 19 files we know exist
const LOCAL_FILES = [
  "B0007246-Edit-2.jpg", "B0007289-2.jpg", "B0007717 (2).jpg", "B0007868-2.jpg", 
  "B0007916.jpg", "B0008126.jpg", "B0008133.jpg", "B0008579-2.jpg", "B0008927.jpg", 
  "B0008939.jpg", "B0008949.jpg", "B0008964.jpg", "B0008985.jpg", "B0008988.jpg", 
  "_T6A5873-2.jpg", "_T6A5894-2.jpg", "_T6A6564.jpg", "_T6A6566.jpg", "_T6A6593.jpg"
];

async function runFix() {
  console.log("🚀 Starting Nuclear Gallery Fix...");

  // 1. Upload ALL local files to ensure they exist in cloud with PROPER names
  const uploadedMap = new Map(); // filename -> publicUrl

  for (const filename of LOCAL_FILES) {
    const filePath = path.join(LOCAL_IMG_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Local file missing: ${filePath}`);
        continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const storageName = `fixed-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    console.log(`📤 Uploading ${filename} as ${storageName}...`);
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storageName, fileBuffer, { upsert: true, contentType: 'image/jpeg' });

    if (error) {
        console.error(`❌ Failed to upload ${filename}:`, error.message);
    } else {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageName);
        uploadedMap.set(filename, { url: publicUrl, storageName });
        console.log(`✅ Uploaded: ${publicUrl}`);
    }
  }

  // 2. Fetch current gallery content
  console.log("\n📥 Fetching DB content...");
  const { data: dbData, error: dbError } = await supabase
    .from('gallery_content')
    .select('data')
    .eq('id', 1)
    .single();

  if (dbError) {
      console.error("❌ DB Error:", dbError);
      return;
  }

  let pages = dbData.data;
  let fileIndex = 0;
  const mapKeys = Array.from(uploadedMap.keys());

  // 3. Assign new URLs to ALL image items sequentially
  console.log("\n🔄 Patching gallery items...");
  
  pages.forEach((page, pIdx) => {
    page.items.forEach((item, iIdx) => {
        if (item.type === 'image') {
            // Pick next available file from our uploaded list (looping if we run out)
            const key = mapKeys[fileIndex % mapKeys.length];
            const info = uploadedMap.get(key);

            if (info) {
                console.log(`   - Patching Page ${pIdx+1} Item ${iIdx+1} with ${key}`);
                item.storageName = info.storageName;
                item.thumbnailUrl = `${info.url}?width=480&quality=70&format=auto&resize=cover`;
                item.largeUrl = `${info.url}?width=1600&quality=80&format=auto`;
                item.originalUrl = info.url;
                
                // Reset metadata
                item.caption = item.caption || "";
                item.width = item.width || 3;
                item.height = item.height || 2;
                
                fileIndex++;
            }
        }
    });
  });

  // 4. Save back to DB
  console.log("\n💾 Saving fixed data to DB...");
  const { error: saveError } = await supabase
    .from('gallery_content')
    .upsert({ id: 1, data: pages });

  if (saveError) {
      console.error("❌ Save Failed:", saveError);
  } else {
      console.log("✅ SUCCESS! Gallery has been repaired in the database.");
      console.log("👉 Refresh your browser to see the changes.");
  }
}

runFix();
