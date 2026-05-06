import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Calendar, Image as ImageIcon, Trash2, Edit3, Eye, EyeOff, X, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Album, ImageItem } from './types';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

type SortMode = 'newest' | 'oldest' | 'name' | 'size';

// --- Edit Album Modal ---
function EditAlbumModal({ album, onSave, onCancel }: {
  album?: Album;
  onSave: (data: { title: string; emoji: string; description: string; date: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(album?.title || '');
  const [emoji, setEmoji] = useState(album?.emoji || '📸');
  const [description, setDescription] = useState(album?.description || '');
  const [date, setDate] = useState(album?.date || '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const popularEmojis = ['📸', '🏔️', '🎂', '🌊', '🎄', '🌸', '🎉', '✈️', '🦉', '🏠', '❤️', '🎓', '⚽', '🎵', '🍕', '🐶'];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-serif mb-5">{album ? 'Rediger samling' : 'Ny samling'}</h3>

        {/* Emoji picker */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2 block">Ikon</label>
          <div className="flex flex-wrap gap-1.5">
            {popularEmojis.map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                className={cn("w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                  emoji === e ? "bg-blue-100 ring-2 ring-blue-400 scale-110" : "bg-gray-50 hover:bg-gray-100"
                )}>{e}</button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5 block">Tittel</label>
          <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="F.eks. Italia 2024"
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900" />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5 block">Beskrivelse (valgfri)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Noen ord om samlingen..."
            rows={2}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900 resize-none" />
        </div>

        {/* Date */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5 block">Dato (valgfri)</label>
          <input type="month" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors">Avbryt</button>
          <button onClick={() => title.trim() && onSave({ title: title.trim(), emoji, description, date })}
            disabled={!title.trim()}
            className="px-5 py-2.5 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium">
            {album ? 'Lagre' : 'Opprett'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Album Card ---
function AlbumCard({ album, isAdmin, onClick, onEdit, onDelete, onToggleHidden }: {
  album: Album;
  isAdmin: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
}) {
  const imageItems = album.items.filter((i): i is ImageItem => i.type === 'image');
  const coverImage = album.coverImageId
    ? imageItems.find(i => i.id === album.coverImageId)
    : imageItems[0];
  const count = imageItems.length;

  const formatDate = (d?: string) => {
    if (!d) return null;
    try {
      const date = new Date(d + (d.length <= 7 ? '-01' : ''));
      return date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300",
        "aspect-[4/3]",
        album.hidden && "opacity-60"
      )}
    >
      {/* Cover image or gradient */}
      {coverImage ? (
        <>
          <img src={coverImage.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300">
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon size={48} className="text-gray-300" />
          </div>
        </div>
      )}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {album.emoji && <span className="text-2xl drop-shadow-lg">{album.emoji}</span>}
              <h3 className={cn("font-serif text-xl font-medium truncate", coverImage ? "text-white" : "text-gray-800")}>
                {album.title}
              </h3>
            </div>
            <div className={cn("flex items-center gap-3 text-sm", coverImage ? "text-white/70" : "text-gray-500")}>
              <span>{count} {count === 1 ? 'bilde' : 'bilder'}</span>
              {album.date && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(album.date)}</span>
                </>
              )}
            </div>
            {album.description && (
              <p className={cn("text-sm mt-1 line-clamp-1", coverImage ? "text-white/60" : "text-gray-400")}>{album.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden badge */}
      {album.hidden && (
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white/80 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full tracking-wider flex items-center gap-1">
          <EyeOff size={10} /> Skjult
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
          onClick={e => e.stopPropagation()}>
          <button onClick={onToggleHidden} className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow hover:bg-white transition-colors" title={album.hidden ? 'Vis for Helene' : 'Skjul for Helene'}>
            {album.hidden ? <Eye size={14} className="text-gray-600" /> : <EyeOff size={14} className="text-gray-600" />}
          </button>
          <button onClick={onEdit} className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow hover:bg-white transition-colors" title="Rediger">
            <Edit3 size={14} className="text-gray-600" />
          </button>
          <button onClick={onDelete} className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow hover:bg-red-50 transition-colors" title="Slett">
            <Trash2 size={14} className="text-red-500" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// --- Main AlbumGrid ---
export default function AlbumGrid({ albums, isAdmin, onSelectAlbum, onCreateAlbum, onUpdateAlbum, onDeleteAlbum }: {
  albums: Album[];
  isAdmin: boolean;
  onSelectAlbum: (id: string) => void;
  onCreateAlbum: (data: { title: string; emoji: string; description: string; date: string }) => void;
  onUpdateAlbum: (id: string, updates: Partial<Album>) => void;
  onDeleteAlbum: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [showModal, setShowModal] = useState<'create' | Album | null>(null);
  const [albumToDelete, setAlbumToDelete] = useState<string | null>(null);
  const [showSort, setShowSort] = useState(false);

  // Filter & sort
  const visibleAlbums = useMemo(() => {
    let list = isAdmin ? albums : albums.filter(a => !a.hidden);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.emoji || '').includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest': return (b.date || 'z').localeCompare(a.date || 'z');
        case 'oldest': return (a.date || '').localeCompare(b.date || '');
        case 'name': return a.title.localeCompare(b.title, 'nb');
        case 'size': return b.items.filter(i => i.type === 'image').length - a.items.filter(i => i.type === 'image').length;
        default: return 0;
      }
    });

    return list;
  }, [albums, isAdmin, search, sort]);

  const sortLabels: Record<SortMode, string> = {
    newest: 'Nyeste først',
    oldest: 'Eldste først',
    name: 'Navn A-Å',
    size: 'Flest bilder',
  };

  const totalImages = albums.reduce((sum, a) => sum + a.items.filter(i => i.type === 'image').length, 0);

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-serif text-3xl md:text-4xl text-gray-900 mb-2">Samlinger</h2>
        <p className="text-gray-400 text-sm">
          {albums.length} {albums.length === 1 ? 'samling' : 'samlinger'} • {totalImages} bilder totalt
        </p>
      </div>

      {/* Search + Sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søk i samlinger..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-gray-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 transition-all whitespace-nowrap"
          >
            {sortLabels[sort]}
            <ChevronDown size={14} className={cn("transition-transform", showSort && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showSort && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[160px]">
                {(Object.entries(sortLabels) as [SortMode, string][]).map(([key, label]) => (
                  <button key={key}
                    onClick={() => { setSort(key); setShowSort(false); }}
                    className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors",
                      sort === key ? "text-blue-600 font-medium bg-blue-50/50" : "text-gray-600"
                    )}>{label}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Album Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        <AnimatePresence mode="popLayout">
          {visibleAlbums.map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              isAdmin={isAdmin}
              onClick={() => onSelectAlbum(album.id)}
              onEdit={() => setShowModal(album)}
              onDelete={() => setAlbumToDelete(album.id)}
              onToggleHidden={() => onUpdateAlbum(album.id, { hidden: !album.hidden })}
            />
          ))}

          {/* Add new album card (admin only) */}
          {isAdmin && (
            <motion.div
              layout
              whileHover={{ y: -4 }}
              onClick={() => setShowModal('create')}
              className="group rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-400 cursor-pointer transition-all duration-300 aspect-[4/3] flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                <Plus size={24} className="text-gray-400 group-hover:text-gray-600" />
              </div>
              <span className="text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">Ny samling</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {visibleAlbums.length === 0 && !isAdmin && (
        <div className="text-center py-16 text-gray-400">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-serif">Ingen samlinger ennå</p>
        </div>
      )}

      {search && visibleAlbums.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p>Ingen treff for "{search}"</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <EditAlbumModal
            album={showModal === 'create' ? undefined : showModal}
            onCancel={() => setShowModal(null)}
            onSave={(data) => {
              if (showModal === 'create') {
                onCreateAlbum(data);
              } else {
                onUpdateAlbum(showModal.id, data);
              }
              setShowModal(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {albumToDelete && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-xl font-serif mb-2">Slett samling?</h3>
              <p className="text-sm text-gray-500 mb-6">Alle bilder i samlingen vil også bli slettet. Dette kan ikke angres.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAlbumToDelete(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100">Avbryt</button>
                <button onClick={() => { onDeleteAlbum(albumToDelete); setAlbumToDelete(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Slett</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
