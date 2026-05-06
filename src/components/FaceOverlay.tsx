import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useObjectDetection, type DetectedObject } from '../hooks/useFaceDetection';

interface FaceOverlayProps {
  imageElement: HTMLImageElement | null;
  itemId: string;
  isVisible: boolean;
  onTagPerson: (itemId: string, name: string) => void;
  existingTags?: string[];
  availableTags?: string[];
}

export default function FaceOverlay({ imageElement, itemId, isVisible, onTagPerson, existingTags, availableTags }: FaceOverlayProps) {
  const { detecting, detect, abort } = useObjectDetection();
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [activeObj, setActiveObj] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [tagged, setTagged] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const detectedForRef = useRef<string | null>(null);

  const hasExistingTags = existingTags && existingTags.length > 0;

  // Autocomplete
  const suggestions = useMemo(() => {
    if (!nameInput.trim() || !availableTags) return [];
    const q = nameInput.toLowerCase();
    const current = existingTags || [];
    return availableTags.filter(t => t.toLowerCase().includes(q) && !current.includes(t)).slice(0, 5);
  }, [nameInput, availableTags, existingTags]);

  // Detect objects when hovered (only if NOT already tagged)
  useEffect(() => {
    if (!isVisible || !imageElement) {
      if (!isVisible) abort();
      return;
    }
    // If already tagged, don't bother detecting
    if (hasExistingTags) return;

    const imgSrc = imageElement.src;
    if (detectedForRef.current === imgSrc) return;

    detectedForRef.current = imgSrc;
    detect(imageElement).then(detected => {
      setObjects(detected);
      setTagged(new Set());
      setActiveObj(null);
    });
  }, [isVisible, imageElement, detect, abort, hasExistingTags]);

  const handleTag = useCallback((name: string, objId?: string) => {
    onTagPerson(itemId, name);
    if (objId) setTagged(prev => new Set(prev).add(objId));
    setActiveObj(null);
    setNameInput('');
  }, [onTagPerson, itemId]);

  if (!isVisible) return null;

  // CASE 1: Already tagged → just show existing tags beautifully
  if (hasExistingTags) {
    return (
      <div className="absolute inset-0 z-30 pointer-events-none rounded-xl">
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
          <div className="bg-gradient-to-t from-black/60 via-black/30 to-transparent px-3 pb-2.5 pt-6 rounded-b-xl">
            <div className="flex flex-wrap gap-1.5">
              {existingTags!.map(tag => (
                <span key={tag} className="bg-white/20 backdrop-blur-sm text-[10px] font-medium text-white px-2.5 py-0.5 rounded-full border border-white/10">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CASE 2: Not tagged yet → show detected objects + tagging UI
  const visibleObjects = objects.filter(o => !tagged.has(o.id));

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-visible rounded-xl">
      {/* Object detection boxes */}
      {visibleObjects.map(obj => (
        <div key={obj.id} className="absolute pointer-events-auto"
          style={{
            left: `${obj.box.x * 100}%`,
            top: `${obj.box.y * 100}%`,
            width: `${obj.box.width * 100}%`,
            height: `${obj.box.height * 100}%`,
          }}>
          {/* Detection rectangle */}
          <div className="absolute inset-0 border-2 border-white/70 rounded-md"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.25)' }} />

          {/* Label or input */}
          {activeObj === obj.id || obj.label === 'person' ? (
            // Name input mode (auto-open for persons)
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 min-w-[160px]"
              onClick={e => e.stopPropagation()}>
              <div className="relative">
                <input ref={obj.label === 'person' && activeObj !== obj.id ? undefined : inputRef}
                  value={activeObj === obj.id ? nameInput : ''}
                  onChange={e => { setActiveObj(obj.id); setNameInput(e.target.value); }}
                  onFocus={() => setActiveObj(obj.id)}
                  placeholder={obj.label === 'person' ? '👤 Hvem er dette?' : `${obj.labelNo}...`}
                  autoFocus={activeObj === obj.id}
                  className="w-full text-[11px] px-2.5 py-1.5 bg-black/85 backdrop-blur-sm text-white placeholder-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/40 text-center"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && nameInput.trim()) {
                      handleTag(nameInput.trim(), obj.id);
                    } else if (e.key === 'Escape') {
                      setActiveObj(null); setNameInput('');
                    }
                  }} />
                {activeObj === obj.id && suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white/95 backdrop-blur-md rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                    {suggestions.map(s => (
                      <button key={s} onClick={() => handleTag(s, obj.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-700 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Non-person: Auto-detected label with confirm (Fugl?, Ku?)
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50"
              onClick={e => e.stopPropagation()}>
              <div className="bg-black/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 whitespace-nowrap shadow-xl border border-white/10">
                <span className="text-[10px] text-white/90 font-medium">
                  {'🏷️'} {obj.labelNo}?
                </span>
                <button onClick={() => handleTag(obj.labelNo, obj.id)}
                  className="text-[9px] font-bold bg-green-500/80 hover:bg-green-500 text-white px-2 py-0.5 rounded-full transition-colors">Ja</button>
                <button onClick={() => { setActiveObj(obj.id); setNameInput(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-[9px] font-bold bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-full transition-colors">Endre</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Scanning indicator */}
      {detecting && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[9px] text-white/80 font-medium">Skanner...</span>
        </div>
      )}
    </div>
  );
}
