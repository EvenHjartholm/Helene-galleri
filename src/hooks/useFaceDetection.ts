import { useState, useEffect, useCallback, useRef } from 'react';

// Norwegian translations for COCO-SSD labels
const LABEL_NO: Record<string, string> = {
  person: 'Person', bird: 'Fugl', cat: 'Katt', dog: 'Hund',
  horse: 'Hest', sheep: 'Sau', cow: 'Ku', elephant: 'Elefant',
  bear: 'Bjørn', zebra: 'Sebra', giraffe: 'Sjiraff',
  car: 'Bil', bicycle: 'Sykkel', motorcycle: 'Motorsykkel',
  bus: 'Buss', train: 'Tog', truck: 'Lastebil', boat: 'Båt',
  umbrella: 'Paraply', backpack: 'Ryggsekk', surfboard: 'Surfebrett',
  skis: 'Ski', snowboard: 'Snowboard', kite: 'Drage',
  'sports ball': 'Ball', 'teddy bear': 'Bamse',
  cake: 'Kake', pizza: 'Pizza', donut: 'Smultring',
  apple: 'Eple', banana: 'Banan', orange: 'Appelsin',
  bottle: 'Flaske', 'wine glass': 'Vinglass', cup: 'Kopp',
  chair: 'Stol', couch: 'Sofa', bed: 'Seng',
  book: 'Bok', clock: 'Klokke', vase: 'Vase',
  laptop: 'Laptop', tv: 'TV', 'cell phone': 'Mobil',
};

export interface DetectedObject {
  id: string;
  label: string;
  labelNo: string;
  score: number;
  box: { x: number; y: number; width: number; height: number };
  matchedName?: string; // From face recognition
  faceDescriptor?: Float32Array; // For learning
}

// ---- Known faces storage (localStorage) ----
interface KnownFace { name: string; descriptor: number[]; }

function getKnownFaces(): KnownFace[] {
  try { return JSON.parse(localStorage.getItem('known-faces') || '[]'); } catch { return []; }
}
function saveKnownFace(name: string, descriptor: Float32Array) {
  const faces = getKnownFaces();
  faces.push({ name, descriptor: Array.from(descriptor) });
  localStorage.setItem('known-faces', JSON.stringify(faces));
}

function findMatch(descriptor: Float32Array, threshold = 0.55): string | null {
  const known = getKnownFaces();
  if (known.length === 0) return null;
  let bestName: string | null = null;
  let bestDist = Infinity;
  for (const kf of known) {
    let sum = 0;
    for (let i = 0; i < descriptor.length; i++) {
      sum += (descriptor[i] - kf.descriptor[i]) ** 2;
    }
    const dist = Math.sqrt(sum);
    if (dist < bestDist) { bestDist = dist; bestName = kf.name; }
  }
  return bestDist < threshold ? bestName : null;
}

// ---- Lazy-loaded models ----
let cocoModel: any = null;
let cocoPromise: Promise<void> | null = null;
let faceApiModule: any = null;
let faceApiReady = false;
let faceApiPromise: Promise<void> | null = null;

const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

async function loadCocoModel() {
  if (cocoModel) return;
  if (cocoPromise) return cocoPromise;
  cocoPromise = (async () => {
    try {
      console.log('[AI] Loading COCO-SSD...');
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      console.log('[AI] COCO-SSD ready!');
    } catch (err) {
      console.error('[AI] COCO-SSD failed:', err);
      cocoPromise = null;
    }
  })();
  return cocoPromise;
}

async function loadFaceApi() {
  if (faceApiReady) return;
  if (faceApiPromise) return faceApiPromise;
  faceApiPromise = (async () => {
    try {
      console.log('[AI] Loading face recognition...');
      faceApiModule = await import('@vladmandic/face-api');
      await faceApiModule.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
      await faceApiModule.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL);
      await faceApiModule.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL);
      faceApiReady = true;
      console.log('[AI] Face recognition ready!');
    } catch (err) {
      console.error('[AI] Face recognition failed to load:', err);
      faceApiPromise = null;
    }
  })();
  return faceApiPromise;
}

// Try to recognize faces within a detected person region
async function recognizeFace(imgElement: HTMLImageElement): Promise<{ matchedName: string | null; descriptor: Float32Array | null }> {
  if (!faceApiReady || !faceApiModule) return { matchedName: null, descriptor: null };
  try {
    const detection = await faceApiModule
      .detectSingleFace(imgElement, new faceApiModule.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    if (!detection) return { matchedName: null, descriptor: null };
    const descriptor = detection.descriptor;
    const matchedName = findMatch(descriptor);
    return { matchedName, descriptor };
  } catch {
    return { matchedName: null, descriptor: null };
  }
}

export function useObjectDetection() {
  const [detecting, setDetecting] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    loadCocoModel();
    loadFaceApi(); // load in parallel, non-blocking
  }, []);

  const detect = useCallback(async (imgElement: HTMLImageElement): Promise<DetectedObject[]> => {
    await loadCocoModel();
    if (!cocoModel) return [];

    setDetecting(true);
    abortRef.current = false;

    try {
      // Step 1: COCO-SSD object detection
      const predictions = await cocoModel.detect(imgElement, 10, 0.4);
      if (abortRef.current) return [];

      const imgW = imgElement.naturalWidth || imgElement.width;
      const imgH = imgElement.naturalHeight || imgElement.height;

      const objects: DetectedObject[] = predictions.map((pred: any, i: number) => ({
        id: `obj-${i}-${Date.now()}`,
        label: pred.class,
        labelNo: LABEL_NO[pred.class] || pred.class,
        score: pred.score,
        box: {
          x: pred.bbox[0] / imgW,
          y: pred.bbox[1] / imgH,
          width: pred.bbox[2] / imgW,
          height: pred.bbox[3] / imgH,
        },
      }));

      // Step 2: For person detections, try face recognition
      if (faceApiReady) {
        const personObjects = objects.filter(o => o.label === 'person');
        if (personObjects.length > 0) {
          const { matchedName, descriptor } = await recognizeFace(imgElement);
          if (matchedName || descriptor) {
            // Apply to first person (best we can do without per-region face detection)
            personObjects[0].matchedName = matchedName || undefined;
            personObjects[0].faceDescriptor = descriptor || undefined;
          }
          // For additional persons, try to detect multiple faces
          if (personObjects.length > 1 && faceApiModule) {
            try {
              const allFaces = await faceApiModule
                .detectAllFaces(imgElement, new faceApiModule.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
                .withFaceLandmarks(true)
                .withFaceDescriptors();
              // Match each face to closest person box
              for (const face of allFaces) {
                const faceCenterX = (face.detection.box.x + face.detection.box.width / 2) / imgW;
                const faceCenterY = (face.detection.box.y + face.detection.box.height / 2) / imgH;
                // Find which person box contains this face
                for (const pObj of personObjects) {
                  if (!pObj.matchedName && 
                      faceCenterX >= pObj.box.x && faceCenterX <= pObj.box.x + pObj.box.width &&
                      faceCenterY >= pObj.box.y && faceCenterY <= pObj.box.y + pObj.box.height) {
                    const match = findMatch(face.descriptor);
                    pObj.matchedName = match || undefined;
                    pObj.faceDescriptor = face.descriptor;
                    break;
                  }
                }
              }
            } catch { /* face detection for multiple faces failed, continue */ }
          }
        }
      }

      return objects;
    } catch (err: any) {
      console.error('[AI] Detection failed:', err?.message || err);
      return [];
    } finally {
      setDetecting(false);
    }
  }, []);

  const learnFace = useCallback((name: string, descriptor?: Float32Array) => {
    if (descriptor) {
      saveKnownFace(name, descriptor);
      console.log(`[AI] Learned face: ${name} (${getKnownFaces().length} total faces stored)`);
    }
  }, []);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { detecting, detect, learnFace, abort };
}
