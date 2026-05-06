import * as faceapi from '@vladmandic/face-api';
import { useState, useEffect, useCallback, useRef } from 'react';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1/model';
const STORAGE_KEY = 'hs-gallery-known-faces';
const MATCH_THRESHOLD = 0.5; // lower = stricter match

export interface DetectedFace {
  id: string;
  box: { x: number; y: number; width: number; height: number }; // relative to image (0-1)
  matchedName: string | null;
  matchDistance: number;
  descriptor: Float32Array;
}

interface KnownFace {
  name: string;
  descriptors: number[][]; // stored as plain arrays for JSON serialization
}

let modelsLoaded = false;
let modelsLoading = false;

async function loadModels() {
  if (modelsLoaded || modelsLoading) return;
  modelsLoading = true;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  } catch (err) {
    console.error('Failed to load face-api models:', err);
  }
  modelsLoading = false;
}

function getKnownFaces(): KnownFace[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveKnownFaces(faces: KnownFace[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
}

function findBestMatch(descriptor: Float32Array, knownFaces: KnownFace[]): { name: string; distance: number } | null {
  let bestMatch: { name: string; distance: number } | null = null;
  
  for (const known of knownFaces) {
    for (const desc of known.descriptors) {
      const knownDesc = new Float32Array(desc);
      const distance = faceapi.euclideanDistance(descriptor, knownDesc);
      if (distance < MATCH_THRESHOLD && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { name: known.name, distance };
      }
    }
  }
  return bestMatch;
}

export function useFaceDetection() {
  const [isReady, setIsReady] = useState(modelsLoaded);
  const [detecting, setDetecting] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    loadModels().then(() => setIsReady(true));
  }, []);

  const detectFaces = useCallback(async (imgElement: HTMLImageElement): Promise<DetectedFace[]> => {
    if (!modelsLoaded) return [];
    
    setDetecting(true);
    abortRef.current = false;
    
    try {
      const detections = await faceapi
        .detectAllFaces(imgElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.6 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();

      if (abortRef.current) return [];
      
      const knownFaces = getKnownFaces();
      const imgW = imgElement.naturalWidth || imgElement.width;
      const imgH = imgElement.naturalHeight || imgElement.height;
      
      return detections.map((det, i) => {
        const box = det.detection.box;
        const match = findBestMatch(det.descriptor, knownFaces);
        
        return {
          id: `face-${i}-${Date.now()}`,
          box: {
            x: box.x / imgW,
            y: box.y / imgH,
            width: box.width / imgW,
            height: box.height / imgH,
          },
          matchedName: match?.name || null,
          matchDistance: match?.distance || 1,
          descriptor: det.descriptor,
        };
      });
    } catch (err) {
      console.error('Face detection failed:', err);
      return [];
    } finally {
      setDetecting(false);
    }
  }, []);

  const learnFace = useCallback((name: string, descriptor: Float32Array) => {
    const knownFaces = getKnownFaces();
    const existing = knownFaces.find(f => f.name === name);
    if (existing) {
      // Add descriptor (keep max 5 per person for performance)
      if (existing.descriptors.length < 5) {
        existing.descriptors.push(Array.from(descriptor));
      }
    } else {
      knownFaces.push({ name, descriptors: [Array.from(descriptor)] });
    }
    saveKnownFaces(knownFaces);
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { isReady, detecting, detectFaces, learnFace, abort };
}
