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
}

// Lazy-loaded model reference
let model: any = null;
let modelPromise: Promise<void> | null = null;

async function loadModel() {
  if (model) return;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      console.log('[AI] Loading TensorFlow + COCO-SSD...');
      // Dynamic import to avoid crashing the app on load
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      console.log('[AI] TensorFlow ready, loading COCO-SSD model...');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      console.log('[AI] COCO-SSD model ready!');
    } catch (err) {
      console.error('[AI] Failed to load model:', err);
      modelPromise = null; // allow retry
    }
  })();
  return modelPromise;
}

export function useObjectDetection() {
  const [detecting, setDetecting] = useState(false);
  const abortRef = useRef(false);

  // Start loading model on mount (non-blocking)
  useEffect(() => { loadModel(); }, []);

  const detect = useCallback(async (imgElement: HTMLImageElement): Promise<DetectedObject[]> => {
    await loadModel();
    if (!model) return [];

    setDetecting(true);
    abortRef.current = false;

    try {
      const predictions = await model.detect(imgElement, 10, 0.4);
      if (abortRef.current) return [];

      const imgW = imgElement.naturalWidth || imgElement.width;
      const imgH = imgElement.naturalHeight || imgElement.height;

      return predictions.map((pred: any, i: number) => ({
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
    } catch (err: any) {
      console.error('[AI] Detection failed:', err?.message || err);
      return [];
    } finally {
      setDetecting(false);
    }
  }, []);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { detecting, detect, abort };
}
