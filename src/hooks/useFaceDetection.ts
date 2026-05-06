import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
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
  label: string;       // English COCO label
  labelNo: string;     // Norwegian label
  score: number;       // confidence 0-1
  box: { x: number; y: number; width: number; height: number }; // relative 0-1
}

let model: cocoSsd.ObjectDetection | null = null;
let modelPromise: Promise<void> | null = null;

async function loadModel() {
  if (model) return;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      console.log('[ObjectDetection] Loading COCO-SSD model...');
      await tf.ready();
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      console.log('[ObjectDetection] Model ready!');
    } catch (err) {
      console.error('[ObjectDetection] Failed to load model:', err);
      modelPromise = null;
    }
  })();
  return modelPromise;
}

export function useObjectDetection() {
  const [detecting, setDetecting] = useState(false);
  const abortRef = useRef(false);

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

      return predictions.map((pred, i) => ({
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
      console.error('[ObjectDetection] Detection failed:', err?.message || err);
      return [];
    } finally {
      setDetecting(false);
    }
  }, []);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return { detecting, detect, abort };
}
