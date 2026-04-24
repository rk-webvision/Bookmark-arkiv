import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Trash2, Tag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Bookmark } from '../types';
import { CATEGORIES } from '../constants';

interface EditBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
}

export function EditBookmarkModal({ isOpen, onClose, bookmark }: EditBookmarkModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General',
    tags: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (bookmark) {
      setFormData({
        title: bookmark.title,
        description: bookmark.description || '',
        category: bookmark.category || 'General',
        tags: bookmark.tags.join(', ')
      });
    }
  }, [bookmark, isOpen]);

  const handleSave = async () => {
    if (!bookmark || !user) return;
    setIsSaving(true);
    
    const path = `users/${user.uid}/bookmarks/${bookmark.id}`;
    try {
      await updateDoc(doc(db, path), {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        updatedAt: Date.now()
      });
      onClose();
    } catch (error: any) {
      handleFirestoreError(error, 'update', path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bookmark || !user) return;
    setIsDeleting(true);
    const path = `users/${user.uid}/bookmarks/${bookmark.id}`;
    try {
      await deleteDoc(doc(db, path));
      onClose();
    } catch (error) {
       handleFirestoreError(error, 'delete', path);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !bookmark) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800"
        >
          <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-[20px] flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm grow-0 shrink-0">
                <img src={bookmark.favicon} alt="" className="w-7 h-7" onError={(e) => e.currentTarget.style.display = 'none'} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate tracking-tight">{bookmark.title}</h2>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5 truncate">{new URL(bookmark.url).hostname}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="p-10 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Title</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:shadow-[0_0_0_2px_theme(colors.blue.500)] outline-none transition-all" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Category</label>
                  <CategoryDropdown 
                    value={formData.category} 
                    onChange={(cat) => setFormData({...formData, category: cat})} 
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Tags</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14} />
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:shadow-[0_0_0_2px_theme(colors.blue.500)] outline-none transition-all" 
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                      placeholder="productivity, research..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Last Updated</label>
                  <p className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{new Date(bookmark.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Description</label>
              <textarea 
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-[24px] py-4 px-5 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:shadow-[0_0_0_2px_theme(colors.blue.500)] outline-none transition-all min-h-[120px] resize-none leading-relaxed" 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="What is this bookmark about?"
              />
            </div>

            {bookmark.smartSummary && (
              <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[24px] border border-blue-100/50 dark:border-blue-900/20 flex gap-4">
                <Sparkles size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Smart Summary</p>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">"{bookmark.smartSummary}"</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 px-10 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-4 items-center">
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all grow-0 shrink-0"
            >
              <Trash2 size={20} />
            </button>
            <div className="grow" />
            <button 
              onClick={onClose}
              className="px-6 py-3.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
            >
              Discard Changes
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !formData.title}
              className="px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[18px] text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Updates
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function CategoryDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl py-3 px-4 text-sm font-semibold flex items-center justify-between text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all outline-none"
      >
        <span>{value}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <Tag size={14} className="text-slate-400 dark:text-slate-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[20px] shadow-2xl p-2 py-3 space-y-1"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                  value === cat ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
