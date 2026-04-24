import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Settings, 
  Star, 
  History, 
  Zap, 
  Globe, 
  CheckCircle2,
  X,
  SearchIcon,
  Pencil,
  Brain,
  LayoutGrid,
  Trash2,
  Palette,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { useAuth } from './context/AuthContext';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from './lib/firebase';
import { AddBookmarkModal } from './components/AddBookmarkModal';
import { EditBookmarkModal } from './components/EditBookmarkModal';
import { ImportModal } from './components/ImportModal';
import { Bookmark } from './types';
import { CATEGORIES, BACKGROUNDS } from './constants';

type FilterType = 'all' | 'recent' | 'favorites' | string;

export default function App() {
  const { user, login, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; title: string } | null>(null);
  const [bgKey, setBgKey] = useState(() => localStorage.getItem('arkiv-bg') || 'none');
  const [customBg, setCustomBg] = useState<string | null>(() => localStorage.getItem('arkiv-custom-bg'));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleBgChange = () => {
      setBgKey(localStorage.getItem('arkiv-bg') || 'none');
    };
    window.addEventListener('arkiv-bg-change', handleBgChange);
    return () => window.removeEventListener('arkiv-bg-change', handleBgChange);
  }, []);

  const [isRecategorizing, setIsRecategorizing] = useState(false);

  const handleRecategorize = async () => {
    if (!user || bookmarks.length === 0) return;
    setIsRecategorizing(true);
    
    try {
      const { writeBatch } = await import('firebase/firestore');
      const { suggestCategory } = await import('./services/categorizationService');
      
      const batchSize = 500;
      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = bookmarks.slice(i, i + batchSize);
        
        chunk.forEach(b => {
          const newCategory = suggestCategory(b.url, b.title);
          if (newCategory !== b.category) {
            const ref = doc(db, `users/${user.uid}/bookmarks`, b.id);
            batch.update(ref, { category: newCategory, updatedAt: Date.now() });
          }
        });
        
        await batch.commit();
      }
      alert('Your library has been smartly recategorized!');
    } catch (error) {
      console.error('Recategorization failed:', error);
    } finally {
      setIsRecategorizing(false);
    }
  };

  const isPopup = window.innerWidth < 600;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/bookmarks`),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bookmark));
      setBookmarks(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredBookmarks = useMemo(() => {
    let base = [...bookmarks];
    
    // Apply categorical/status filters
    if (activeFilter === 'favorites') {
      base = base.filter(b => b.isFavorite);
    } else if (activeFilter === 'recent') {
      base = base.slice(0, 15);
    } else if (CATEGORIES.includes(activeFilter as string)) {
      base = base.filter(b => b.category === activeFilter);
    }

    if (!searchQuery) return base.slice(0, 50);

    const lowerQuery = searchQuery.toLowerCase();
    return base.filter(b => 
      b.title.toLowerCase().includes(lowerQuery) || 
      b.url.toLowerCase().includes(lowerQuery) ||
      b.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      (b.smartSummary && b.smartSummary.toLowerCase().includes(lowerQuery))
    ).slice(0, 20);
  }, [searchQuery, bookmarks, activeFilter]);

  const toggleFavorite = async (bookmark: Bookmark) => {
    if (!user) return;
    const path = `users/${user.uid}/bookmarks/${bookmark.id}`;
    try {
      await updateDoc(doc(db, path), {
        isFavorite: !bookmark.isFavorite,
        updatedAt: Date.now()
      });
    } catch (error: any) {
      handleFirestoreError(error, 'update', path);
    }
  };

  const deleteBookmark = async (id: string) => {
    if (!user) return;
    
    const path = `users/${user.uid}/bookmarks/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error: any) {
      handleFirestoreError(error, 'delete', path);
    }
  };

  const handleSaveCurrent = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs: any) => {
        const tab = tabs[0];
        if (tab?.url && !tab.url.startsWith('chrome://')) {
          saveDirect(tab.url, tab.title || 'Untitled');
        }
      });
    } else {
      setIsAddModalOpen(true);
    }
  };

  const saveDirect = async (url: string, title: string) => {
    if (!user) return;
    const bookmarkId = Math.random().toString(36).substr(2, 9);
    const newBookmark: Bookmark = {
      id: bookmarkId,
      userId: user.uid,
      url,
      title,
      description: '',
      tags: ['quick-save'],
      category: 'General',
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`
    };

    try {
      await setDoc(doc(db, `users/${user.uid}/bookmarks`, bookmarkId), newBookmark);
      setToast({ visible: true, title: title });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) {
    return (
      <div className="h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-8 transition-colors duration-500">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
          <div className="p-6 bg-slate-900 dark:bg-blue-600 rounded-[32px] inline-block mb-10 shadow-2xl">
            <Brain size={64} className="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tighter mb-4 text-slate-900 dark:text-white">Arkiv</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-12 font-medium leading-relaxed">
            Your high-performance digital library. <br /> Fast, minimal, and smarter than ever.
          </p>

          <div className="grid grid-cols-1 gap-4 mb-12 text-left">
            {[
              { icon: <Zap size={16} className="text-amber-500" />, title: "Lightning Fast", desc: "Built for speed and muscle memory." },
              { icon: <Brain size={16} className="text-blue-500" />, title: "AI Organized", desc: "Smart tagging and auto-categorization." },
              { icon: <CheckCircle2 size={16} className="text-emerald-500" />, title: "Forever Free", desc: "Personal library with no trial limits." }
            ].map((feature, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="shrink-0 pt-1">{feature.icon}</div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{feature.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={login} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-2xl text-xl font-bold flex items-center justify-center gap-4 shadow-xl shadow-slate-900/10 hover:bg-slate-800 dark:hover:bg-blue-700 transition-all active:scale-95">
            Get Started with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomBg(base64String);
        setBgKey('custom');
        localStorage.setItem('arkiv-custom-bg', base64String);
        localStorage.setItem('arkiv-bg', 'custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const currentBg = bgKey === 'custom' && customBg 
    ? { id: 'custom', label: 'Custom', type: 'image' as const, url: customBg }
    : (BACKGROUNDS.find(b => b.id === bgKey) || BACKGROUNDS[0]);

  return (
    <div 
      className={cn(
        "min-h-screen transition-all duration-700 ease-in-out relative bg-fixed", 
        currentBg.type === 'image' ? "bg-cover bg-center bg-no-repeat" : currentBg.className, 
        isPopup ? "is-popup" : "p-4 md:p-6 lg:p-8"
      )}
      style={currentBg.type === 'image' ? { backgroundImage: `url(${currentBg.url})` } : {}}
    >
      {/* Background Overlay for image readability */}
      {currentBg.type === 'image' && (
        <div className="fixed inset-0 bg-white/40 dark:bg-slate-950/60 backdrop-blur-[2px] pointer-events-none" />
      )}
      
      <AnimatePresence>
        {toast?.visible && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[150] bg-slate-900 text-white px-8 py-4 rounded-[24px] shadow-2xl flex items-center gap-4 min-w-[320px]"
          >
            <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Link Captured</p>
              <p className="text-sm font-semibold truncate leading-tight">{toast.title}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddBookmarkModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={() => {}} />
      <EditBookmarkModal isOpen={!!editingBookmark} bookmark={editingBookmark} onClose={() => setEditingBookmark(null)} />
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Settings Drawer (Home Page Sidebar) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[140]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl z-[150] shadow-2xl border-l border-slate-100 dark:border-slate-800 flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500">
                     <Settings size={20} />
                   </div>
                   <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
                 </div>
                 <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                   <X size={20} className="text-slate-400" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Account Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl border-2 border-slate-50 overflow-hidden">
                       <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white leading-none">{user.displayName}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">{user.email}</p>
                    </div>
                  </div>
                </section>

                {/* Background Gallery Section */}
                <section className="space-y-6">
                   <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <Palette size={12} />
                       Background Gallery
                     </h3>
                   </div>
                   
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 flex flex-col items-center justify-center gap-2 transition-all group"
                      >
                         <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-blue-500 rounded-xl flex items-center justify-center transition-colors">
                           <Plus size={20} />
                         </div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Photo</span>
                      </button>

                     {customBg && (
                       <button
                        onClick={() => {
                          setBgKey('custom');
                          localStorage.setItem('arkiv-bg', 'custom');
                        }}
                        className={cn(
                          "group relative h-24 rounded-2xl overflow-hidden border-2 transition-all p-1 ring-offset-2 dark:ring-offset-slate-900",
                          bgKey === 'custom' ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-100 dark:border-slate-800 hover:border-slate-300"
                        )}
                       >
                         <img src={customBg} alt="" className="w-full h-full object-cover rounded-xl" />
                         <div className="absolute inset-x-2 bottom-2 p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 transform translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                           <p className="text-[9px] font-bold text-center uppercase tracking-widest text-slate-600 dark:text-slate-300">My Photo</p>
                         </div>
                         {bgKey === 'custom' && (
                           <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                             <CheckCircle2 size={12} />
                           </div>
                         )}
                       </button>
                     )}

                     {BACKGROUNDS.map((item) => (
                       <button
                        key={item.id}
                        onClick={() => {
                          setBgKey(item.id);
                          localStorage.setItem('arkiv-bg', item.id);
                        }}
                        className={cn(
                          "group relative h-24 rounded-2xl overflow-hidden border-2 transition-all p-1 ring-offset-2 dark:ring-offset-slate-900",
                          bgKey === item.id ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-100 dark:border-slate-800 hover:border-slate-300"
                        )}
                       >
                         {item.type === 'image' ? (
                           <img src={item.url} alt="" className="w-full h-full object-cover rounded-xl" />
                         ) : (
                           <div className={cn("w-full h-full rounded-xl", item.className)} />
                         )}
                         <div className="absolute inset-x-2 bottom-2 p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 transform translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                           <p className="text-[9px] font-bold text-center uppercase tracking-widest text-slate-600 dark:text-slate-300">{item.label}</p>
                         </div>
                         {bgKey === item.id && (
                           <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
                             <CheckCircle2 size={12} />
                           </div>
                         )}
                       </button>
                     ))}
                   </div>
                </section>

                {/* Advanced Section */}
                <section className="space-y-4">
                   <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keyboard Shortcuts</h3>
                   <div className="grid grid-cols-1 gap-2">
                      <ShortcutRow label="Focus Search" keys={['/']} />
                      <ShortcutRow label="Quick Summary" keys={['⌘', 'S']} />
                      <ShortcutRow label="Import" keys={['⌘', 'I']} />
                   </div>
                </section>

                {/* Data Section */}
                <section className="space-y-4">
                   <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Advanced</h3>
                   <div className="space-y-3">
                      <button onClick={() => setIsImportOpen(true)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group">
                         <div className="flex items-center gap-3">
                           <Zap size={16} className="text-amber-500" />
                           <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Import Links</span>
                         </div>
                         <Plus size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </button>
                      
                      <button 
                        onClick={handleRecategorize}
                        disabled={isRecategorizing}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group disabled:opacity-50"
                      >
                         <div className="flex items-center gap-3">
                           <LayoutGrid size={16} className="text-blue-500" />
                           <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Smart Organize</span>
                         </div>
                         {isRecategorizing ? <Loader2 className="animate-spin size-4 text-slate-400" /> : <Plus size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />}
                      </button>
                   </div>
                </section>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={logout}
                  className="w-full py-4 text-sm font-bold text-red-500 bg-red-50 dark:bg-red-950/20 rounded-2xl hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto w-full space-y-8 relative z-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-6 px-1">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-slate-900 shadow-lg">
                  <Brain size={20} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Arkiv</h1>
             </div>
             
             <div className="flex items-center gap-3">
               {user.photoURL ? (
                 <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-2xl border-2 border-slate-50 overflow-hidden hover:scale-105 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-blue-500">
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                 </button>
               ) : (
                 <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-200 transition-all">
                    {user.displayName?.charAt(0)}
                 </button>
               )}
             </div>
          </div>

          <div className="space-y-6">
            <div className="search-container max-w-2xl mx-auto">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300">
                <SearchIcon size={24} strokeWidth={2.5} />
              </div>
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search everything..."
                className="search-input py-5 px-8 pl-20 rounded-[28px] text-lg bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800 shadow-2xl focus:ring-2 focus:ring-blue-500/40 transition-all outline-none w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-30 select-none pointer-events-none group-focus-within:opacity-100 transition-opacity">
                <kbd className="px-2 py-1 rounded-lg border border-slate-400 text-[10px] font-bold">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>
                <kbd className="px-2 py-1 rounded-lg border border-slate-400 text-[10px] font-bold">K</kbd>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 px-2">
              <button 
                onClick={handleSaveCurrent} 
                className="flex items-center gap-2 px-6 py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-[20px] text-sm font-bold shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Plus size={18} strokeWidth={3} />
                Save Link
              </button>
              <button onClick={() => setIsImportOpen(true)} className="ghost-btn px-5 py-3.5 rounded-[20px] text-slate-700 dark:text-slate-200 font-bold hover:bg-white/80 dark:hover:bg-slate-800 transition-all shadow-sm">
                <Zap size={16} className="text-amber-500" />
                Import
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)} 
                className="ghost-btn px-5 py-3.5 rounded-[20px] text-slate-700 dark:text-slate-200 font-bold hover:bg-white/80 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
              >
                <Palette size={16} className="text-blue-500" />
                Theme
              </button>
              <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />
              <NavChip active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} icon={<LayoutGrid size={15} />} label="All" />
              <NavChip active={activeFilter === 'recent'} onClick={() => setActiveFilter('recent')} icon={<History size={15} />} label="Recent" />
              <NavChip active={activeFilter === 'favorites'} onClick={() => setActiveFilter('favorites')} icon={<Star size={15} />} label="Favorites" />
            </div>
          </div>
        </div>

        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.25em] drop-shadow-sm">{searchQuery ? `Search Results` : activeFilter === 'all' ? 'Your Collection' : activeFilter}</h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[60%] sm:max-w-none pb-1">
                 {CATEGORIES.map(cat => (
                   <button 
                      key={cat}
                      onClick={() => setActiveFilter(activeFilter === cat ? 'all' : cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                        activeFilter === cat 
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-slate-900/10 scale-105" 
                          : "bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:bg-white transition-all shadow-sm border border-white/20"
                      )}
                    >
                     {cat}
                   </button>
                 ))}
              </div>
           </div>

           <AnimatePresence mode="wait">
            {filteredBookmarks.length > 0 ? (
              <motion.div 
                key={activeFilter + searchQuery} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1"
              >
                {filteredBookmarks.map((b, i) => (
                  <BookmarkRow 
                    key={b.id} 
                    bookmark={b} 
                    i={i} 
                    onToggleFavorite={toggleFavorite} 
                    onEdit={() => setEditingBookmark(b)}
                    onDelete={() => deleteBookmark(b.id)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 text-center space-y-4">
                <div className="w-20 h-20 bg-white/50 dark:bg-slate-800/50 rounded-[32px] flex items-center justify-center mx-auto border border-white dark:border-slate-800 shadow-sm backdrop-blur-xl">
                  <Globe size={32} className="text-slate-200" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">No links here.</h2>
                  <p className="text-slate-500 font-medium max-w-[280px] mx-auto text-xs leading-relaxed mt-1">Try adjusting your search or switching categories.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Floating Quick Background Switcher */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full px-4 overflow-hidden pointer-events-none">
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-2xl pointer-events-auto flex items-center gap-3 overflow-x-auto no-scrollbar"
        >
          <div className="pl-3 pr-2 border-r border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Palette size={16} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest whitespace-nowrap">Gallery</span>
          </div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-12 h-12 flex-shrink-0 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all"
          >
            <Plus size={18} />
          </button>

          {customBg && (
            <button
              onClick={() => {
                setBgKey('custom');
                localStorage.setItem('arkiv-bg', 'custom');
              }}
              className={cn(
                "relative w-12 h-12 flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all p-0.5",
                bgKey === 'custom' ? "border-blue-500 scale-110 shadow-lg" : "border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              )}
            >
              <img src={customBg} alt="" className="w-full h-full object-cover rounded-xl" />
            </button>
          )}

          {BACKGROUNDS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setBgKey(item.id);
                localStorage.setItem('arkiv-bg', item.id);
              }}
              className={cn(
                "relative w-12 h-12 flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all p-0.5",
                bgKey === item.id ? "border-blue-500 scale-110 shadow-lg" : "border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              )}
            >
               {item.type === 'image' ? (
                 <img src={item.url} alt="" className="w-full h-full object-cover rounded-xl" />
               ) : (
                 <div className={cn("w-full h-full rounded-xl", item.className)} />
               )}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function NavChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-6 py-4 rounded-[24px] text-sm font-bold transition-all active:scale-95 shadow-sm",
        active 
          ? "bg-white dark:bg-white text-blue-600 dark:text-slate-900 shadow-xl shadow-blue-500/10 scale-105" 
          : "bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-white/20"
      )}
    >
      <span className={cn(active ? "text-blue-500" : "text-slate-500 dark:text-slate-400")}>{icon}</span>
      {label}
    </button>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <div className="flex gap-1.5">
        {keys.map(key => (
          <kbd key={key} className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 font-mono shadow-sm">
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function BookmarkRow({ bookmark, i, onToggleFavorite, onEdit, onDelete }: any) {
  const handleOpen = () => {
    window.open(bookmark.url, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ delay: i * 0.02 }}
      className="group relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-800/40 rounded-[24px] p-5 hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div 
          onClick={handleOpen}
          className="w-11 h-11 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm group-hover:scale-105 transition-transform cursor-pointer"
        >
          <img 
            src={bookmark.favicon} 
            alt="" 
            className="w-5 h-5"
            onError={(e) => (e.currentTarget.src = 'https://www.gstatic.com/images/branding/product/2x/googleg_64dp.png')}
          />
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={() => onToggleFavorite(bookmark)} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">
            <Star size={16} strokeWidth={2.5} className={cn(bookmark.isFavorite ? "text-amber-400 fill-amber-400" : "text-slate-300 hover:text-amber-400")} />
          </button>
          <button onClick={() => onEdit()} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 rounded-lg transition-all">
            <Pencil size={15} strokeWidth={2.5} />
          </button>
          <button onClick={() => onDelete()} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded-lg transition-all">
            <Trash2 size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={handleOpen}>
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {bookmark.title}
        </h4>
        <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest leading-none mb-4">
          {new URL(bookmark.url).hostname.replace('www.', '')}
        </p>
      </div>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/50 dark:border-slate-800/50">
        <span className="text-[9px] font-bold text-blue-500/80 uppercase tracking-widest bg-blue-50/50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
          {bookmark.category}
        </span>
        <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">
          {new Date(bookmark.createdAt).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
}
