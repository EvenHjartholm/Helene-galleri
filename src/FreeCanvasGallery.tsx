import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, GripHorizontal, Trash2, Maximize2, AlignLeft, AlignCenter, AlignRight, FolderPlus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getTinyUrl } from './hooks/useGallerySync';
import type { GalleryItem, ImageItem, TextSize, Album } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SIZE_CLASSES: Record<TextSize, string> = {
  sm: "text-xs md:text-sm text-gray-500 font-normal",
  md: "text-base md:text-lg text-gray-800 font-medium",
  lg: "text-xl md:text-3xl text-gray-900 font-serif italic"
};

// Auto-layout for items without positions
function autoLayoutItems(items: GalleryItem[]): GalleryItem[] {
  const cols = 4;
  const itemW = 23;
  const gapX = 2;
  const rowH = 320;
  let needsUpdate = false;
  const result = items.map((item, i) => {
    if (item.x !== undefined && item.y !== undefined && item.w !== undefined) return item;
    needsUpdate = true;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { ...item, x: 1 + col * (itemW + gapX), y: 20 + row * (rowH + 20), w: itemW };
  });
  return needsUpdate ? result : items;
}

interface DragState {
  itemId: string;
  startMouseX: number;
  startMouseY: number;
  startItemX: number;
  startItemY: number;
  type: 'move' | 'resize';
  startW?: number;
}

// Inline editable text (simplified version for this module)
function EditableText({ text, onSave, isAdmin, className, multiline = false, placeholder = "Klikk for å redigere..." }: {
  text: string; onSave: (val: string) => void; isAdmin: boolean; className?: string; multiline?: boolean; placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(text);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  useEffect(() => { setValue(text); }, [text]);
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);
  const handleSave = () => { onSave(value); setIsEditing(false); };

  if (isEditing && isAdmin) {
    const cls = cn("w-full bg-white/80 border border-blue-300 rounded p-1 outline-none focus:ring-2 ring-blue-100 placeholder:text-gray-300", className);
    return multiline ? (
      <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={value} onChange={e => setValue(e.target.value)} onBlur={handleSave} className={cls} rows={Math.max(2, value.split('\n').length)} />
    ) : (
      <input ref={inputRef as React.RefObject<HTMLInputElement>} value={value} onChange={e => setValue(e.target.value)} onBlur={handleSave} onKeyDown={e => e.key === 'Enter' && handleSave()} className={cls} placeholder={placeholder} />
    );
  }
  if (!text && !isAdmin) return null;
  return (
    <div onClick={e => { if (isAdmin) { e.stopPropagation(); setIsEditing(true); } }}
      className={cn("relative transition-all rounded py-0.5 border border-transparent", isAdmin && "cursor-text hover:bg-blue-50/50 hover:border-blue-200/50 min-h-[1.5em] min-w-[50px]", !text && isAdmin && "bg-gray-50/50", className)}>
      {text || (isAdmin ? <span className="text-gray-300 italic text-sm select-none">{placeholder}</span> : null)}
    </div>
  );
}

function SizeControl({ current, onChange, label }: { current?: TextSize; onChange: (s: TextSize) => void; label?: string }) {
  return (
    <div className="flex items-center gap-1 bg-gray-50 rounded p-0.5 border border-gray-200">
      {label && <span className="text-[10px] uppercase font-bold text-gray-400 px-1">{label}</span>}
      {(['sm', 'md', 'lg'] as const).map(size => (
        <button key={size} onClick={e => { e.stopPropagation(); onChange(size); }}
          className={cn("w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold transition-colors uppercase",
            (current || 'md') === size ? "bg-white shadow text-blue-600" : "text-gray-400 hover:text-gray-600")}>{size.charAt(0)}</button>
      ))}
    </div>
  );
}

// --- LIGHTBOX (rendered via Portal to escape z-index stacking) ---
function Lightbox({ images, currentIndex, onClose, onNext, onPrev }: { images: ImageItem[]; currentIndex: number; onClose: () => void; onNext: () => void; onPrev: () => void }) {
  const img = images[currentIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', handleKey);
    // Prevent body scroll while lightbox is open
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onNext, onPrev]);

  const content = (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-md"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      {/* ✕ CLOSE BUTTON — large, solid, always visible */}
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        className="absolute top-5 right-5 flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-200 pl-4 pr-5 py-3 rounded-full shadow-2xl transition-all font-semibold text-sm"
        style={{ zIndex: 100000 }}
      >
        <X size={20} strokeWidth={2.5} />
        Lukk
      </button>

      {/* Prev/Next */}
      <button onClick={e => { e.stopPropagation(); onPrev(); }}
        className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 md:p-4 rounded-full hover:bg-white/10 transition-all"
        style={{ zIndex: 100000 }}>
        <ChevronLeft size={36} strokeWidth={1.5} />
      </button>
      <button onClick={e => { e.stopPropagation(); onNext(); }}
        className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 md:p-4 rounded-full hover:bg-white/10 transition-all"
        style={{ zIndex: 100000 }}>
        <ChevronRight size={36} strokeWidth={1.5} />
      </button>

      {/* Image */}
      <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-16 pb-28 relative" onClick={e => e.stopPropagation()}>
        <motion.div key={img.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative max-h-full max-w-full flex justify-center">
          <img src={img.largeUrl} alt={img.altText} className="max-h-[80vh] md:max-h-[88vh] w-auto object-contain rounded select-none shadow-2xl" />
        </motion.div>

        {/* Bottom info bar */}
        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
          <div className="inline-flex flex-col items-center pointer-events-auto bg-black/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
            {img.title && <h3 className="text-white text-lg font-serif italic mb-1">{img.title}</h3>}
            {img.caption && <p className="text-white/80 text-sm mb-2 max-w-md text-center">{img.caption}</p>}
            <div className="flex items-center gap-4">
              <a href={img.originalUrl} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-white/60 hover:text-white transition-colors"><Download size={14} /> Last ned</a>
              <span className="text-white/20">•</span>
              <span className="text-xs text-white/40">{currentIndex + 1} / {images.length}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return ReactDOM.createPortal(content, document.body);
}

// --- MAIN GALLERY CANVAS ---
export default function FreeCanvasGallery({
  isAdmin, items, imageItems, onUpdateItem, onDeleteItem,
  lightboxIndex, setLightboxIndex, openLightbox,
  albums, onAddToAlbum
}: {
  isAdmin: boolean;
  items: GalleryItem[];
  imageItems: ImageItem[];
  onUpdateItem: (id: string, updates: Partial<GalleryItem>) => void;
  onDeleteItem: (id: string) => void;
  lightboxIndex: number | null;
  setLightboxIndex: (i: number | null) => void;
  openLightbox: (img: ImageItem) => void;
  albums?: Album[];
  onAddToAlbum?: (imageItem: ImageItem, albumId: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [albumDropdown, setAlbumDropdown] = useState<string | null>(null); // item id

  // Calculate canvas height from item positions
  const canvasHeight = useMemo(() => {
    if (items.length === 0) return 600;
    const lowest = Math.max(...items.map(item => (item.y ?? 0) + (item.type === 'text' ? 120 : 350)));
    return Math.max(600, lowest + 80);
  }, [items]);

  // Pointer move/up for drag
  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - dragState.startMouseX;
      const dy = e.clientY - dragState.startMouseY;
      if (dragState.type === 'move') {
        const newX = Math.max(0, Math.min(dragState.startItemX + (dx / rect.width) * 100, 90));
        const newY = Math.max(0, dragState.startItemY + dy);
        onUpdateItem(dragState.itemId, { x: newX, y: newY });
      } else {
        const newW = Math.max(10, Math.min((dragState.startW || 23) + (dx / rect.width) * 100, 100));
        onUpdateItem(dragState.itemId, { w: newW });
      }
    };
    const handleUp = () => setDragState(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
  }, [dragState, onUpdateItem]);

  const startDrag = (e: React.PointerEvent, item: GalleryItem, type: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      itemId: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startItemX: item.x ?? 0,
      startItemY: item.y ?? 0,
      type,
      startW: item.w ?? 23,
    });
  };

  const nextImage = useCallback(() => { setLightboxIndex(lightboxIndex === null ? null : (lightboxIndex + 1) % imageItems.length); }, [lightboxIndex, imageItems.length, setLightboxIndex]);
  const prevImage = useCallback(() => { setLightboxIndex(lightboxIndex === null ? null : (lightboxIndex - 1 + imageItems.length) % imageItems.length); }, [lightboxIndex, imageItems.length, setLightboxIndex]);

  return (
    <>
      {/* FREE CANVAS */}
      <div
        ref={canvasRef}
        className="relative w-full select-none"
        style={{ minHeight: `${canvasHeight}px` }}
      >
        {/* Grid guide lines (admin only) */}
        {isAdmin && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '25% 100px' }} />
        )}

        {items.map((item) => {
          const isDragging = dragState?.itemId === item.id;
          const x = item.x ?? 0;
          const y = item.y ?? 0;
          const w = item.w ?? 23;

          return (
            <div
              key={item.id}
              className={cn("absolute group", isDragging && "z-50 opacity-80")}
              style={{
                left: `${x}%`,
                top: `${y}px`,
                width: `${w}%`,
                transition: isDragging ? 'none' : 'left 0.25s ease, top 0.25s ease, width 0.25s ease',
              }}
            >
              {/* DRAG HANDLE (admin) */}
              {isAdmin && (
                <div
                  onPointerDown={e => startDrag(e, item, 'move')}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200/80 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5"
                >
                  <GripHorizontal size={12} className="text-gray-400" />
                  <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Flytt</span>
                </div>
              )}

              {/* CONTENT */}
              {item.type === 'text' ? (
                <div className="p-4 md:p-6 flex items-center justify-center flex-col relative">
                  <div className={cn("w-full",
                    item.align === 'left' ? "text-left" : item.align === 'right' ? "text-right" : "text-center",
                    isAdmin && "border border-dashed border-gray-300/60 hover:border-gray-400 rounded-xl p-3 bg-white/30"
                  )}>
                    <EditableText text={item.content} isAdmin={isAdmin} multiline className={SIZE_CLASSES[item.size || 'md']} onSave={val => onUpdateItem(item.id, { content: val })} />
                  </div>
                  {isAdmin && (
                    <div className="absolute -top-3 right-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200/80 rounded-xl p-1 z-40" onPointerDown={e => e.stopPropagation()}>
                      <button onClick={() => onUpdateItem(item.id, { align: 'left' })} className={cn("p-1 rounded hover:bg-gray-100", item.align === 'left' && "text-blue-500")}><AlignLeft size={12} /></button>
                      <button onClick={() => onUpdateItem(item.id, { align: 'center' })} className={cn("p-1 rounded hover:bg-gray-100", (!item.align || item.align === 'center') && "text-blue-500")}><AlignCenter size={12} /></button>
                      <button onClick={() => onUpdateItem(item.id, { align: 'right' })} className={cn("p-1 rounded hover:bg-gray-100", item.align === 'right' && "text-blue-500")}><AlignRight size={12} /></button>
                      <div className="w-px h-4 bg-gray-200" />
                      <SizeControl current={item.size} onChange={s => onUpdateItem(item.id, { size: s })} />
                      <div className="w-px h-4 bg-gray-200" />
                      <button onClick={() => setItemToDelete(item.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative" onClick={() => !isAdmin && openLightbox(item as ImageItem)}>
                  <div className={cn("relative overflow-hidden bg-gray-100 shadow-md transition-all duration-300 rounded-xl", !isAdmin && "hover:shadow-2xl cursor-zoom-in")}>
                    {/* Blur placeholder */}
                    <img src={getTinyUrl(item.originalUrl)} alt="" fetchPriority="high" decoding="async"
                      className="absolute inset-0 w-full h-full object-cover blur-xl scale-110"
                      onError={e => { if (e.currentTarget.src !== item.originalUrl) e.currentTarget.src = item.originalUrl; }} />
                    {/* Main image */}
                    <img src={item.thumbnailUrl} alt={item.altText || ""} loading="eager" decoding="async"
                      className="w-full h-auto object-cover relative z-10 opacity-0 transition-opacity duration-500"
                      onLoad={e => e.currentTarget.classList.remove('opacity-0')}
                      onError={e => { if (e.currentTarget.src !== item.originalUrl) { e.currentTarget.src = item.originalUrl; e.currentTarget.classList.remove('opacity-0'); } }} />
                    {!isAdmin && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 z-20" />}
                  </div>
                  {/* Caption area */}
                  {(item.title || item.caption || isAdmin) && (
                    <div className={cn("bg-white/50 backdrop-blur-sm pt-2 pb-2 px-3 rounded-b-xl border-x border-b border-white/50 -mt-3 relative z-20", isAdmin && "bg-white/80 border-gray-200/50")}>
                      <EditableText text={item.title || ""} isAdmin={isAdmin} placeholder="Tittel..." className={cn("block w-full text-center", SIZE_CLASSES[item.titleSize || 'lg'])} onSave={val => onUpdateItem(item.id, { title: val })} />
                      <EditableText text={item.caption || ""} isAdmin={isAdmin} multiline placeholder="Beskrivelse..." className={cn("block w-full text-center leading-relaxed", SIZE_CLASSES[item.captionSize || 'sm'])} onSave={val => onUpdateItem(item.id, { caption: val })} />
                    </div>
                  )}
                  {/* Admin: delete + text size controls */}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-all" onPointerDown={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm shadow-lg rounded-lg p-1 border border-gray-200/80">
                        <SizeControl label="T" current={item.titleSize || 'lg'} onChange={s => onUpdateItem(item.id, { titleSize: s })} />
                        <div className="w-px h-4 bg-gray-200" />
                        {/* Add to album */}
                        {albums && albums.length > 0 && onAddToAlbum && (
                          <div className="relative">
                            <button onClick={() => setAlbumDropdown(albumDropdown === item.id ? null : item.id)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Legg i samling">
                              <FolderPlus size={12} />
                            </button>
                            {albumDropdown === item.id && (
                              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 min-w-[180px]">
                                <div className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider border-b border-gray-100">Legg i samling</div>
                                {albums.map(a => (
                                  <button key={a.id} onClick={() => { onAddToAlbum(item as ImageItem, a.id); setAlbumDropdown(null); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                    <span>{a.emoji || '📁'}</span>
                                    <span className="truncate">{a.title}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button onClick={() => setItemToDelete(item.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RESIZE HANDLE (admin, bottom-right) */}
              {isAdmin && (
                <div
                  onPointerDown={e => startDrag(e, item, 'resize')}
                  className="absolute bottom-1 right-1 z-30 w-5 h-5 flex items-center justify-center cursor-se-resize opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur-sm rounded shadow border border-gray-200/80"
                >
                  <Maximize2 size={10} className="text-gray-400 rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-xl font-serif mb-2">Slett element?</h3>
            <p className="text-sm text-gray-500 mb-6">Er du sikker? Dette kan ikke angres.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setItemToDelete(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100">Avbryt</button>
              <button onClick={() => { onDeleteItem(itemToDelete); setItemToDelete(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Slett</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && <Lightbox images={imageItems} currentIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} onNext={nextImage} onPrev={prevImage} />}
      </AnimatePresence>
    </>
  );
}

export { autoLayoutItems };
