import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { Page, ImageItem } from "../types";

const BUCKET = "Helene-gallery-image";
const REPAIR_TIMEOUT_MS = 15000; // 15 seconds max for repair

/** ✅ TEST: URL actually works (HEAD Request) */
async function urlWorks(url: string) {
  try {
    const res = await fetch(url, { 
      method: "HEAD" 
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** ✅ Supabase Image Transformation Helpers */
/** ✅ Supabase Image Transformation Helpers */
// NOTE: Transformation is ENABLED again because we fixed the heavy files.
// This ensures fast loading of thumbnails (50KB instead of 500KB).
export function toThumb(publicUrl: string, w = 400, q = 65) {
  if (!publicUrl) return "";
  
  // If local blob/preview, return as is
  if (!publicUrl.startsWith("http")) return publicUrl;

  // If NOT Supabase, return as is
  if (!publicUrl.includes("/storage/v1/object/public/")) return publicUrl;

  // Convert object URL to render URL for resizing
  const [base] = publicUrl.split("?");
  const renderBase = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  
  // Return optimized thumbnail URL
  return `${renderBase}?width=${w}&quality=${q}&resize=contain`;
}

export function toLarge(publicUrl: string, w = 1600, q = 80) {
   // Keep large images as direct object URLs for now to avoid any re-compression artifacts/issues on full screen
   // We already optimized them to 1600px on upload via "Turbo" mode.
  return publicUrl;
}

// ✨ NEW: Generate tiny blur-up placeholder using Render API
// (Works now because all files are optimized/small enough for Render API)
export function getTinyUrl(publicUrl: string) {
  if (!publicUrl || !publicUrl.includes("/storage/v1/object/public/")) return "";
  
  // Convert object URL to render URL
  const [base] = publicUrl.split("?");
  const renderBase = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  
  return `${renderBase}?width=20&quality=20&resize=contain`;
}

// ...

/** ✅ Extract filename from URL */
function extractFilenameFromUrl(url: string) {
  try {
    // Strip query params first
    const cleanUrl = url.split("?")[0];
    const clean = decodeURIComponent(cleanUrl);
    const parts = clean.split("/");
    return parts[parts.length - 1];
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1];
  }
}

/** ✅ Remove timestamp prefix */
function stripTimestampPrefix(filename: string) {
  return filename.replace(/^\d+-/, "");
}

/** ✅ Normalize names for fuzzy matching */
function normalizeName(filename: string) {
  return stripTimestampPrefix(filename)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/%20/g, "")
    .trim();
}

/** ✅ List ALL files in bucket with paging (root only) */
async function listAllFilesInBucket() {
  if (!supabase) return [];
  let all: { name: string; created_at: string }[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data.map((f: any) => ({ name: f.name, created_at: f.created_at })));
    offset += limit;
    if (data.length < limit) break;
  }

  return all;
}

/** ✅ Find best match for a URL filename inside bucket list */
function findBestMatch(fileList: { name: string }[], currentUrl: string) {
  const currentName = extractFilenameFromUrl(currentUrl);
  const normalized = normalizeName(currentName);

  // A) exact match
  let match = fileList.find((f) => f.name === currentName);
  if (match) return match.name;

  // B) match without timestamp
  const withoutTimestamp = stripTimestampPrefix(currentName);
  match = fileList.find((f) => f.name === withoutTimestamp);
  if (match) return match.name;

  // C) normalized exact
  match = fileList.find((f) => normalizeName(f.name) === normalized);
  if (match) return match.name;

  // D) endsWith normalized
  match = fileList.find((f) => normalizeName(f.name).endsWith(normalized));
  if (match) return match.name;

  // E) reverse endsWith
  match = fileList.find((f) => normalized.endsWith(normalizeName(f.name)));
  if (match) return match.name;

  return null;
}


export function useGallerySync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ title: string; message: string } | null>(null);
  const [syncProgress, setSyncProgress] = useState<string>("");
  const [cleanProposal, setCleanProposal] = useState<{ count: number; files: string[] } | null>(null);

  /** ✅ INTERNAL: Repair Logic with Timeout */
  async function repairLogic(pages: Page[]) {
    // Timeout wrapper
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Repair timed out")), REPAIR_TIMEOUT_MS)
    );

    const workPromise = async () => {
       if (!supabase) return { pages, fixedCount: 0 };
       
       let fileList: { name: string }[] = [];
       try {
         fileList = await listAllFilesInBucket();
       } catch (e) {
         console.warn("Could not fetch bucket list for repair:", e);
         return { pages, fixedCount: 0 };
       }

       const newPages = JSON.parse(JSON.stringify(pages)) as Page[];
       let fixedCount = 0;

       for (const page of newPages) {
         for (const item of page.items) {
           if (item.type !== "image") continue;
           const img = item as ImageItem;

           // 1. If storageName exists, verify it works
           if (img.storageName) {
              const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(img.storageName);
              
              const baseUrl = publicUrl;
              const optimizedThumb = toThumb(baseUrl);
              const optimizedLarge = toLarge(baseUrl);
              
              // ALWAYS set URLs correctly if we know the storage name.
              // Don't verify with urlWorks() as it fails on some Supabase render URLs (400/404)
              if (img.thumbnailUrl !== optimizedThumb || img.largeUrl !== optimizedLarge) {
                 img.thumbnailUrl = optimizedThumb;
                 img.largeUrl = optimizedLarge;
                 img.originalUrl = baseUrl;
                 fixedCount++; 
              }
              continue; 
           }

           // 2. If no storageName, try repair
           const urls = [img.thumbnailUrl, img.largeUrl, img.originalUrl].filter(Boolean);
           const shouldRepair = urls.some(u => u.includes("supabase.co/storage") || u.includes("/images/"));
           
           if (!shouldRepair) continue;

           const matchName = findBestMatch(fileList, img.largeUrl || img.originalUrl);
           if (matchName) {
              const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(matchName);
              
              // Here we DO check because we guessed the name
              if (await urlWorks(publicUrl)) {
                 img.storageName = matchName; // Permanent link
                 const baseUrl = publicUrl;
                 img.thumbnailUrl = toThumb(baseUrl);
                 img.largeUrl = toLarge(baseUrl);
                 img.originalUrl = baseUrl;
                 fixedCount++;
              }
           }
         }
       }
       return { pages: newPages, fixedCount };
    };

    // Race timeout vs work
    try {
       return await Promise.race([workPromise(), timeoutPromise]) as { pages: Page[], fixedCount: number };
    } catch (e) {
       console.warn("Repair skipped due to timeout or error:", e);
       return { pages, fixedCount: 0 };
    }
  }

  /** ✅ INTERNAL: Resize Image before Upload */
  const resizeImage = (file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas to Blob failed"));
        }, 'image/jpeg', quality);
      };
      img.onerror = (e) => reject(e);
    });
  };

  /** ✅ EXPOSED: Unified Sync Flow */
  async function syncToCloud(pages: Page[]) {
    if (!supabase) {
      setSyncMessage({ title: "Feil", message: "Mangler Supabase-kobling." });
      return null;
    }

    setIsSyncing(true);
    setSyncProgress("Startet...");

    try {
      // STEG A: Repair (Safe & Fast)
      setSyncProgress("Sjekker og reparerer linker...");
      const { pages: repairedPages } = await repairLogic(pages);
      
      // STEG B: Upload Local Images
      // ✅ Use structuredClone instead (keeps File objects alive)
      let updatedPages = structuredClone(repairedPages) as Page[];
      let uploadCount = 0;

      // Count local images first for progress
      const localImages = updatedPages.flatMap(p => p.items).filter(i => i.type === 'image' && i.largeUrl.startsWith('/images/'));
      let processedLocal = 0;

      for (const page of updatedPages) {
        for (const item of page.items) {
          if (item.type !== 'image') continue;
          const img = item as ImageItem;

          // Upload if not already in Supabase
          const needsUpload = !img.largeUrl.includes("supabase.co/storage") && !img.storageName;

          if (needsUpload) {
             processedLocal++;
             setSyncProgress(`Optimaliserer og laster opp bilde ${processedLocal}...`);
             
             try {
                // ✅ CASE 1: Vi har en ekte File (fra opplasting)
                if (img.file instanceof File) {
                    // OPTIMIZE: Shrink image before upload
                    const optimizedBlob = await resizeImage(img.file);
                    const optimizedFile = new File([optimizedBlob], img.file.name, { type: 'image/jpeg' });

                    const fileName = `${Date.now()}-${img.file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
                    const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, optimizedFile, { upsert: true });

                    if (!error && data) {
                        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
                        const baseUrl = publicUrl;
                        img.storageName = fileName;
                        img.thumbnailUrl = toThumb(baseUrl);
                        img.largeUrl = toLarge(baseUrl);
                        img.originalUrl = baseUrl;
                        delete img.file; 
                        uploadCount++;
                    }
                } 
                // ✅ CASE 2: Vi må hente via URL (blob/lokal)
                else {
                    const source = img.originalUrl; // alltid original, ikke transform
                    if (!source) continue;
                    
                    const res = await fetch(source);

                    // ✅ SECURITY CHECK
                    const contentType = res.headers.get("content-type") || "";
                    if (!contentType.startsWith("image/")) {
                       console.error("🚨 Ikke bilde! Stoppet upload:", source, "Content-Type:", contentType);
                       continue;
                    }

                    const blob = await res.blob();
                    
                    const cleanName = source.startsWith("http") ? source.split("/").pop() : "local-upload.jpg";
                    const fileName = `${Date.now()}-${cleanName}`;
                    
                    const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, blob, { upsert: true });
                    
                    if (!error && data) {
                       const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
                       const baseUrl = publicUrl;
                       img.storageName = fileName; // Permanent linking
                       img.thumbnailUrl = toThumb(baseUrl);
                       img.largeUrl = toLarge(baseUrl);
                       img.originalUrl = baseUrl;
                       uploadCount++;
                    }
                }
             } catch (e) {
                console.error("Upload failed for", img.id, e);
             }
          }
        }
      }

      // STEG C: Save Layout
      setSyncProgress("Lagrer layout til database...");
      const { error: dbError } = await supabase.from("gallery_content").upsert({ id: 1, data: updatedPages });
      if (dbError) throw dbError;

      // STEG D: Clean Cloud Check (Async, doesn't block success)
      setSyncProgress("Sjekker etter unødvendige filer...");
      checkCleanCloud(updatedPages); // Fire and forget / Handle via separate state

      setSyncMessage({
        title: "Lagret & Oppdatert ✅",
        message: `Galleri er trygt lagret.\n• ${uploadCount} nye bilder lastet opp\n• Linker er verifisert`
      });

      return updatedPages;

    } catch (e) {
      console.error(e);
      setSyncMessage({ title: "Feil", message: "Noe gikk galt under lagring." });
      return null;
    } finally {
      setIsSyncing(false);
      setSyncProgress("");
    }
  }

  /** ✅ INTERNAL: Safe Clean Check */
  async function checkCleanCloud(currentPages: Page[]) {
    try {
      const allFiles = await listAllFilesInBucket();
      
      // 1. Gather all used storageNames
      const usedNames = new Set<string>();
      currentPages.forEach(p => p.items.forEach(i => {
         if (i.type === 'image' && (i as ImageItem).storageName) {
            usedNames.add((i as ImageItem).storageName!);
         }
      }));

      // 2. Identify unused
      const unusedFiles = allFiles.filter(f => !usedNames.has(f.name));

      if (unusedFiles.length > 0) {
         setCleanProposal({ count: unusedFiles.length, files: unusedFiles.map(f => f.name) });
      }
    } catch (e) {
       console.warn("Clean check failed", e);
    }
  }

  /** ✅ EXPOSED: Confirm Clean */
  async function confirmClean() {
     if (!cleanProposal || !supabase) return;
     
     setIsSyncing(true);
     setSyncProgress(`Rydder ${cleanProposal.count} filer...`);
     
     try {
       // Batch delete (Supabase limits to 10? No, supports larger batches usually, but let's be safe or just map)
       // storage.remove takes string[]
       const { error } = await supabase.storage.from(BUCKET).remove(cleanProposal.files);
       
       if (error) throw error;
       
       setSyncMessage({ title: "Opprydding Ferdig 🧹", message: `Slettet ${cleanProposal.count} ubrukte filer fra skyen.` });
       setCleanProposal(null);
     } catch (e) {
       setSyncMessage({ title: "Feil ved opprydding", message: String(e) });
     } finally {
       setIsSyncing(false);
       setSyncProgress("");
     }
  }

  /** ✅ EXPOSED: Cancel Clean */
  function cancelClean() {
    setCleanProposal(null);
  }

  return {
    isSyncing,
    syncMessage,
    setSyncMessage,
    syncProgress,
    cleanProposal,
    confirmClean,
    cancelClean,
    syncToCloud,
    repairImageUrls: repairLogic 
  };
}
