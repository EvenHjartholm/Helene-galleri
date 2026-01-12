
const supabaseUrl = 'https://qipixzqlegsxgnvgsskt.supabase.co';
const BUCKET = 'Helene-gallery-image';

// Use a file we KNOW is optimized/fixed
const knownGoodFile = 'fixed-B0007246-Edit-2.jpg';

async function test() {
    const renderUrl = `${supabaseUrl}/storage/v1/render/image/public/${BUCKET}/${knownGoodFile}?width=50&quality=50`;
    console.log("Testing:", renderUrl);

    try {
        const res = await fetch(renderUrl);
        console.log("Status:", res.status, res.statusText);
        
        if (res.ok) {
            console.log("✅ Render API works on optimized file!");
        } else {
            console.log("❌ Render API failed.");
            const text = await res.text();
            console.log("Body:", text);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
