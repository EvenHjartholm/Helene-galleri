import { useState, useEffect, useRef, useCallback } from 'react';
import { useFaceDetection, type DetectedFace } from '../hooks/useFaceDetection';

interface FaceOverlayProps {
  imageElement: HTMLImageElement | null;
  itemId: string;
  isVisible: boolean;
  onTagPerson: (itemId: string, name: string) => void;
  existingTags?: string[];
}

export default function FaceOverlay({ imageElement, itemId, isVisible, onTagPerson, existingTags }: FaceOverlayProps) {
  const { isReady, detecting, detectFaces, learnFace, abort } = useFaceDetection();
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [activeFace, setActiveFace] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showGeneralTag, setShowGeneralTag] = useState(false);
  const [generalTagValue, setGeneralTagValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const generalInputRef = useRef<HTMLInputElement>(null);
  const detectedForRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!isVisible || !isReady || !imageElement) {
      if (!isVisible) abort();
      return;
    }
    
    const imgSrc = imageElement.src;
    if (detectedForRef.current === imgSrc) return;
    
    detectedForRef.current = imgSrc;
    setScanDone(false);
    detectFaces(imageElement).then(detected => {
      setFaces(detected);
      setDismissed(new Set());
      setActiveFace(null);
      setScanDone(true);
      setShowGeneralTag(false);
    });
  }, [isVisible, isReady, imageElement, detectFaces, abort]);

  const handleConfirm = useCallback((face: DetectedFace, name: string) => {
    learnFace(name, face.descriptor);
    onTagPerson(itemId, name);
    setDismissed(prev => new Set(prev).add(face.id));
    setActiveFace(null);
    setNameInput('');
  }, [learnFace, onTagPerson, itemId]);

  const handleDismiss = useCallback((faceId: string) => {
    setDismissed(prev => new Set(prev).add(faceId));
    setActiveFace(null);
    setNameInput('');
  }, []);

  if (!isVisible) return null;

  const visibleFaces = faces.filter(f => !dismissed.has(f.id));
  const hasExistingTags = existingTags && existingTags.length > 0;
  const noFacesFound = scanDone && faces.length === 0;

  return (
    <div className="absolute inset-0 z-25 pointer-events-none">
      {/* Face boxes */}
      {visibleFaces.map(face => (
        <div key={face.id} className="absolute pointer-events-auto"
          style={{
            left: `${face.box.x * 100}%`,
            top: `${face.box.y * 100}%`,
            width: `${face.box.width * 100}%`,
            height: `${face.box.height * 100}%`,
          }}>
          <div className="absolute inset-0 border-2 border-white/70 rounded-md shadow-lg" 
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)' }} />
          
          {activeFace === face.id ? (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 min-w-[140px]"
              onClick={e => e.stopPropagation()}>
              <input ref={inputRef} value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder="Skriv navn..."
                autoFocus
                className="w-full text-[11px] px-2 py-1.5 bg-black/80 backdrop-blur-sm text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40 text-center"
                onKeyDown={e => {
                  if (e.key === 'Enter' && nameInput.trim()) {
                    handleConfirm(face, nameInput.trim());
                  } else if (e.key === 'Escape') {
                    handleDismiss(face.id);
                  }
                }} />
            </div>
          ) : face.matchedName ? (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50"
              onClick={e => e.stopPropagation()}>
              <div className="bg-black/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 whitespace-nowrap shadow-xl border border-white/10">
                <span className="text-[10px] text-white/90 font-medium">{face.matchedName}?</span>
                <button onClick={() => handleConfirm(face, face.matchedName!)}
                  className="text-[9px] font-bold bg-green-500/80 hover:bg-green-500 text-white px-2 py-0.5 rounded-full transition-colors">Ja</button>
                <button onClick={() => { setActiveFace(face.id); setNameInput(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-[9px] font-bold bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-full transition-colors">Nei</button>
              </div>
            </div>
          ) : (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50"
              onClick={e => e.stopPropagation()}>
              <button onClick={() => { setActiveFace(face.id); setNameInput(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="bg-black/80 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] font-medium text-white/90 hover:text-white whitespace-nowrap shadow-xl border border-white/10 transition-colors">
                Hvem er dette?
              </button>
            </div>
          )}
        </div>
      ))}

      {/* General tag option when no faces found (for cows, landscapes, etc.) */}
      {noFacesFound && !hasExistingTags && !showGeneralTag && (
        <div className="absolute bottom-2 left-2 right-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setShowGeneralTag(true); setGeneralTagValue(''); setTimeout(() => generalInputRef.current?.focus(), 50); }}
            className="text-[10px] font-medium text-white/80 hover:text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full transition-colors flex items-center gap-1">
            🏷️ Hva er dette?
          </button>
        </div>
      )}

      {/* General tag input */}
      {showGeneralTag && (
        <div className="absolute bottom-2 left-2 right-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
          <input ref={generalInputRef} value={generalTagValue} onChange={e => setGeneralTagValue(e.target.value)}
            placeholder="Skriv hva det er..."
            autoFocus
            className="w-full text-xs px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40"
            onKeyDown={e => {
              if (e.key === 'Enter' && generalTagValue.trim()) {
                onTagPerson(itemId, generalTagValue.trim());
                setShowGeneralTag(false);
                setGeneralTagValue('');
              } else if (e.key === 'Escape') {
                setShowGeneralTag(false);
              }
            }} />
        </div>
      )}
      
      {/* Loading indicator */}
      {detecting && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1.5 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[9px] text-white/80 font-medium">Skanner...</span>
        </div>
      )}
    </div>
  );
}
