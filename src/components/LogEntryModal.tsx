import { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, BookOpen, Headphones, Link, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { statusLabel as sharedStatusLabel, countWords } from '../lib/types';
import type { Status, EntryType, Profile, ReadingEntry } from '../lib/types';
import BookSearch from './BookSearch';
import MentionTextarea from './MentionTextarea';
import { sendMentionNotifications } from '../lib/mentions';
import { safeHttpUrl, isSafeHttpUrl } from '../lib/safeUrl';

interface PrefillBook {
  title: string;
  author: string;
  isbn: string | null;
  coverUrl: string | null;
  description: string | null;
}

interface Props {
  currentUser: Profile;
  allProfiles: Profile[];
  editEntry?: ReadingEntry;
  prefillBook?: PrefillBook;
  onClose: () => void;
  onSaved: () => void;
}

type ModalMode = 'new_entry';

const STATUSES: Status[] = ['want_to_read', 'reading', 'finished', 'did_not_finish'];

const STATUS_BTN: Record<Status, string> = {
  want_to_read: 'border-brand-blue bg-brand-blue text-white',
  reading: 'border-brand-yellow bg-brand-yellow text-gray-900',
  finished: 'border-brand-red bg-brand-red text-white',
  did_not_finish: 'border-gray-800 bg-gray-800 text-white',
};

function statusLabel(s: Status, type: EntryType): string {
  if (s === 'did_not_finish') return 'DNF';
  return sharedStatusLabel(s, type);
}

export default function LogEntryModal({ currentUser, allProfiles, editEntry, prefillBook, onClose, onSaved }: Props) {
  const isEditing = !!editEntry;
  const [modalMode] = useState<ModalMode>('new_entry');
  const [entryType, setEntryType] = useState<EntryType>(editEntry?.entry_type ?? 'book');

  // New entry fields
  const [title, setTitle] = useState(editEntry?.book?.title ?? prefillBook?.title ?? '');
  const [author, setAuthor] = useState(editEntry?.book?.author ?? prefillBook?.author ?? '');
  const [status, setStatus] = useState<Status>(editEntry?.status ?? 'reading');
  const [note, setNote] = useState(editEntry?.note ?? '');
  const [mediaUrl, setMediaUrl] = useState<string | null>(editEntry?.media_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coverId, setCoverId] = useState<number | null>(
    editEntry?.book?.open_library_cover_id ? parseInt(editEntry.book.open_library_cover_id) : null
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(editEntry?.book?.cover_url ?? prefillBook?.coverUrl ?? null);
  const [isbn, setIsbn] = useState<string | null>(editEntry?.book?.isbn ?? prefillBook?.isbn ?? null);
  const [description, setDescription] = useState<string | null>(editEntry?.book?.description ?? prefillBook?.description ?? null);
  const [listenUrl, setListenUrl] = useState(editEntry?.book?.source_url ?? '');
  const [narrator, setNarrator] = useState(editEntry?.book?.narrator ?? '');

  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPasteMode, setCoverPasteMode] = useState(false);
  const [coverPasteValue, setCoverPasteValue] = useState('');
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const photoPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!photoPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (photoPickerRef.current && !photoPickerRef.current.contains(e.target as Node)) setPhotoPickerOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [photoPickerOpen]);

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
    setListenUrl('');
    setNarrator('');
    setError(null);
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
    if (entryType === 'audiobook' && listenUrl.trim() && !isSafeHttpUrl(listenUrl)) {
      setError('The listen link must start with http:// or https://');
      return;
    }
    setSaving(true);
    setError(null);

    if (isEditing && editEntry) {
      if (editEntry.book_id) {
        await supabase
          .from('books')
          .update({ title: title.trim(), author: author.trim() || 'Unknown', cover_url: coverUrl ?? null, narrator: entryType === 'audiobook' ? (narrator.trim() || null) : null })
          .eq('id', editEntry.book_id);
      }
      const { error: entryErr } = await supabase
        .from('reading_entries')
        .update({
          status,
          note: note.trim() || null,
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
      : `https://libro.fm/search?q=${encodeURIComponent(title + (author ? ' ' + author : ''))}`;

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
          source_url: entryType === 'audiobook' ? safeHttpUrl(listenUrl) : null,
          narrator: entryType === 'audiobook' ? (narrator.trim() || null) : null,
          description: description ?? null,
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

    const { data: newEntry, error: entryErr } = await supabase.from('reading_entries').insert({
      book_id: bookId,
      entry_type: entryType,
      status,
      note: note.trim() || null,
      media_url: mediaUrl,
      media_type: mediaUrl ? 'upload' : null,
      finished_at: (status === 'finished' || status === 'did_not_finish') ? new Date().toISOString() : null,
    }).select('id').single();

    if (entryErr) { setError('Failed to save entry.'); setSaving(false); return; }
    if (note.trim()) {
      await sendMentionNotifications(note, allProfiles, currentUser.id, newEntry?.id ?? null, null, null);
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
            {isEditing ? 'Edit Entry' : entryType === 'audiobook' ? 'Log an Audiobook' : 'Log a Book'}
          </h2>
          <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity">
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

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
                      onClick={() => handleTypeSwitch('audiobook')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm uppercase transition-colors ${
                        entryType === 'audiobook' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Headphones className="w-4 h-4" />
                      Audiobook
                    </button>
                  </div>
                </div>
              )}

              {/* Title + Author via BookSearch — for both book and audiobook */}
              <div>
                <BookSearch
                  title={title}
                  author={author}
                  onTitleChange={setTitle}
                  onAuthorChange={setAuthor}
                  onEnrich={handleEnrich}
                  titleLabel={entryType === 'audiobook' ? 'Audiobook Title' : 'Book Title'}
                />
              </div>

              {/* Narrator — audiobook only */}
              {entryType === 'audiobook' && (
                <div>
                  <p className={`${labelClass} block`}>
                    Narrator <span className="font-normal normal-case">(optional)</span>
                  </p>
                  <input
                    type="text"
                    value={narrator}
                    onChange={(e) => setNarrator(e.target.value)}
                    placeholder="e.g. Toni Morrison"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Listen Link — audiobook only */}
              {entryType === 'audiobook' && (
                <div>
                  <p className={`${labelClass} flex items-center gap-1.5`}>
                    <Link className="w-3 h-3" />
                    Listen Link <span className="font-normal normal-case">(optional)</span>
                  </p>
                  <input
                    type="url"
                    value={listenUrl}
                    onChange={(e) => setListenUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Cover — preview if found, upload option when no cover */}
              {title.trim() && (
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
                      {statusLabel(s, entryType)}
                    </button>
                  ))}
                </div>
              </div>


              {/* Note */}
              <div>
                <p className={`${labelClass} block`}>
                  Note <span className="font-normal normal-case">(optional)</span>
                </p>
                <MentionTextarea
                  value={note}
                  onChange={setNote}
                  allProfiles={allProfiles}
                  currentUserId={currentUser.id}
                  placeholder="Thoughts, quotes, reactions…"
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
