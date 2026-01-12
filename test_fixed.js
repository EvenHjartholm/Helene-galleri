
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const supabaseKey = 'sb_publishable_CRHzrnVjAm3W3nYJKzF9JQ_mnSDLYA5';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFixedUrl() {
  const filename = 'fixed-B0008133.jpg';
  
  // 1. Test Render URL (which failed in browser)
  const renderUrl = `${supabaseUrl}/storage/v1/render/image/public/Helene-gallery-image/${filename}?width=480&quality=70&format=auto`;
  console.log("Testing Render URL:", renderUrl);
  try {
    const res = await fetch(renderUrl, { method: 'HEAD' });
    console.log("Render Status:", res.status, res.statusText);
  } catch (e) { console.log("Render Error:", e.message); }

  // 2. Test Object URL (Direct)
  const objectUrl = `${supabaseUrl}/storage/v1/object/public/Helene-gallery-image/${filename}`;
  console.log("\nTesting Object URL:", objectUrl);
  try {
    const res = await fetch(objectUrl, { method: 'HEAD' });
    console.log("Object Status:", res.status, res.statusText);
    if (res.ok) {
        console.log("Content-Length:", res.headers.get('content-length'));
        console.log("Content-Type:", res.headers.get('content-type'));
    }
  } catch (e) {
    console.log("Object Error:", e.message);
  }
}

testFixedUrl();
