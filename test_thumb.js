
const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const BUCKET = 'Helene-gallery-image';

// Use a file we KNOW is optimized/fixed
const knownGoodFile = 'fixed-B0007246-Edit-2.jpg';

async function testThumb() {
    const renderUrl = `${supabaseUrl}/storage/v1/render/image/public/${BUCKET}/${knownGoodFile}?width=400&quality=60`;
    console.log("Testing Thumb URL:", renderUrl);

    const start = Date.now();
    try {
        const res = await fetch(renderUrl);
        const end = Date.now();
        console.log("Status:", res.status);
        console.log("Time:", end - start, "ms");
        
        if (res.ok) {
            console.log("✅ Thumbnail generated successfully!");
            const blob = await res.blob();
            console.log("Size:", blob.size, "bytes");
        } else {
            console.log("❌ Thumbnail failed.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testThumb();
