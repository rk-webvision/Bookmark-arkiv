import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Globe, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { extractBookmarkInfo } from '../services/geminiService';
import { suggestCategory } from '../services/categorizationService';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, setDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import type { Bookmark } from '../types';
import { CATEGORIES } from '../constants';

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (bookmark: Bookmark) => void;
}

declare const chrome: any;

export function AddBookmarkModal({ isOpen, onClose, onAdd }: AddBookmarkModalProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    title: '',
    description: '',
    tags: '',
    category: 'General'
  });

  const [selectedCategory, setSelectedCategory] = useState('General');

  // Sync category when AI extracts it
  useEffect(() => {
    if (extractedData?.category) {
      setSelectedCategory(extractedData.category);
    }
  }, [extractedData]);

  // Auto-detect current tab if running as Chrome Extension
  useEffect(() => {
    if (isOpen && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        if (chrome.runtime.lastError) {
          console.warn("Could not query tabs:", chrome.runtime.lastError);
          return;
        }
        const activeTab = tabs?.[0];
        const isInternalPage = activeTab?.url?.startsWith('chrome://') || 
                             activeTab?.url?.startsWith('edge://') || 
                             activeTab?.url?.startsWith('chrome-extension://');
                             
        if (activeTab?.url && !isInternalPage) {
          setUrl(activeTab.url);
          setManualData(prev => ({ ...prev, title: activeTab.title || '' }));
          // Auto-categorize immediately for extension
          const category = suggestCategory(activeTab.url, activeTab.title);
          setSelectedCategory(category);
        }
      });
    }
  }, [isOpen]);

  const [extractError, setExtractError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!url) return;
    setIsExtracting(true);
    setExtractError(null);
    
    // Deterministic Smart Categorization (Instant, No AI)
    try {
      const urlObj = new URL(url);
      const title = manualData.title || urlObj.hostname;
      const category = suggestCategory(url, title);
      
      let tags: string[] = [];
      if (category === 'Development') tags = ['coding', 'dev'];
      if (category === 'Design') tags = ['design', 'uiux'];
      if (category === 'Reading List') tags = ['reading', 'article'];
      if (category === 'Resource') tags = ['resource', 'edu'];
      if (category === 'Tool') tags = ['tool', 'utility'];

      setExtractedData({
        title,
        description: '',
        summary: '',
        category,
        tags
      });
      setIsManualMode(false);
    } catch (error: any) {
      setExtractError("Please enter a valid URL.");
      setIsManualMode(true);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    const dataToSave = isManualMode ? manualData : extractedData;
    if (!dataToSave || !user) return;
    setIsSaving(true);
    
    const bookmarkId = Math.random().toString(36).substr(2, 9);
    const newBookmark: Bookmark = {
      id: bookmarkId,
      userId: user.uid,
      url,
      title: dataToSave.title,
      description: dataToSave.description,
      smartSummary: isManualMode ? dataToSave.description : dataToSave.summary,
      tags: isManualMode ? dataToSave.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : dataToSave.tags,
      category: selectedCategory,
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`
    };
    
    const path = `users/${user.uid}/bookmarks/${bookmarkId}`;
    try {
      await setDoc(doc(db, path), newBookmark);
      onAdd(newBookmark);
      onClose();
      setUrl('');
      setExtractedData(null);
    } catch (error: any) {
      handleFirestoreError(error, 'create', path);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
          >
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Save Link</h2>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Source URL</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative group">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 transition-colors group-focus-within:text-blue-500" size={16} />
                    <input
                      type="url"
                      placeholder="https://colab.google/..."
                      className={cn(
                        "w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:shadow-[0_0_0_2px_theme(colors.blue.500)] outline-none transition-all",
                        extractError && "ring-2 ring-red-500/20"
                      )}
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setExtractError(null);
                      }}
                    />
                  </div>
                  <button
                    onClick={handleExtract}
                    disabled={!url || isExtracting}
                    className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-blue-500/20"
                  >
                    {isExtracting ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  </button>
                </div>
                {extractError && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 font-medium px-4 flex items-center gap-1.5">
                      <Sparkles size={14} className="shrink-0" />
                      {extractError}
                    </div>

                    <div className="space-y-4 pt-2">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Title</label>
                          <input 
                            type="text" 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:shadow-[0_0_0_2px_theme(colors.blue.500)] outline-none transition-all" 
                            value={manualData.title}
                            onChange={(e) => setManualData({...manualData, title: e.target.value})}
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Tags (Comma separated)</label>
                          <input 
                            type="text" 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:shadow-[0_0_0_2px_theme(colors.blue.500)] outline-none transition-all" 
                            placeholder="productivity, research, dev"
                            value={manualData.tags}
                            onChange={(e) => setManualData({...manualData, tags: e.target.value})}
                          />
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Category</label>
                          <select 
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:shadow-[0_0_0_2px_theme(colors.blue.500)] transition-all appearance-none"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            {!CATEGORIES.includes(selectedCategory) && (
                              <option value={selectedCategory}>{selectedCategory}</option>
                            )}
                          </select>
                       </div>

                       <button
                         onClick={handleSave}
                         disabled={isSaving || !manualData.title}
                         className="w-full bg-blue-600 text-white py-4 rounded-[24px] text-base font-bold flex items-center justify-center gap-3 mt-4 hover:bg-blue-700 transition-all disabled:opacity-50"
                       >
                         {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                         {isSaving ? 'Saving...' : 'Save Manually'}
                       </button>

                       <button 
                         onClick={() => {
                           setIsManualMode(false);
                           setExtractError(null);
                         }}
                         className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                       >
                         Try AI Again
                       </button>
                    </div>
                  </motion.div>
                )}
              </div>

              <AnimatePresence>
                {extractedData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6 pt-6 border-t border-slate-100"
                  >
                    <div className="space-y-2">
                      <h3 className="font-bold text-xl leading-tight text-slate-900">{extractedData.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{extractedData.description}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                       {extractedData.tags.map((tag: string) => (
                         <span key={tag} className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider border border-slate-100">
                           {tag}
                         </span>
                       ))}
                     </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Selected Category</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:shadow-[0_0_0_2px_theme(colors.blue.500)] transition-all appearance-none"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          {!CATEGORIES.includes(selectedCategory) && (
                            <option value={selectedCategory}>{selectedCategory}</option>
                          )}
                        </select>
                     </div>

                    <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 italic text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      "{extractedData.summary}"
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full bg-blue-600 text-white py-4 rounded-[24px] text-base font-bold flex items-center justify-center gap-3 mt-4 hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                      {isSaving ? 'Processing...' : 'Add to Collection'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
