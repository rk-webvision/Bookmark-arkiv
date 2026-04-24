import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, FileJson, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Bookmark } from '../types';
import { suggestCategory } from '../services/categorizationService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [importCount, setImportCount] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setImportStatus('idle');

    try {
      const text = await file.text();
      let bookmarksToImport: any[] = [];

      if (file.name.endsWith('.json')) {
        bookmarksToImport = JSON.parse(text);
      } else {
        // Simple HTML parser for exported bookmarks (naive approach)
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'));
        bookmarksToImport = links.map(link => ({
          title: link.textContent || 'Untitled',
          url: link.getAttribute('href'),
          createdAt: parseInt(link.getAttribute('add_date') || '0') * 1000 || Date.now()
        }));
      }

      const batchSize = 500;
      let totalImported = 0;

      for (let i = 0; i < bookmarksToImport.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = bookmarksToImport.slice(i, i + batchSize);

        chunk.forEach(item => {
          if (!item.url) return;
          const bookmarkId = Math.random().toString(36).substr(2, 9);
          const category = suggestCategory(item.url, item.title);
          
          const bookmark: Bookmark = {
            id: bookmarkId,
            userId: user.uid,
            url: item.url,
            title: item.title,
            description: '',
            smartSummary: '',
            tags: ['imported'],
            category: category,
            createdAt: item.createdAt || Date.now(),
            updatedAt: Date.now(),
            isFavorite: false,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=64`
          };
          const ref = doc(db, `users/${user.uid}/bookmarks`, bookmarkId);
          batch.set(ref, bookmark);
          totalImported++;
        });

        await batch.commit();
      }

      setImportCount(totalImported);
      setImportStatus('success');
    } catch (err: any) {
      console.error(err);
      setImportStatus('error');
      setErrorMessage(err.message || 'Failed to parse bookmarks file.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onClose}
           className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800"
        >
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                <Upload size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Import Bookmarks</h2>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">Bring your links from Chrome or Edge</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="p-8">
            {importStatus === 'idle' && (
              <div className="space-y-6">
                <label className="relative flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[24px] hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer group leading-none">
                  <input type="file" className="hidden" accept=".json,.html" onChange={handleFileUpload} disabled={isImporting} />
                  <div className={cn(
                    "w-16 h-16 rounded-[20px] flex items-center justify-center transition-all",
                    isImporting ? "bg-slate-100 dark:bg-slate-800 text-slate-300" : "bg-white dark:bg-slate-800 text-blue-500 dark:text-blue-400 shadow-xl shadow-blue-500/10 group-hover:scale-110 group-active:scale-95"
                  )}>
                    {isImporting ? <Loader2 className="animate-spin" size={32} /> : <FileJson size={32} />}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{isImporting ? 'Processing file...' : 'Drop bookmarks.html or JSON'}</p>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">Files up to 50MB supported</p>
                  </div>
                </label>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl flex gap-3 items-start border border-slate-100/50 dark:border-slate-800/50">
                  <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
                    Export your bookmarks from Chrome Settings (Bookmarks &gt; Bookmark Manager &gt; Export Bookmarks) and upload the .html file here.
                  </p>
                </div>
              </div>
            )}

            {importStatus === 'success' && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Import Complete</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{importCount} links added to your library.</p>
                </div>
                <button onClick={onClose} className="w-full bg-emerald-500 text-white py-4 rounded-2xl text-sm font-bold hover:bg-emerald-600 transition-all active:scale-95">
                  Return to Dashboard
                </button>
              </motion.div>
            )}

            {importStatus === 'error' && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Import Failed</h3>
                  <p className="text-sm font-medium text-red-500 dark:text-red-400">{errorMessage}</p>
                </div>
                <button onClick={() => setImportStatus('idle')} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95">
                  Try Again
                </button>
              </motion.div>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
