import { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, BookOpen, Newspaper, Clock, Link, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { STATUS_LABELS, formatTimeRead, countWords } from '../lib/types';
import type { Status, EntryType, Profile, ReadingEntry } from '../lib/types';
import BookSearch from './BookSearch';

interface Props {
  currentUser: Profile;
  editEntry?: ReadingEntry;
  onClose: () => void;
  onSaved: () => void;
}

type ModalMode = 'new_entry' | 'log_time';

const STATUSES: Status[] = ['want_to_read', 'reading', 'finished', 'did_not_finish'];

const STATUS_BTN: Record<Status, string> = {
  want_to_read: 'border-brand-blue bg-brand-blue text-white',
  reading: 'border-brand-yellow bg-brand-yellow text-gray-900',
  finished: 'border-brand-red bg-brand-red text-white',
  did_not_finish: 'border-gray-800 bg-gray-800 text-white',
};

function statusLabel(s: Status): string {
  if (s === 'did_not_finish') return 'DNF';
  return STATUS_LABELS[s];
}

export default function LogEntryModal({ currentUser, editEntry, onClose, onSaved }: Props) {
  const isEditing = !!editEntry;
  const [modalMode, setModalMode] = useState<ModalMode>('new_entry');
  const [entryType, setEntryType] = useState<EntryType>(editEntry?.entry_type ?? 'book');

  // New entry fields
  const [title, setTitle] = useState(editEntry?.book?.title ?? '');
  const [author, setAuthor] = useState(editEntry?.book?.author ?? '');
  const [status, setStatus] = useState<Status>(editEntry?.status ?? 'reading');
  const [hours, setHours] = useState(editEntry ? String(Math.floor((editEntry.time_read_minutes ?? 0) / 60)) : '');
  const [minutes, setMinutes] = useState(editEntry ? String((editEntry.time_read_minutes ?? 0) % 60) : '');
  const [note, setNote] = useState(editEntry?.note ?? '');
  const [mediaUrl, setMediaUrl] = useState<string | null>(editEntry?.media_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coverId, setCoverId] = useState<number | null>(
    editEntry?.book?.open_library_cover_id ? parseInt(editEntry.book.open_library_cover_id) : null
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(editEntry?.book?.cover_url ?? null);
  const [isbn, setIsbn] = useState<string | null>(editEntry?.book?.isbn ?? null);
  const [description, setDescription] = useState<string | null>(editEntry?.book?.description ?? null);
  const [articleUrl, setArticleUrl] = useState(editEntry?.book?.source_url ?? '');
  const [fetchingMeta, setFetchingMeta] = useState(false);

  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPasteMode, setCoverPasteMode] = useState(false);
  const [coverPasteValue, setCoverPasteValue] = useState('');
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [logPhotoPickerOpen, setLogPhotoPickerOpen] = useState(false);
  const [logPhotoUrlInput, setLogPhotoUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const photoPickerRef = useRef<HTMLDivElement>(null);
  const logPhotoPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entryType !== 'article') return;
    const trimmed = articleUrl.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    const t = setTimeout(async () => {
      setFetchingMeta(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-link-preview`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ url: trimmed }),
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.title && !title) setTitle(data.title);
        if (!author) {
          const parts = [data.author, data.siteName].filter(Boolean);
          if (parts.length) setAuthor(parts.join(', '));
        }
        if (data.image && !coverUrl) setCoverUrl(data.image);
      } catch {
        // silently ignore
      } finally {
        setFetchingMeta(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [articleUrl, entryType]);

  useEffect(() => {
    if (!photoPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (photoPickerRef.current && !photoPickerRef.current.contains(e.target as Node)) setPhotoPickerOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [photoPickerOpen]);

  useEffect(() => {
    if (!logPhotoPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (logPhotoPickerRef.current && !logPhotoPickerRef.current.contains(e.target as Node)) setLogPhotoPickerOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [logPhotoPickerOpen]);

  // Log time fields
  const [userEntries, setUserEntries] = useState<ReadingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ReadingEntry | null>(null);
  const [logMinutes, setLogMinutes] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logMediaUrl, setLogMediaUrl] = useState<string | null>(null);
  const [logStatusOverride, setLogStatusOverride] = useState<Status | null>(null);
  const [logUploading, setLogUploading] = useState(false);
  const logFileRef = useRef<HTMLInputElement>(null);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    const ext = file.name.split('.').pop();
    const path = `covers/${currentUser.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('media').upload(path, file);
    if (uploadErr) { setError('Cover upload failed.'); setCoverUploading(false); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    setCoverUrl(data.publicUrl);
    setCoverId(null);
    setCoverUploading(false);
  }

  async function loadUserEntries() {
    setLoadingEntries(true);
    const { data } = await supabase
      .from('reading_entries')
      .select('*, books(*)')
      .eq('user_id', currentUser.id)
      .in('status', ['reading', 'finished'])
      .order('created_at', { ascending: false });
    setUserEntries(
      (data ?? []).map((e) => ({ ...e, book: e.books ?? null }))
    );
    setLoadingEntries(false);
  }

  function handleEnrich(data: { title: string; author: string; isbn: string | null; coverUrl: string | null; description: string | null }) {
    setAuthor(data.author);
    setCoverId(null);
    setCoverUrl(data.coverUrl);
    setIsbn(data.isbn);
    setDescription(data.description);
  }

  function handleTypeSwitch(t: EntryType) {
    setEntryType(t);
    setTitle('');
    setAuthor('');
    setCoverId(null);
    setCoverUrl(null);
    setIsbn(null);
    setArticleUrl('');
    setError(null);
  }

  function handleModeSwitch(mode: ModalMode) {
    setModalMode(mode);
    setError(null);
    if (mode === 'log_time' && userEntries.length === 0) {
      loadUserEntries();
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('media').upload(path, file);
    if (uploadErr) { setError('Upload failed.'); setUploading(false); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    setMediaUrl(data.publicUrl);
    setUploading(false);
  }

  async function handleSaveEntry() {
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!isEditing && countWords(note) > 150) { setError('Note exceeds the 150 word limit.'); return; }
    setSaving(true);
    setError(null);

    const totalMinutes = (parseInt(hours || '0', 10) * 60) + parseInt(minutes || '0', 10);

    if (!isEditing && totalMinutes > 3000) { setError('Time limit is 50 hours per entry.'); setSaving(false); return; }

    if (isEditing && editEntry) {
      if (editEntry.book_id) {
        await supabase
          .from('books')
          .update({ title: title.trim(), author: author.trim() || 'Unknown', cover_url: coverUrl ?? null })
          .eq('id', editEntry.book_id);
      }
      const { error: entryErr } = await supabase
        .from('reading_entries')
        .update({
          status,
          note: note.trim() || null,
          time_read_minutes: totalMinutes,
          media_url: mediaUrl,
          media_type: mediaUrl ? 'upload' : null,
        })
        .eq('id', editEntry.id);
      if (entryErr) { setError('Failed to update entry.'); setSaving(false); return; }
      onSaved();
      return;
    }

    const bookshopUrl = entryType === 'book'
      ? `https://bookshop.org/beta-search?keywords=${encodeURIComponent(title + (author ? ' ' + author : ''))}`
      : null;

    let bookId: string;
    const { data: existing } = await supabase
      .from('books')
      .select('id')
      .eq('title', title.trim())
      .eq('author', author.trim() || 'Unknown')
      .maybeSingle();

    if (existing) {
      bookId = existing.id;
    } else {
      const { data: newBook, error: bookErr } = await supabase
        .from('books')
        .insert({
          title: title.trim(),
          author: author.trim() || 'Unknown',
          isbn: isbn ?? null,
          open_library_cover_id: coverId ? String(coverId) : null,
          cover_url: coverUrl ?? null,
          bookshop_url: bookshopUrl,
          source_url: entryType === 'article' ? (articleUrl.trim() || null) : null,
          description: entryType === 'book' ? (description ?? null) : null,
        })
        .select('id')
        .single();

      if (bookErr || !newBook) {
        setError('Failed to save. Please try again.');
        setSaving(false);
        return;
      }
      bookId = newBook.id;
    }

    const { error: entryErr } = await supabase.from('reading_entries').insert({
      book_id: bookId,
      entry_type: entryType,
      status,
      time_read_minutes: totalMinutes,
      note: note.trim() || null,
      media_url: mediaUrl,
      media_type: mediaUrl ? 'upload' : null,
      finished_at: (status === 'finished' || status === 'did_not_finish') ? new Date().toISOString() : null,
    });

    if (entryErr) { setError('Failed to save entry.'); setSaving(false); return; }
    onSaved();
  }

  async function handleLogPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('media').upload(path, file);
    if (uploadErr) { setError('Upload failed.'); setLogUploading(false); return; }
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    setLogMediaUrl(data.publicUrl);
    setLogUploading(false);
  }

  async function handleSaveTimeLog() {
    if (!selectedEntry) { setError('Select a book first.'); return; }
    const mins = parseInt(logMinutes || '0', 10);
    if (!mins || mins <= 0) { setError('Enter a time greater than 0.'); return; }
    if (mins > 600) { setError('Time limit is 10 hours per log entry.'); return; }
    if (countWords(logNote) > 150) { setError('Note exceeds the 150 word limit.'); return; }
    setSaving(true);
    setError(null);

    const statusChanged = logStatusOverride && logStatusOverride !== selectedEntry.status;

    const { error: logErr } = await supabase.from('time_logs').insert({
      entry_id: selectedEntry.id,
      book_id: selectedEntry.book_id,
      minutes_added: mins,
      note: logNote.trim() || null,
      media_url: logMediaUrl,
      status_override: statusChanged ? logStatusOverride : null,
    });

    if (logErr) { setError('Failed to log time.'); setSaving(false); return; }

    if (statusChanged) {
      const entryUpdate: Record<string, unknown> = { status: logStatusOverride };
      if (logStatusOverride === 'finished' || logStatusOverride === 'did_not_finish') entryUpdate.finished_at = new Date().toISOString();
      await supabase
        .from('reading_entries')
        .update(entryUpdate)
        .eq('id', selectedEntry.id);
    }

    onSaved();
  }

  const canSaveEntry = title.trim().length > 0;
  const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5';
  const inputClass = 'w-full px-3 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="bg-white w-full max-w-lg border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)] max-h-[92vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-brand-blue bg-brand-yellow sticky top-0 z-10">
          <h2 className="font-bold text-lg uppercase text-brand-blue">
            {isEditing ? 'Edit Entry' : modalMode === 'log_time' ? 'Log Time' : 'Log an Entry'}
          </h2>
          <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity">
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        {/* Mode toggle — only shown when not editing */}
        {!isEditing && (
          <div className="flex border-b-2 border-brand-blue">
            <button
              type="button"
              onClick={() => handleModeSwitch('new_entry')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm uppercase border-r-2 border-brand-blue transition-colors ${
                modalMode === 'new_entry' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              New Entry
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('log_time')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm uppercase transition-colors ${
                modalMode === 'log_time' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-4 h-4" />
              Log Time
            </button>
          </div>
        )}

        {/* ─── LOG TIME MODE ─── */}
        {modalMode === 'log_time' && (
          <div className="px-5 py-5 space-y-5">
            <div>
              <p className={labelClass}>Select a book you&rsquo;re reading or have finished</p>
              {loadingEntries ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : userEntries.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 px-4 py-6 text-center">
                  <p className="text-sm text-gray-400">No books in progress or finished yet.</p>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('new_entry')}
                    className="mt-2 text-sm text-brand-blue underline font-medium"
                  >
                    Log a new entry first
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto border-2 border-brand-blue">
                  {userEntries.map((entry) => {
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          const next = isSelected ? null : entry;
                          setSelectedEntry(next);
                          setLogStatusOverride(next ? next.status : null);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left border-b border-gray-100 last:border-0 ${
                          isSelected ? 'bg-brand-yellow' : 'hover:bg-gray-50'
                        }`}
                      >
                        {entry.book?.cover_url ? (
                          <img
                            src={entry.book.cover_url}
                            alt=""
                            className="w-8 h-11 object-cover border border-brand-blue shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-8 h-11 bg-gray-100 border border-brand-blue shrink-0 flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{entry.book?.title}</p>
                          <p className="text-xs text-gray-500 truncate">{entry.book?.author}</p>
                        </div>
                        <div className="shrink-0">
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 border border-gray-300 text-gray-500">
                            {STATUS_LABELS[entry.status]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedEntry && (
              <>
                <div>
                  <p className={labelClass}>
                    Time to add{' '}
                    {selectedEntry.time_read_minutes > 0 && (
                      <span className="normal-case font-normal text-gray-400">
                        ({formatTimeRead(selectedEntry.time_read_minutes)} already logged)
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={Math.floor(parseInt(logMinutes || '0') / 60) || ''}
                        onChange={(e) => {
                          const h = Math.min(parseInt(e.target.value || '0', 10), 10);
                          const m = parseInt(logMinutes || '0', 10) % 60;
                          setLogMinutes(String(h * 60 + m));
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2.5 pr-10 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hrs</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={parseInt(logMinutes || '0') % 60 || ''}
                        onChange={(e) => {
                          const h = Math.floor(parseInt(logMinutes || '0') / 60);
                          const m = parseInt(e.target.value || '0', 10);
                          setLogMinutes(String(h * 60 + m));
                        }}
                        placeholder="0"
                        className="w-full px-3 py-2.5 pr-10 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className={labelClass}>Update Status</p>
                  <div className="flex gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLogStatusOverride(s)}
                        className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide border-2 transition-colors ${
                          logStatusOverride === s
                            ? STATUS_BTN[s]
                            : 'border-gray-200 bg-white text-gray-400 hover:border-brand-blue hover:text-gray-900'
                        }`}
                      >
                        {statusLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={labelClass}>Note <span className="font-normal normal-case">(optional)</span></p>
                  <textarea
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    placeholder="What did you read today?"
                    rows={2}
                    className="w-full px-3 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue resize-none"
                  />
                  {countWords(logNote) >= 140 && (
                    <p className={`text-[11px] mt-1 text-right font-medium ${countWords(logNote) > 150 ? 'text-brand-red' : 'text-amber-500'}`}>
                      {countWords(logNote)} / 150 words
                    </p>
                  )}
                </div>

                <div>
                  <p className={labelClass}>Photo <span className="font-normal normal-case">(optional)</span></p>
                  {logMediaUrl ? (
                    <div className="relative inline-block border-2 border-brand-blue">
                      <img src={logMediaUrl} alt="Attached" className="max-h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => setLogMediaUrl(null)}
                        className="absolute -top-2.5 -right-2.5 bg-gray-900 text-white w-6 h-6 flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative inline-block" ref={logPhotoPickerRef}>
                      <button
                        type="button"
                        onClick={() => setLogPhotoPickerOpen((o) => !o)}
                        disabled={logUploading}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-brand-blue hover:text-gray-900 transition-colors disabled:opacity-50"
                      >
                        {logUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {logUploading ? 'Uploading…' : 'Add a photo'}
                      </button>
                      {logPhotoPickerOpen && (
                        <div className="absolute left-0 top-full mt-0.5 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] w-64">
                          <button
                            type="button"
                            onClick={() => { setLogPhotoPickerOpen(false); logFileRef.current?.click(); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue border-b border-gray-100 hover:bg-blue-50 transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Upload from file
                          </button>
                          <div className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Link className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <input
                                type="url"
                                value={logPhotoUrlInput}
                                onChange={(e) => setLogPhotoUrlInput(e.target.value)}
                                placeholder="Paste image URL…"
                                className="flex-1 text-xs border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-brand-blue"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && logPhotoUrlInput.trim()) {
                                    setLogMediaUrl(logPhotoUrlInput.trim());
                                    setLogPhotoUrlInput('');
                                    setLogPhotoPickerOpen(false);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (logPhotoUrlInput.trim()) {
                                    setLogMediaUrl(logPhotoUrlInput.trim());
                                    setLogPhotoUrlInput('');
                                    setLogPhotoPickerOpen(false);
                                  }
                                }}
                                className="px-2 py-1.5 bg-brand-blue text-white text-[10px] font-bold uppercase hover:bg-blue-800 transition-colors"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <input ref={logFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogPhotoUpload} />
                </div>
              </>
            )}

            {error && (
              <div className="border-2 border-brand-red bg-red-50 text-brand-red text-sm font-medium px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border-2 border-brand-blue text-gray-900 font-semibold text-sm uppercase hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTimeLog}
                disabled={saving || !selectedEntry || !logMinutes || parseInt(logMinutes) <= 0}
                className="flex-1 py-2.5 border-2 border-brand-blue bg-brand-yellow hover:bg-yellow-300 text-gray-900 font-semibold text-sm uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Log Time'}
              </button>
            </div>
          </div>
        )}

        {/* ─── NEW ENTRY / EDIT MODE ─── */}
        {(modalMode === 'new_entry' || isEditing) && (
          <>
            <div className="px-5 py-5 space-y-5">
              {/* Entry type selector — hidden in edit mode */}
              {!isEditing && (
                <div>
                  <p className={`${labelClass} block`}>Type</p>
                  <div className="flex border-2 border-brand-blue">
                    <button
                      type="button"
                      onClick={() => handleTypeSwitch('book')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm uppercase border-r-2 border-brand-blue transition-colors ${
                        entryType === 'book' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      Book
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeSwitch('article')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm uppercase transition-colors ${
                        entryType === 'article' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Newspaper className="w-4 h-4" />
                      Article
                    </button>
                  </div>
                </div>
              )}

              {/* Article URL — shown first so it can populate title/author */}
              {entryType === 'article' && !isEditing && (
                <div>
                  <p className={`${labelClass} flex items-center gap-1.5`}>
                    <Link className="w-3 h-3" />
                    URL <span className="font-normal normal-case">(optional)</span>
                    {fetchingMeta && <Loader2 className="w-3 h-3 animate-spin ml-1 text-brand-blue" />}
                  </p>
                  <input
                    type="url"
                    value={articleUrl}
                    onChange={(e) => setArticleUrl(e.target.value)}
                    placeholder="https://… paste to auto-fill title"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Title */}
              <div>
                {entryType !== 'book' && (
                  <p className={`${labelClass} block`}>Article Title</p>
                )}
                {entryType === 'book' ? (
                  <BookSearch
                    title={title}
                    author={author}
                    onTitleChange={setTitle}
                    onAuthorChange={setAuthor}
                    onEnrich={handleEnrich}
                  />
                ) : (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter article title…"
                    className={inputClass}
                  />
                )}
              </div>

              {/* Author / source — for articles; for books it's inside BookSearch */}
              {entryType === 'article' && (
                <div>
                  <p className={`${labelClass} block`}>
                    {entryType === 'book' ? 'Author' : 'Author / Publication'}
                  </p>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder={entryType === 'book' ? 'Author name…' : 'e.g. The New Yorker, Jane Smith…'}
                    className={inputClass}
                  />
                </div>
              )}

              {/* Article URL stored for edit mode */}
              {entryType === 'article' && isEditing && (
                <div>
                  <p className={`${labelClass} block`}>
                    URL <span className="font-normal normal-case">(optional)</span>
                  </p>
                  <input
                    type="url"
                    value={articleUrl}
                    onChange={(e) => setArticleUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Book cover — preview if found, upload option when no cover */}
              {entryType === 'book' && title.trim() && (
                <div>
                  {coverUrl ? (
                    <div className="flex items-center gap-3 border-2 border-brand-blue p-3 bg-gray-50">
                      <img src={coverUrl} alt="" className="w-10 h-14 object-cover border-2 border-brand-blue" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900 truncate">{title}</p>
                        <p className="text-xs text-gray-500 truncate">{author}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCoverUrl(null); setCoverId(null); if (coverFileRef.current) coverFileRef.current.value = ''; }}
                        className="shrink-0 p-1 text-gray-400 hover:text-gray-900 transition-colors"
                        title="Remove cover"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className={`${labelClass} block`}>
                        Cover Photo <span className="font-normal normal-case">(optional)</span>
                      </p>
                      {coverPasteMode ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            autoFocus
                            value={coverPasteValue}
                            onChange={(e) => setCoverPasteValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const url = coverPasteValue.trim();
                                if (url) { setCoverUrl(url); setCoverId(null); }
                                setCoverPasteMode(false);
                                setCoverPasteValue('');
                              }
                              if (e.key === 'Escape') { setCoverPasteMode(false); setCoverPasteValue(''); }
                            }}
                            placeholder="Paste image URL and press Enter…"
                            className="flex-1 px-3 py-2 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:ring-0 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const url = coverPasteValue.trim();
                              if (url) { setCoverUrl(url); setCoverId(null); }
                              setCoverPasteMode(false);
                              setCoverPasteValue('');
                            }}
                            className="px-3 py-2 bg-brand-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => { setCoverPasteMode(false); setCoverPasteValue(''); }}
                            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => coverFileRef.current?.click()}
                            disabled={coverUploading}
                            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-brand-blue hover:text-gray-900 transition-colors disabled:opacity-50"
                          >
                            {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {coverUploading ? 'Uploading…' : 'Upload cover image'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoverPasteMode(true)}
                            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-brand-blue hover:text-gray-900 transition-colors"
                          >
                            <Link className="w-4 h-4" />
                            Paste URL
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                  />
                </div>
              )}

              {/* Status */}
              <div>
                <p className={`${labelClass} block`}>Status</p>
                <div className="flex gap-0 border-2 border-brand-blue">
                  {STATUSES.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-2 text-xs font-semibold uppercase transition-colors ${
                        i > 0 ? 'border-l-2 border-brand-blue' : ''
                      } ${status === s && i < STATUSES.length - 1 ? 'border-r-2 border-brand-blue' : ''
                      } ${status === s ? STATUS_BTN[s] : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                    >
                      {s === 'did_not_finish' ? 'DNF' : STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time read */}
              <div>
                <p className={`${labelClass} block`}>
                  Time Read <span className="font-normal normal-case">(optional)</span>
                </p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max={isEditing ? undefined : 50}
                      value={hours}
                      onChange={(e) => {
                        const val = isEditing ? e.target.value : String(Math.min(parseInt(e.target.value || '0', 10), 50));
                        setHours(val === '0' ? '' : val);
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2.5 pr-10 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hrs</span>
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 pr-10 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <p className={`${labelClass} block`}>
                  Note <span className="font-normal normal-case">(optional)</span>
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Thoughts, quotes, reactions…"
                  rows={3}
                  className="w-full px-3 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:border-brand-blue resize-none"
                />
                {countWords(note) >= 140 && (
                  <div className="mt-1 flex flex-col items-end gap-0.5">
                    <p className={`text-[11px] font-medium ${countWords(note) > 150 ? 'text-brand-red' : 'text-amber-500'}`}>
                      {countWords(note)} / 150 words
                    </p>
                    {countWords(note) >= 150 && !isEditing && (
                      <p className="text-[11px] text-gray-400">Word limit reached — continue your thoughts in the comments after saving</p>
                    )}
                  </div>
                )}
              </div>

              {/* Photo */}
              <div>
                <p className={`${labelClass} block`}>
                  Photo <span className="font-normal normal-case">(optional)</span>
                </p>
                {mediaUrl ? (
                  <div className="relative inline-block border-2 border-brand-blue">
                    <img src={mediaUrl} alt="Attached" className="max-h-40 object-cover" />
                    <button
                      onClick={() => setMediaUrl(null)}
                      className="absolute -top-2.5 -right-2.5 bg-gray-900 text-white w-6 h-6 flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative inline-block" ref={photoPickerRef}>
                    <button
                      type="button"
                      onClick={() => setPhotoPickerOpen((o) => !o)}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-brand-blue hover:text-gray-900 transition-colors disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? 'Uploading…' : 'Add a photo'}
                    </button>
                    {photoPickerOpen && (
                      <div className="absolute left-0 top-full mt-0.5 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] w-64">
                        <button
                          type="button"
                          onClick={() => { setPhotoPickerOpen(false); fileRef.current?.click(); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue border-b border-gray-100 hover:bg-blue-50 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Upload from file
                        </button>
                        <div className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <input
                              type="url"
                              value={photoUrlInput}
                              onChange={(e) => setPhotoUrlInput(e.target.value)}
                              placeholder="Paste image URL…"
                              className="flex-1 text-xs border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-brand-blue"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && photoUrlInput.trim()) {
                                  setMediaUrl(photoUrlInput.trim());
                                  setPhotoUrlInput('');
                                  setPhotoPickerOpen(false);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (photoUrlInput.trim()) {
                                  setMediaUrl(photoUrlInput.trim());
                                  setPhotoUrlInput('');
                                  setPhotoPickerOpen(false);
                                }
                              }}
                              className="px-2 py-1.5 bg-brand-blue text-white text-[10px] font-bold uppercase hover:bg-blue-800 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>

              {error && (
                <div className="border-2 border-brand-red bg-red-50 text-brand-red text-sm font-medium px-4 py-3">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t-2 border-brand-blue flex gap-3 bg-gray-50">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border-2 border-brand-blue text-gray-900 font-semibold text-sm uppercase hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={saving || !canSaveEntry}
                className="flex-1 py-2.5 border-2 border-brand-blue bg-brand-yellow hover:bg-yellow-300 text-gray-900 font-semibold text-sm uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
