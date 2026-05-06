import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFaceDetection, type DetectedFace } from '../hooks/useFaceDetection';

interface FaceOverlayProps {
  imageElement: HTMLImageElement | null;
  itemId: string;
  isVisible: boolean;
  onTagPerson: (itemId: string, name: string) => void;
  existingTags?: string[];
  availableTags?: string[]; // all known tags for autocomplete
}

export default function FaceOverlay({ imageElement, itemId, isVisible, onTagPerson, existingTags, availableTags }: FaceOverlayProps) {
  const { detecting, detectFaces, learnFace, abort } = useFaceDetection();
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [activeFace, setActiveFace] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [tagValue, setTagValue] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const detectedForRef = useRef<string | null>(null);
  
  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!tagValue.trim() || !availableTags) return [];
    const q = tagValue.toLowerCase();
    const current = existingTags || [];
    return availableTags.filter(t => t.toLowerCase().includes(q) && !current.includes(t)).slice(0, 5);
  }, [tagValue, availableTags, existingTags]);

  // Run face detection when visible
  useEffect(() => {
    if (!isVisible || !imageElement) {
      if (!isVisible) abort();
      return;
    }
    
    const imgSrc = imageElement.src;
    if (detectedForRef.current === imgSrc) return;
    
    detectedForRef.current = imgSrc;
    detectFaces(imageElement).then(detected => {
      setFaces(detected);
      setDismissed(new Set());
      setActiveFace(null);
    });
  }, [isVisible, imageElement, detectFaces, abort]);

  const handleConfirmFace = useCallback((face: DetectedFace, name: string) => {
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

  const handleAddTag = useCallback((name: string) => {
    onTagPerson(itemId, name);
    setTagValue('');
    setShowTagInput(false);
  }, [onTagPerson, itemId]);

  if (!isVisible) return null;

  const visibleFaces = faces.filter(f => !dismissed.has(f.id));
  const hasExistingTags = existingTags && existingTags.length > 0;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-visible rounded-xl">
      {/* Face detection boxes (bonus when AI detects faces) */}
      {visibleFaces.map(face => (
        <div key={face.id} className="absolute pointer-events-auto"
          style={{
            left: `${face.box.x * 100}%`,
            top: `${face.box.y * 100}%`,
            width: `${face.box.width * 100}%`,
            height: `${face.box.height * 100}%`,
          }}>
          <div className="absolute inset-0 border-2 border-white/80 rounded-md" 
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)' }} />
          
          {activeFace === face.id ? (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 min-w-[140px]"
              onClick={e => e.stopPropagation()}>
              <input ref={inputRef} value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder="Skriv navn..."
                autoFocus
                className="w-full text-[11px] px-2 py-1.5 bg-black/80 backdrop-blur-sm text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40 text-center"
                onKeyDown={e => {
                  if (e.key === 'Enter' && nameInput.trim()) {
                    handleConfirmFace(face, nameInput.trim());
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
                <button onClick={() => handleConfirmFace(face, face.matchedName!)}
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

      {/* ALWAYS-VISIBLE TAG BAR at bottom (works for people from behind, animals, objects) */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto" onClick={e => e.stopPropagation()}>
        {showTagInput ? (
          <div className="px-2 pb-2">
            <div className="relative">
              <input ref={tagInputRef} value={tagValue} onChange={e => setTagValue(e.target.value)}
                placeholder="Skriv navn, sted, ting..."
                autoFocus
                className="w-full text-xs px-3 py-2 bg-black/75 backdrop-blur-md text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40"
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagValue.trim()) {
                    handleAddTag(tagValue.trim());
                  } else if (e.key === 'Escape') {
                    setShowTagInput(false);
                    setTagValue('');
                  }
                }} />
              {/* Autocomplete dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white/95 backdrop-blur-md rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => handleAddTag(s)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-700 flex items-center gap-1.5 transition-colors">
                      <span className="text-gray-400 text-[10px]">{'🏷️'}</span> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-2 pb-2 flex items-center gap-1.5">
            <button onClick={() => { setShowTagInput(true); setTagValue(''); setTimeout(() => tagInputRef.current?.focus(), 50); }}
              className="text-[10px] font-medium text-white/90 hover:text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full transition-all flex items-center gap-1 shadow-md">
              {'🏷️'} {hasExistingTags ? 'Legg til tagg' : 'Hvem/hva er dette?'}
            </button>
          </div>
        )}
      </div>
      
      {/* Scanning indicator */}
      {detecting && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1.5 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[9px] text-white/80 font-medium">Skanner...</span>
        </div>
      )}
    </div>
  );
}
