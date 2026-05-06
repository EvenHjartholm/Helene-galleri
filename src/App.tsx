import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Plus, Trash2, Save, Image as ImageIcon, Type, LogOut, FilePlus, ArrowLeft, ArrowRight, Settings, Eye, EyeOff, Home, FolderOpen, PanelLeft, PanelLeftClose } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';
import { useGallerySync } from './hooks/useGallerySync';
import type { Page, GalleryItem, ImageItem, TextItem, Album } from './types';
import FreeCanvasGallery, { autoLayoutItems } from './FreeCanvasGallery';


// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---




// --- Helpers ---
// Simple blob fetcher for local assets


const DEFAULT_ITEMS: GalleryItem[] = [
  {
    type: 'image',
    id: "1",
    thumbnailUrl: "https://images.unsplash.com/photo-1490750967868-58cb75063ed4?q=80&w=800&auto=format&fit=crop",
    largeUrl: "https://images.unsplash.com/photo-1490750967868-58cb75063ed4?q=80&w=1600&auto=format&fit=crop",
    originalUrl: "https://images.unsplash.com/photo-1490750967868-58cb75063ed4?q=80&w=2400&auto=format&fit=crop",
    title: "Morgenlys",
    titleSize: 'lg',
    caption: "Tatt i studio kl. 08:30 med naturlig lys fra øst.",
    captionSize: 'sm',
    altText: "Portrett i morgenlys",
    width: 3,
    height: 4
  },
  {
    type: 'image',
    id: "2",
    thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop",
    largeUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1600&auto=format&fit=crop",
    originalUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2400&auto=format&fit=crop",
    title: "",
    caption: "Naturlig uttrykk",
    captionSize: 'md',
    altText: "Kvinneportrett med hatt",
    width: 2,
    height: 3
  },
  {
    type: 'text',
    id: "txt1",
    content: "En samling av øyeblikk fanget i det vakreste lyset. Hvert bilde forteller sin egen lille historie.",
    align: 'center',
    size: 'lg'
  },
];

// SIZE_CLASSES, SizeControl, EditableText moved to FreeCanvasGallery.tsx

// autoLayoutItems is imported from FreeCanvasGallery

// --- Helpers ---

// Hardcoded list to ensure it works regardless of Vite glob issues
const AVAILABLE_IMAGES = [
  "B0007246-Edit-2.jpg", "B0007289-2.jpg", "B0007717 (2).jpg", "B0007868-2.jpg", 
  "B0007916.jpg", "B0008126.jpg", "B0008133.jpg", "B0008579-2.jpg", "B0008927.jpg", 
  "B0008939.jpg", "B0008949.jpg", "B0008964.jpg", "B0008985.jpg", "B0008988.jpg", 
  "_T6A5873-2.jpg", "_T6A5894-2.jpg", "_T6A6564.jpg", "_T6A6566.jpg", "_T6A6593.jpg"
];

// --- Security Helper ---
async function hashPassword(password: string) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-red-50 text-red-900">
           <h1 className="text-2xl font-bold mb-4">Noe gikk galt 😔</h1>
           <p className="mb-4">Her er feilmeldingen:</p>
           <pre className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-2xl text-xs font-mono">
             {this.state.error?.toString()}
             {'\n\n'}
             Stack trace might be in console.
           </pre>
           <button onClick={() => window.location.reload()} className="mt-8 px-6 py-3 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors shadow">
             Last siden på nytt
           </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

function Loader({ className }: { className?: string }) {
  return (
    <div className={cn("inline-block animate-spin rounded-full border-2 border-current border-t-transparent h-4 w-4", className)} />
  );
}

function NoiseTexture() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] mix-blend-multiply" 
         style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
    />
  );
}

function AddImageModal({ 
  onConfirm, 
  onCancel 
}: { 
  onConfirm: (payload: string[] | File[]) => void, 
  onCancel: () => void 
}) {
  const [filenameInput, setFilenameInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const hasDetectedImages = AVAILABLE_IMAGES.length > 0;

  const toggleImage = (imgName: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(imgName)) {
        next.delete(imgName);
      } else {
        next.add(imgName);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImages.size > 0) {
      onConfirm(Array.from(selectedImages));
    } else if (filenameInput.trim()) {
      onConfirm([filenameInput.trim()]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
           <h3 className="text-xl font-serif">Velg bilde(r)</h3>
           <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>
        
        {hasDetectedImages ? (
           <div className="flex-1 overflow-y-auto min-h-[300px] p-1">
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
               {AVAILABLE_IMAGES.map(imgName => {
                 const isSelected = selectedImages.has(imgName);
                 return (
                   <button
                     key={imgName}
                     type="button"
                     onClick={() => toggleImage(imgName)}
                     className={cn(
                       "relative aspect-[4/5] rounded-lg overflow-hidden border-2 transition-all group group-hover:shadow-md",
                       isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent hover:border-gray-200"
                     )}
                   >
                     <img 
                       src={`images/thumbs/${imgName}`} 
                       className="w-full h-full object-cover" 
                       loading="lazy"
                     />
                     <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                       {imgName}
                     </div>
                     {isSelected && (
                       <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                         <div className="bg-blue-500 text-white p-1 rounded-full shadow-sm"><Plus size={16} /></div>
                       </div>
                     )}
                   </button>
                 );
               })}
             </div>
           </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4 p-4 bg-gray-50 rounded text-center">
            Fant ingen bilder i <code>public/images/thumbs</code> automatisk. 
            Prøv å skrive inn navnet manuelt.
          </p>
        )}

        <div className="pt-4 mt-2 border-t border-gray-100">
           <form onSubmit={handleSubmit} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Last opp fra PC</label>
                <input 
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onConfirm(Array.from(e.target.files));
                    }
                  }}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-xs file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    cursor-pointer"
                />
                
                <div className="my-2 text-center text-xs text-gray-300 font-bold uppercase">- ELLER -</div>

                <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Skriv filnavn (hvis i /public/images)</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 text-sm"
                  placeholder="f.eks. sommer.jpg"
                  value={filenameInput}
                  onChange={(e) => {
                    setFilenameInput(e.target.value);
                    setSelectedImages(new Set()); // Clear selection if typing
                  }}
                />
              </div>
              <button 
                type="submit" 
                disabled={!filenameInput.trim() && selectedImages.size === 0}
                className="px-6 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {selectedImages.size > 0 ? `Legg til (${selectedImages.size})` : 'Legg til'}
              </button>
           </form>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmModal({ 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void 
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
      >
        <h3 className="text-xl font-serif mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button 
            type="button" 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Avbryt
          </button>
          <button 
            type="button" 
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-colors"
          >
            Slett
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MessageModal({ 
  title, 
  message, 
  onClose 
}: { 
  title: string, 
  message: string, 
  onClose: () => void 
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left" onClick={(e) => e.stopPropagation()}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100"
      >
        <h3 className="text-xl font-serif mb-4 flex items-center gap-2">
          {title === 'Suksess' ? '✅' : 'ℹ️'} {title}
        </h3>
        <div className="text-sm text-gray-600 mb-6 font-medium whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200 font-mono text-xs">
          {message}
        </div>
        <div className="flex gap-2 justify-end">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold bg-gray-900 text-white rounded-lg hover:bg-gray-800 shadow-sm transition-colors"
          >
            Lukk
          </button>
        </div>
      </motion.div>
    </div>
  );
}



function ChangePasswordModal({
  onClose,
  onUpdate,
  onResetLocal
}: {
  onClose: () => void,
  onUpdate: (type: 'admin' | 'guest', newPass: string) => Promise<void>,
  onResetLocal: () => void
}) {
  const [type, setType] = useState<'admin' | 'guest'>('admin');
  const [newPass, setNewPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass.trim()) return;
    setLoading(true);
    await onUpdate(type, newPass);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left" onClick={(e) => e.stopPropagation()}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 overflow-hidden"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif">Endre passord</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button 
            onClick={() => setType('admin')}
            className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", type === 'admin' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900")}
          >
            Admin (Deg)
          </button>
          <button 
            onClick={() => setType('guest')}
            className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", type === 'guest' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900")}
          >
            Gjest (Helene)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
              Nytt passord for {type === 'admin' ? 'deg' : 'gjester'}
            </label>
            <input 
              type="text" 
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500"
              placeholder="Skriv nytt passord..."
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !newPass.trim()}
            className="w-full py-2.5 text-sm font-bold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader className="text-white/80" /> : "Lagre nytt passord"}
          </button>
        </form>
        
        <div className="mt-8 border-t pt-4">
           <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-gray-400 font-medium hover:text-gray-600 underline">
             {showAdvanced ? "Skjul avansert" : "Vis avanserte verktøy"}
           </button>
           
           {showAdvanced && (
             <div className="mt-4 bg-red-50 p-4 rounded-lg border border-red-100">
               <h4 className="text-xs font-bold uppercase text-red-800 mb-2">Krise-verktøy</h4>
               <p className="text-xs text-red-600 mb-3">Hvis bildene har blitt hvite/borte, prøv denne for å hente tilbake de lokale filene.</p>

               <button 
                 type="button"
                 onClick={() => {
                    // Direct call to avoid confirm() issues for now
                    console.log("Triggering reset...");
                    onResetLocal();
                    onClose();
                 }}
                 className="w-full py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-100 transition-colors"
               >
                 Reparer ødelagte bilder (Reset til lokalt)
               </button>
             </div>
           )}
        </div>
      </motion.div>
    </div>
  );
}



function ConflictModal({ 
  localCount, 
  cloudCount, 
  onKeepLocal, 
  onUseCloud 
}: { 
  localCount: number, 
  cloudCount: number, 
  onKeepLocal: () => void, 
  onUseCloud: () => void 
}) {
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left" onClick={(e) => e.stopPropagation()}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-red-100"
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="bg-orange-100 p-3 rounded-full text-orange-600">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">Ulagrede endringer funnet</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vi fant en versjon på denne maskinen som er annerledes enn den i skyen. Hvilken vil du bruke?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-xs uppercase font-bold text-gray-400 mb-1">Denne maskinen</p>
            <p className="text-2xl font-bold text-gray-900">{localCount} elementer</p>
            <p className="text-xs text-green-600 mt-1 font-medium">Nylig endret</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs uppercase font-bold text-blue-400 mb-1">I skyen</p>
            <p className="text-2xl font-bold text-blue-900">{cloudCount} elementer</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Sist lagret</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={onKeepLocal}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
          >
            Behold mine lokale endringer
          </button>
          <button 
            onClick={onUseCloud}
            className="w-full py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Last ned fra skyen (overskriv)
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- CMS Components ---

// SizeControl, EditableText — now in FreeCanvasGallery.tsx

// --- Free Canvas Item (replaced SortableGalleryItem) ---
// Items are no longer sortable - they use absolute positioning with free drag.

// --- Views ---

function LoginView({ onLogin }: { onLogin: (isAdmin: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  // ... (LoginView logic usually preserved, simplified here to save space if mostly unchanged)
  // Re-implementing simplified to ensure no context loss
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    try {
      const p = password.trim(); // Allow spaces? Maybe trim.
      
      // If Supabase is missing (local dev without env), fallback to unsecured for safety? 
      // User has env now, so we enforce it.
      if (!supabase) {
        // Fallback or error? Let's use old behavior if NO supabase, for safety?
        // No, user assumes security. 
        console.error("Supabase missing in Login");
        // Temp fallback only if really stuck, but user has it.
        // Let's rely on DB.
        alert("Mangler database-tilkobling.");
        setIsLoading(false);
        return;
      }

      const inputHash = await hashPassword(p);
      const { data, error: dbError } = await supabase
        .from('app_settings')
        .select('admin_hash, guest_hash')
        .eq('id', 1)
        .single();

      if (dbError || !data) {
        console.error("Login verification failed:", dbError);
        // Simplified error for user
        alert("Kunne ikke verifisere passord mot databasen.");
        setError(true);
        setIsLoading(false);
        return;
      }

      if (inputHash === data.admin_hash) {
        onLogin(true);
      } else if (inputHash === data.guest_hash) {
        onLogin(false);
      } else {
        // Password mismatch
        setError(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError(true);
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen flex items-center justify-center relative px-4 bg-offwhite">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_#FFFFFF_0%,_#F0F0EE_100%)] z-[-1]" />
      <NoiseTexture />
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-[420px] bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 p-8 md:p-10 relative z-10">
        <div className="flex flex-col items-center text-center space-y-6">
        <div className="space-y-2"><h1 className="font-serif text-3xl md:text-4xl text-gray-900 tracking-tight">Helene sin bildegalleri</h1><p className="text-gray-500 text-sm font-medium tracking-wide uppercase">Fotogalleri</p></div>
          <div className="w-10 h-[1px] bg-gray-200 my-2" />
          <p className="text-gray-600 text-sm leading-relaxed">Skriv inn passordet du har fått tilsendt.</p>
          <form onSubmit={handleSubmit} className="w-full space-y-4 pt-2">
            <div className="space-y-1.5 text-left">
              <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); if(error) setError(false); }} className={cn("w-full bg-gray-50 border px-4 py-3 rounded-xl outline-none transition-all duration-200", error ? "border-red-200 bg-red-50 text-red-900" : "border-gray-200")} placeholder="Passord" />
              {error && <p className="text-red-500 text-xs pl-1">Feil passord.</p>}
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-3.5 rounded-xl font-medium text-sm bg-gray-900 text-white hover:bg-gray-800 transition-all">{isLoading ? <Loader className="text-white/80" /> : "Åpne galleri"}</button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PaginationFooter({ 
  currentPageIndex, 
  totalPages, 
  onNext, 
  onPrev,
  isAdmin,
  onAddPage,
  onDeletePage
}: { 
  currentPageIndex: number, 
  totalPages: number, 
  onNext: () => void, 
  onPrev: () => void,
  isAdmin: boolean,
  onAddPage: () => void,
  onDeletePage: () => void
}) {
  const isLastPage = currentPageIndex === totalPages - 1;
  const isFirstPage = currentPageIndex === 0;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-16 flex items-center justify-between border-t border-gray-200/50 mt-16">
      {/* PREV */}
      <div className="flex-1 flex justify-start">
        {!isFirstPage && (
          <button 
            onClick={onPrev}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors uppercase text-xs font-bold tracking-widest group"
          >
             <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
             Forrige side
          </button>
        )}
      </div>

      {/* INDICATOR */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-serif italic text-gray-400">
          Side {currentPageIndex + 1} av {totalPages}
        </span>
        
        {/* Admin Controls for Pages */}
        {isAdmin && (
           <div className="flex items-center gap-2 mt-2" onPointerDown={(e) => e.stopPropagation()}>
             {isLastPage && (
               <button onClick={onAddPage} className="flex items-center gap-1 bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-colors">
                  <FilePlus size={12} /> Ny side
               </button>
             )}
             {totalPages > 1 && (
               <button onClick={onDeletePage} className="flex items-center gap-1 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-colors">
                  <Trash2 size={12} /> Slett side
               </button>
             )}
           </div>
        )}
      </div>

      {/* NEXT */}
      <div className="flex-1 flex justify-end">
        {!isLastPage ? (
          <button 
            onClick={onNext}
            className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors uppercase text-xs font-bold tracking-widest group"
          >
             Neste side
             <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        ) : (
          /* Placeholder to balance layout */
          <div /> 
        )}
      </div>
    </div>
  );
}

function GalleryView({ 
  isAdmin, 
  pages,
  currentPageIndex,
  albums,
  onLogout,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onChangePage,
  onAddPage,
  onDeletePage,
  onOpenSettings,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  onUpdateAlbumItem,
  onAddAlbumItem,
  onDeleteAlbumItem,
}: { 
  isAdmin: boolean; 
  pages: Page[];
  currentPageIndex: number;
  albums: Album[];
  onLogout: () => void;
  onUpdateItem: (id: string, updates: Partial<GalleryItem>) => void;
  onAddItem: (type: 'image' | 'text', payload?: any) => void;
  onDeleteItem: (id: string) => void;
  onChangePage: (index: number) => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onOpenSettings: () => void;
  onCreateAlbum: (data: { title: string; emoji: string; description: string; date: string }) => void;
  onUpdateAlbum: (id: string, updates: Partial<Album>) => void;
  onDeleteAlbum: (id: string) => void;
  onUpdateAlbumItem: (albumId: string, itemId: string, updates: Partial<GalleryItem>) => void;
  onAddAlbumItem: (albumId: string, type: 'image' | 'text', payload?: any) => void;
  onDeleteAlbumItem: (albumId: string, itemId: string) => void;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showIntros, setShowIntros] = useState(true);
  const [showAddImageModal, setShowAddImageModal] = useState(false);
  const [pageToDelete, setPageToDelete] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);

  // Album lightbox state
  const [albumLightboxIndex, setAlbumLightboxIndex] = useState<number | null>(null);

  const selectedAlbum = selectedAlbumId ? albums.find(a => a.id === selectedAlbumId) : null;
  const albumImageItems = selectedAlbum ? selectedAlbum.items.filter((i): i is ImageItem => i.type === 'image') : [];
  const openAlbumLightbox = (img: ImageItem) => {
    const idx = albumImageItems.findIndex(i => i.id === img.id);
    if (idx !== -1) setAlbumLightboxIndex(idx);
  };

  // When preview is on, hide all admin UI
  const effectiveAdmin = isAdmin && !previewMode;

  const currentPage = pages[currentPageIndex];
  const items = currentPage?.items || [];
  const imageItems = items.filter((item): item is ImageItem => item.type === 'image');

  const openLightbox = (imageItem: ImageItem) => {
    const index = imageItems.findIndex(i => i.id === imageItem.id);
    if(index !== -1) setLightboxIndex(index);
  };

  const visibleAlbums = isAdmin ? albums : albums.filter(a => !a.hidden);

  // Guard clause moved AFTER hooks to satisfy Rules of Hooks
  if (!currentPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center text-gray-500">
         <p>Fant ingen side på denne indeksen.</p>
         <button onClick={() => onChangePage(0)} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded">Gå til start</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite relative overflow-x-hidden">
      <NoiseTexture />
      
      {/* ===== SIDEBAR ===== */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-white border-r border-gray-100 z-50 flex flex-col transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-serif text-lg text-gray-900 font-medium">Samlinger</h2>
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700">
            <PanelLeftClose size={18} />
          </button>
        </div>
        <button onClick={() => { setSelectedAlbumId(null); setSidebarOpen(false); }}
          className={cn("flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-all border-b border-gray-50",
            !selectedAlbumId ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
          )}>
          <Home size={18} /><span>Forside</span>
          {!selectedAlbumId && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </button>
        <div className="flex-1 overflow-y-auto">
          {visibleAlbums.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-300 text-sm">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-40" /><p>Ingen samlinger ennå</p>
            </div>
          )}
          {visibleAlbums.map(album => {
            const imgCount = album.items.filter(i => i.type === 'image').length;
            const isActive = selectedAlbumId === album.id;
            const coverImg = album.items.find((i): i is ImageItem => i.type === 'image');
            return (
              <button key={album.id} onClick={() => { setSelectedAlbumId(album.id); setSidebarOpen(false); }}
                className={cn("w-full flex items-center gap-3 px-5 py-3 text-left transition-all group relative",
                  isActive ? "bg-gray-100" : "hover:bg-gray-50", album.hidden && "opacity-50"
                )}>
                {coverImg ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={coverImg.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">{album.emoji || '📁'}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{album.title}</span>
                    {album.hidden && <EyeOff size={10} className="text-gray-400 flex-shrink-0" />}
                  </div>
                  <span className="text-xs text-gray-400">{imgCount} {imgCount === 1 ? 'bilde' : 'bilder'}</span>
                </div>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                {effectiveAdmin && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => onUpdateAlbum(album.id, { hidden: !album.hidden })}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400" title={album.hidden ? 'Vis' : 'Skjul'}>
                      {album.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button onClick={() => { if (confirm(`Slett "${album.title}"?`)) onDeleteAlbum(album.id); }}
                      className="p-1 rounded hover:bg-red-100 text-red-400"><Trash2 size={12} /></button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {effectiveAdmin && (
          <div className="border-t border-gray-100 p-3">
            <button onClick={() => { setShowCreateAlbum(true); setSidebarOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all">
              <Plus size={16} /> Ny samling
            </button>
          </div>
        )}
      </aside>

      {/* ===== CONTENT WRAPPER (shifts right when sidebar open) ===== */}
      <div className={cn("transition-all duration-300 ease-out pb-24", sidebarOpen ? "ml-[280px]" : "ml-0")}>

      {/* ===== NAV BAR ===== */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100/50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-1 text-gray-400 hover:text-gray-900 rounded-lg transition-all" title={sidebarOpen ? 'Lukk meny' : 'Åpne samlinger'}>
               <PanelLeft size={20} />
             </button>
             <div className="w-px h-6 bg-gray-200" />
             <h1 className="font-serif text-xl text-gray-900 tracking-tight font-medium">
               {selectedAlbum ? (
                 <span className="flex items-center gap-2">{selectedAlbum.emoji && <span>{selectedAlbum.emoji}</span>}{selectedAlbum.title}</span>
               ) : 'Helene sin bildegalleri'}
             </h1>
             {isAdmin && !previewMode && <span className="bg-blue-100 text-blue-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">Admin</span>}
             {previewMode && <span className="bg-purple-100 text-purple-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider animate-pulse">Forhåndsvisning</span>}
          </div>
          <div className="flex items-center gap-3">
             {selectedAlbumId && (
               <button onClick={() => setSelectedAlbumId(null)}
                 className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-all">
                 <ArrowLeft size={12} /> Forside
               </button>
             )}
             {isAdmin && (
               <button onClick={() => setPreviewMode(!previewMode)}
                 className={cn("p-2 rounded-lg transition-all", previewMode ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "text-gray-400 hover:text-gray-900")}
                 title={previewMode ? "Tilbake til admin" : "Se som Helene"}>
                 {previewMode ? <EyeOff size={18} /> : <Eye size={18} />}
               </button>
             )}
             {isAdmin && !previewMode && (
               <button onClick={onOpenSettings} className="p-2 text-gray-400 hover:text-gray-900 transition-colors" title="Innstillinger"><Settings size={18} /></button>
             )}
             <div className="w-px h-6 bg-gray-200" />
             <button onClick={onLogout} className="flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-gray-500 hover:text-gray-900 transition-colors">
               <LogOut size={14} /> Logg ut
             </button>
          </div>
        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-8 pt-8 md:pt-12 relative z-10">
        {!selectedAlbumId && (
          <>
            <AnimatePresence>
              {showIntros && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="mb-8 flex items-start justify-between bg-white/50 p-4 rounded-lg border border-gray-100">
                  <div className="text-sm text-gray-600 max-w-prose">
                    {effectiveAdmin ? "Forside: Plasser bilder fritt. Åpne 📁 for samlinger." : "Velkommen til bildegalleriet!"}
                  </div>
                  <button onClick={() => setShowIntros(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </motion.div>
              )}
            </AnimatePresence>
            <FreeCanvasGallery isAdmin={effectiveAdmin} items={items} imageItems={imageItems} onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem} lightboxIndex={lightboxIndex} setLightboxIndex={setLightboxIndex} openLightbox={openLightbox} />
            <PaginationFooter currentPageIndex={currentPageIndex} totalPages={pages.length} onNext={() => onChangePage(currentPageIndex + 1)} onPrev={() => onChangePage(currentPageIndex - 1)} isAdmin={effectiveAdmin} onAddPage={onAddPage} onDeletePage={() => setPageToDelete(true)} />
          </>
        )}
        {selectedAlbumId && selectedAlbum && (
          <FreeCanvasGallery isAdmin={effectiveAdmin} items={selectedAlbum.items} imageItems={albumImageItems}
            onUpdateItem={(itemId, updates) => onUpdateAlbumItem(selectedAlbumId, itemId, updates)}
            onDeleteItem={(itemId) => onDeleteAlbumItem(selectedAlbumId, itemId)}
            lightboxIndex={albumLightboxIndex} setLightboxIndex={setAlbumLightboxIndex} openLightbox={openAlbumLightbox} />
        )}
      </main>
      </div> {/* end content wrapper */}

      {/* Floating toolbar */}
      <AnimatePresence>
        {effectiveAdmin && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
             <div className="bg-white/90 backdrop-blur-md shadow-lg border border-gray-200/50 rounded-full px-6 py-3 flex items-center gap-4">
                 <button onClick={() => setShowAddImageModal(true)} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                   <div className="bg-gray-100 p-1.5 rounded-full"><ImageIcon size={16} /></div> Nytt bilde
                 </button>
                 <div className="w-[1px] h-6 bg-gray-200" />
                 <button onClick={() => selectedAlbumId ? onAddAlbumItem(selectedAlbumId, 'text') : onAddItem('text')} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
                   <div className="bg-gray-100 p-1.5 rounded-full"><Type size={16} /></div> Ny tekst
                 </button>
             </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddImageModal && <AddImageModal onConfirm={(filenames) => {
          if (selectedAlbumId) { onAddAlbumItem(selectedAlbumId, 'image', filenames); }
          else { onAddItem('image', filenames); }
          setShowAddImageModal(false);
        }} onCancel={() => setShowAddImageModal(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {pageToDelete && <ConfirmModal title="Slett side?" message="Alle bildene på siden forsvinner. Er du sikker?" onConfirm={() => { onDeletePage(); setPageToDelete(false); }} onCancel={() => setPageToDelete(false)} />}
      </AnimatePresence>

      {/* Create Album Modal */}
      <AnimatePresence>
        {showCreateAlbum && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <CreateAlbumForm onSave={(data) => { onCreateAlbum(data); setShowCreateAlbum(false); }} onCancel={() => setShowCreateAlbum(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple inline form for creating album
function CreateAlbumForm({ onSave, onCancel }: {
  onSave: (data: { title: string; emoji: string; description: string; date: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📸');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const emojis = ['📸', '🏔️', '🎂', '🌊', '🎄', '🌸', '🎉', '✈️', '🦉', '🏠', '❤️', '🎓', '⚽', '🎵', '🍕', '🐶'];
  return (
    <>
      <h3 className="text-xl font-serif mb-5">Ny samling</h3>
      <div className="mb-4">
        <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2 block">Ikon</label>
        <div className="flex flex-wrap gap-1.5">
          {emojis.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className={cn("w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all",
                emoji === e ? "bg-blue-100 ring-2 ring-blue-400 scale-110" : "bg-gray-50 hover:bg-gray-100"
              )}>{e}</button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5 block">Tittel</label>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="F.eks. Italia 2024"
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900" />
      </div>
      <div className="mb-4">
        <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5 block">Beskrivelse (valgfri)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Noen ord..." rows={2}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900 resize-none" />
      </div>
      <div className="mb-6">
        <label className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5 block">Dato (valgfri)</label>
        <input type="month" value={date} onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2.5 text-sm text-gray-500 rounded-xl hover:bg-gray-100">Avbryt</button>
        <button onClick={() => title.trim() && onSave({ title: title.trim(), emoji, description, date })} disabled={!title.trim()}
          className="px-5 py-2.5 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 font-medium">Opprett</button>
      </div>
    </>
  );
}


// Lightbox is now in FreeCanvasGallery.tsx
// --- Main App ---

export default function App() {
  const [session, setSession] = useState<{ isAuthenticated: boolean; isAdmin: boolean }>(() => {
    const saved = localStorage.getItem('hs-gallery-session');
    return saved ? JSON.parse(saved) : { isAuthenticated: false, isAdmin: false };
  });
  
  // State for Pages
  const [pages, setPages] = useState<Page[]>(() => {
     const savedPages = localStorage.getItem('hs-gallery-pages');
     if (savedPages) {
       return JSON.parse(savedPages);
     }
     
     // Backward compatibility: check for old 'items'
     const savedItems = localStorage.getItem('hs-gallery-items');
     if (savedItems) {
       const oldItems = JSON.parse(savedItems);
       return [{ id: 'page-1', items: oldItems }];
     }

     return [{ id: 'page-1', items: DEFAULT_ITEMS }];
  });

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const { isSyncing, syncMessage, setSyncMessage, syncToCloud, syncProgress, cleanProposal, confirmClean, cancelClean, repairImageUrls } = useGallerySync();
  const [cloudCheckMessage, setCloudCheckMessage] = useState<{title: string, message: string} | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Albums state
  const [albums, setAlbums] = useState<Album[]>(() => {
    const saved = localStorage.getItem('hs-gallery-albums');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Persistence Safety
  const [conflictData, setConflictData] = useState<{localPages: Page[], cloudPages: Page[]} | null>(null);
  const lastSyncedPagesRef = useRef<string>(JSON.stringify(pages));
  const lastSyncedAlbumsRef = useRef<string>(JSON.stringify(albums));
  
  // Calculate if we have unsaved changes
  const hasUnsavedChanges = JSON.stringify(pages) !== lastSyncedPagesRef.current || JSON.stringify(albums) !== lastSyncedAlbumsRef.current;

  // Load from Supabase on mount
  // Load from Supabase on mount
  useEffect(() => {
    const fetchContent = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('gallery_content')
        .select('data')
        .eq('id', 1)
        .single();

      if (data?.data) {
        const cloudPages = data.data as Page[];
        // AUTO-RESOLVE: Always prefer cloud data (Admin request)
        console.log("Loading from cloud (forcing cloud-first).");
        if (Array.isArray(cloudPages)) {
            // Auto-layout: assign positions to items that don't have x/y/w
            const layoutedPages = cloudPages.map(p => ({ ...p, items: autoLayoutItems(p.items) }));
            setPages(layoutedPages);
            lastSyncedPagesRef.current = JSON.stringify(layoutedPages);
            
            try {
                console.log("Running Auto-Repair on fetch...");
                const { pages: repairedPages, fixedCount } = await repairImageUrls(cloudPages);
                
                if (fixedCount > 0) {
                    console.log(`Auto-repair fixed ${fixedCount} links. Saving to DB to persist optimizations.`);
                    setPages(repairedPages); 
                    lastSyncedPagesRef.current = JSON.stringify(repairedPages);
                    
                    // Persist the optimized URLs so we don't need to repair on next load
                    await supabase.from('gallery_content').upsert({ id: 1, data: repairedPages });
                }
            } catch (err) {
                console.error("Auto-repair failed, continuing with un-repaired pages:", err);
            }
        } else {
            console.error("Cloud data is not an array:", cloudPages);
        }
      }

      // Also fetch albums (id=2)
      const { data: albumData } = await supabase
        .from('gallery_content')
        .select('data')
        .eq('id', 2)
        .single();
      
      if (albumData?.data && Array.isArray(albumData.data)) {
        console.log("Loaded albums from cloud:", (albumData.data as Album[]).length);
        setAlbums(albumData.data as Album[]);
        lastSyncedAlbumsRef.current = JSON.stringify(albumData.data);
      }
    };
    fetchContent();
  }, []);

  useEffect(() => {
    localStorage.setItem('hs-gallery-pages', JSON.stringify(pages));
    console.log("Saved pages:", pages.length);
  }, [pages]);

  // --- Prefetch Next Page Images (Ultra Speed) 🚀 ---
  useEffect(() => {
    if (!pages || pages.length <= 1) return;
    
    const nextPageIndex = currentPageIndex + 1;
    // Only prefetch if next page exists
    if (nextPageIndex >= pages.length) return;

    const nextPage = pages[nextPageIndex];
    if (!nextPage) return;

    console.log(`🚀 Prefetching images for page ${nextPageIndex + 1}...`);
    
    nextPage.items.forEach(item => {
      if (item.type === 'image') {
         const imgItem = item as ImageItem;
         // Prefetch optimal thumbnail
         if (imgItem.thumbnailUrl) {
             const preloadImg = new Image();
             preloadImg.src = imgItem.thumbnailUrl;
         }
      }
    });
  }, [currentPageIndex, pages]);

  const handleLogin = (isAdmin: boolean) => {
    const newSession = { isAuthenticated: true, isAdmin };
    setSession(newSession);
    localStorage.setItem('hs-gallery-session', JSON.stringify(newSession));
  };

  // Helper helper to modify current page
  const updateCurrentPageItems = (newItemsOrFn: GalleryItem[] | ((prev: GalleryItem[]) => GalleryItem[])) => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      const currentItems = newPages[currentPageIndex].items;
      
      const updatedItems = typeof newItemsOrFn === 'function' 
        ? newItemsOrFn(currentItems) 
        : newItemsOrFn;
      
      newPages[currentPageIndex] = {
        ...newPages[currentPageIndex],
        items: updatedItems
      };
      
      return newPages;
    });
  };

  const handleUpdateItem = (id: string, updates: Partial<GalleryItem>) => {
    updateCurrentPageItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } as GalleryItem : item));
  };

  const handleAddItem = (type: 'image' | 'text', payload?: any) => {
    if (type === 'text') {
       const newItem: TextItem = {
         id: `txt-${Date.now()}`,
         type: 'text',
         content: "Ny tekst... klikk for å redigere.",
         align: 'center',
         size: 'md'
       };
       updateCurrentPageItems(prev => [newItem, ...prev]);
    } else if (type === 'image' && payload) {
      // Payload is now string[] or string
      // Payload is now string[] or string or File[]
      const inputs = Array.isArray(payload) ? payload : [payload];
      
      const newItems: ImageItem[] = inputs.map((input: string | File, idx: number) => {
        if (input instanceof File) {
           const previewUrl = URL.createObjectURL(input);
           return {
             id: `img-${Date.now()}-${idx}`,
             type: 'image',
             thumbnailUrl: previewUrl,
             largeUrl: previewUrl,
             originalUrl: previewUrl,
             file: input, // ✅ Store actual file for sync
             title: "",
             caption: "",
             width: 3, height: 2
           };
        }
        
        // Fallback for strings (legacy / manual typing)
        const filename = input as string;
        return {
          id: `img-${Date.now()}-${idx}`,
          type: 'image',
          thumbnailUrl: `/images/thumbs/${filename}`,
          largeUrl: `/images/original/${filename}`,
          originalUrl: `/images/original/${filename}`,
          title: "",
          caption: "",
          width: 3, 
          height: 2 
        };
      });
      
      updateCurrentPageItems(prev => [...newItems, ...prev]);
    }
  };

  const handleDeleteItem = (id: string) => {
    updateCurrentPageItems(prev => prev.filter(i => i.id !== id));
  };

  // handleReorder removed — free canvas uses x/y positioning instead

  // Page Management
  const handleAddPage = () => {
    setPages(prev => [...prev, { id: `page-${Date.now()}`, items: [] }]);
    setTimeout(() => setCurrentPageIndex(prev => prev + 1), 50);
  };
  
  const handleDeletePage = () => {
    if (pages.length <= 1) return;
    setPages(prev => {
        const newPages = prev.filter((_, idx) => idx !== currentPageIndex);
        return newPages;
    });
    setCurrentPageIndex(prev => Math.max(0, prev - 1));
  };

  // --- Album CRUD ---
  const handleCreateAlbum = (data: { title: string; emoji: string; description: string; date: string }) => {
    const newAlbum: Album = {
      id: `album-${Date.now()}`,
      title: data.title,
      emoji: data.emoji || '📸',
      description: data.description || undefined,
      date: data.date || undefined,
      sortOrder: albums.length,
      items: [],
    };
    setAlbums(prev => [...prev, newAlbum]);
  };

  const handleUpdateAlbum = (id: string, updates: Partial<Album>) => {
    setAlbums(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleDeleteAlbum = (id: string) => {
    setAlbums(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAlbumItem = (albumId: string, itemId: string, updates: Partial<GalleryItem>) => {
    setAlbums(prev => prev.map(a => {
      if (a.id !== albumId) return a;
      return { ...a, items: a.items.map(item => item.id === itemId ? { ...item, ...updates } as GalleryItem : item) };
    }));
  };

  const handleAddAlbumItem = (albumId: string, type: 'image' | 'text', payload?: any) => {
    if (type === 'text') {
      const newItem: TextItem = {
        id: `txt-${Date.now()}`,
        type: 'text',
        content: "Ny tekst... klikk for å redigere.",
        align: 'center',
        size: 'md'
      };
      setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, items: [newItem, ...a.items] } : a));
    } else if (type === 'image' && payload) {
      const inputs = Array.isArray(payload) ? payload : [payload];
      const newItems: ImageItem[] = inputs.map((input: string | File, idx: number) => {
        if (input instanceof File) {
          const previewUrl = URL.createObjectURL(input);
          return {
            id: `img-${Date.now()}-${idx}`,
            type: 'image' as const,
            file: input,
            thumbnailUrl: previewUrl,
            largeUrl: previewUrl,
            originalUrl: previewUrl,
            title: '', caption: '', altText: input.name,
            width: 800, height: 600,
          };
        }
        const filename = typeof input === 'string' ? input : '';
        const baseName = filename.replace(/\.[^/.]+$/, '');
        return {
          id: `img-${Date.now()}-${idx}`,
          type: 'image' as const,
          thumbnailUrl: `/images/thumbs/${baseName}-2.jpg`,
          largeUrl: `/images/original/${filename}`,
          originalUrl: `/images/original/${filename}`,
          title: '', caption: '', altText: baseName,
          width: 800, height: 600,
        };
      });
      setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, items: [...newItems, ...a.items] } : a));
    }
  };

  const handleDeleteAlbumItem = (albumId: string, itemId: string) => {
    setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, items: a.items.filter(i => i.id !== itemId) } : a));
  };

  // Persist albums to localStorage
  useEffect(() => {
    localStorage.setItem('hs-gallery-albums', JSON.stringify(albums));
  }, [albums]);

  const handleSyncToCloud = async () => {
      // Sync pages
      const updatedPages = await syncToCloud(pages);
      if (updatedPages) {
          setPages(updatedPages);
          lastSyncedPagesRef.current = JSON.stringify(updatedPages);
      }
      // Sync albums to Supabase
      if (supabase) {
        try {
          await supabase.from('gallery_content').upsert({ id: 2, data: albums });
          lastSyncedAlbumsRef.current = JSON.stringify(albums);
          console.log("Albums synced to cloud.");
        } catch (err) {
          console.error("Album sync failed:", err);
        }
      }
  };


  const handleResetToLocal = () => {
    // 1. Analyze logic outside of state updater
    // Create deep copy to check for potential changes
    const newPages = JSON.parse(JSON.stringify(pages)) as Page[];
    let fixedCount = 0;
    
    newPages.forEach(page => {
       page.items.forEach(item => {
          if (item.type === 'image') {
            const img = item as ImageItem;
            // Smart Reset Logic using available images
            let foundMatch = false;
            
            for (const knownName of AVAILABLE_IMAGES) {
              const baseName = knownName.split('.')[0].replace(/[-_\s(2)]/g, '').toLowerCase();
              const urlLower = (img.largeUrl || "").toLowerCase();
              
              if (urlLower.includes(baseName)) {
                 // Found a match!
                 img.storageName = undefined; // FORCE RE-UPLOAD to replace giant files
                 img.thumbnailUrl = `/images/thumbs/${knownName.replace('.jpg', '')}-2.jpg`; 
                 img.largeUrl = `/images/original/${knownName}`; 
                 img.originalUrl = `/images/original/${knownName}`;
                 foundMatch = true;
                 break; 
              }
            }
            
            if (foundMatch) fixedCount++;
          }
       });
    });

    if (fixedCount > 0) {
      // Apply changes
      setPages(newPages);
      setSyncMessage({ 
        title: "Suksess!", 
        message: `Reparerte ${fixedCount} bilder ved å finne matchende filnavn i systemet. Husk å lagre til skyen (svart knapp) når du er ferdig!` 
      });
    } else {
      // Debug Info if nothing found
      const firstImage = pages.flatMap(p => p.items).find(i => i.type === 'image') as ImageItem | undefined;
      const debugInfo = `
        Fant ingen bilder å reparere.
        
        Diagnose:
        - Antall bilder funnet i systemet: ${AVAILABLE_IMAGES.length}
        - Første kjente filnavn: ${AVAILABLE_IMAGES[0] || '(ingen)'}
        - Din første bilde-URL: ${firstImage?.largeUrl || '(ingen bilder)'}
        
        Tips: Hvis 'Antall bilder' er 0, sjekk at bildene faktisk ligger i 'public/images/thumbs'.
      `;
      setSyncMessage({ title: "Kunne ikke reparere", message: debugInfo });
    }
  };

  const handleUpdatePassword = async (type: 'admin' | 'guest', newPass: string) => {
    if (!supabase) return;
    try {
      const newHash = await hashPassword(newPass);
      const { error } = await supabase
        .from('app_settings')
        .update({ [type === 'admin' ? 'admin_hash' : 'guest_hash']: newHash })
        .eq('id', 1);

      if (error) throw error;
      setSyncMessage({ title: "Suksess", message: `Passord for ${type === 'admin' ? 'Deg' : 'Gjest'} er oppdatert!` });
    } catch (err) {
      console.error(err);
      setSyncMessage({ title: "Feil", message: "Kunne ikke oppdatere passord." });
    }
  };

  // No separate check cloud handler needed anymore
  // Sync now handles repair, upload, and save in one go.

  return (
    <ErrorBoundary>
      <div className="antialiased text-gray-900 bg-offwhite min-h-screen font-sans selection:bg-gray-900 selection:text-white">
      <AnimatePresence mode="wait">
        {!session.isAuthenticated ? (
          <LoginView key="login" onLogin={handleLogin} />
        ) : (
          <>
            <GalleryView 
              key="gallery-page"
              isAdmin={session.isAdmin}
              pages={pages}
              currentPageIndex={currentPageIndex}
              albums={albums}
              onLogout={() => {
                setSession({ isAuthenticated: false, isAdmin: false });
                localStorage.removeItem('hs-gallery-session');
              }}
              onUpdateItem={handleUpdateItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onChangePage={setCurrentPageIndex}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
              onOpenSettings={() => setShowSettings(true)}
              onCreateAlbum={handleCreateAlbum}
              onUpdateAlbum={handleUpdateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
              onUpdateAlbumItem={handleUpdateAlbumItem}
              onAddAlbumItem={handleAddAlbumItem}
              onDeleteAlbumItem={handleDeleteAlbumItem}
            />
            {/* Sync Button (Floating) */}
            {session.isAdmin && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSyncToCloud();
                }}
                disabled={isSyncing}
                className="fixed bottom-8 right-8 z-[60] bg-gray-900 text-white rounded-full p-4 shadow-xl hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer group"
                title={hasUnsavedChanges ? "Du har ulagrede endringer!" : "Alt er lagret i skyen"}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Notification Dot */}
                {hasUnsavedChanges && (
                  <span className="absolute top-0 right-0 -mt-1 -mr-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
                
                {isSyncing ? <Loader className="text-white w-6 h-6" /> : <Save size={24} className={hasUnsavedChanges ? "text-red-100" : "text-white"} />}
              </button>
            )}
            
            {/* MODALS */}
            {conflictData && (
              <ConflictModal 
                localCount={conflictData.localPages.reduce((acc, p) => acc + p.items.length, 0)}
                cloudCount={conflictData.cloudPages.reduce((acc, p) => acc + p.items.length, 0)}
                onKeepLocal={() => {
                  setConflictData(null);
                  // Keep current pages (already in state/localStorage)
                  // But update reference so dot appears logic works (it will differ from ref if ref was cloud?)
                  // Actually ref should update to reflect we CHOSE local? No, ref is "what is in cloud".
                  // So dot will remain red. Correct!
                }}
                onUseCloud={() => {
                  setPages(conflictData.cloudPages);
                  lastSyncedPagesRef.current = JSON.stringify(conflictData.cloudPages);
                  setConflictData(null);
                }}
              />
            )}
            
            {/* MODALS */}
            {showSettings && (
              <ChangePasswordModal 
                onClose={() => setShowSettings(false)}
                onUpdate={handleUpdatePassword}
                onResetLocal={handleResetToLocal}
              />
            )}

          </>
        )}
      </AnimatePresence>
      
      {/* GLOBAL MESSAGE MODAL - Outside AnimatePresence to be safe */}
      {syncMessage && (
         <MessageModal 
           title={syncMessage.title} 
           message={syncMessage.message} 
           onClose={() => setSyncMessage(null)} 
         />
      )}
      
      {/* SYNC PROGRESS MODAL */}
      {isSyncing && syncProgress && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <Loader className="w-10 h-10 text-blue-600 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-bold mb-2">Lagrer Galleri</h3>
            <p className="text-gray-600 mb-4">{syncProgress}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* CLEAN CONFIRM MODAL */}
      {cleanProposal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <h3 className="text-xl font-bold mb-4">Rydd i Skyen? ☁️</h3>
            <p className="text-gray-600 mb-6 text-left">
              Vi fant <strong>{cleanProposal.count}</strong> gamle eller ubrukte filer i skyen som ikke brukes i galleriet ditt lenger.
              <br/><br/>
              Vil du slette disse for å spare plass?
              <br/>
              <span className="text-xs text-gray-400">(Dette er trygt: Vi har sjekket at de ikke er i bruk).</span>
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => confirmClean()}
                className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700"
              >
                Ja, slett dem
              </button>
              <button 
                onClick={() => cancelClean()}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Nei, behold dem
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* DEBUG CLOUD MODAL */}
      {cloudCheckMessage && (
         <MessageModal 
           title={cloudCheckMessage.title} 
           message={cloudCheckMessage.message} 
           onClose={() => setCloudCheckMessage(null)} 
         />
      )}
      
      </div>
    </ErrorBoundary>
  );
}
