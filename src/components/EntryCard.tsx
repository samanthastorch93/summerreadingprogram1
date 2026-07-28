import { useState, useRef, useEffect } from 'react';
import { MessageCircle, BookOpen, Headphones, MoreHorizontal, PlusCircle, X, Loader2, Camera, EyeOff, Eye, ChevronDown, Link, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  timeAgo,
  formatTimeRead,
  statusLabel,
  entryStatusPhrase,
  countWords,
} from '../lib/types';
import type { ReadingEntry, Profile, BookSearchResult, Status } from '../lib/types';
import CommentSection from './CommentSection';
import ConfirmDialog from './ConfirmDialog';
import AvatarIcon from './AvatarIcon';
import BookSynopsisModal from './BookSynopsisModal';
import LikeButton from './LikeButton';

interface Props {
  entry: ReadingEntry;
  alsoLoggedBy: Profile[];
  currentUser: Profile;
  allProfiles: Profile[];
  isCommentedEntry?: boolean;
  autoExpandComments?: boolean;
  isHidden?: boolean;
  onRefresh: () => void;
  onEdit?: (entry: ReadingEntry) => void;
  onSelectUser: (userId: string) => void;
  onLogBook?: (book: BookSearchResult) => void;
}

const STATUS_STYLES: Record<string, string> = {
  want_to_read: 'bg-brand-yellow text-gray-900 border-brand-blue',
  reading: 'bg-brand-yellow text-gray-900 border-brand-blue',
  finished: 'bg-brand-yellow text-gray-900 border-brand-blue',
  did_not_finish: 'bg-gray-200 text-gray-600 border-gray-400',
};

const COVER_PAIRINGS = [
  { bg: '#0F00E3', icon: '#FFC400' },
  { bg: '#E30D00', icon: '#ffffff' },
  { bg: '#FFC400', icon: '#0F00E3' },
  { bg: '#FFE3E3', icon: '#E30D00' },
  { bg: '#E3FAFF', icon: '#0F00E3' },
];

function coverPairing(id: string) {
  const sum = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return COVER_PAIRINGS[sum % COVER_PAIRINGS.length];
}

function FaviconCover({ url, entryId }: { url: string; entryId: string }) {
  const [failed, setFailed] = useState(false);
  let domain = '';
  try { domain = new URL(url).hostname; } catch { /* ignore */ }
  const { bg, icon } = coverPairing(entryId);
  return (
    <div className="w-12 h-[68px] border-2 border-brand-blue bg-white flex items-center justify-center overflow-hidden">
      {!failed && domain ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt=""
          className="w-8 h-8 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: bg }}>
          <Headphones className="w-5 h-5" style={{ color: icon }} />
        </div>
      )}
    </div>
  );
}

export default function EntryCard({
  entry,
  alsoLoggedBy,
  currentUser,
  allProfiles,
  isCommentedEntry = false,
  autoExpandComments = false,
  isHidden = false,
  onRefresh,
  onEdit,
  onSelectUser,
  onLogBook,
}: Props) {
  const [commentsOpen, setCommentsOpen] = useState(autoExpandComments);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const entryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (autoExpandComments) {
      setCommentsOpen(true);
      setTimeout(() => entryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }, [autoExpandComments]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingTime, setAddingTime] = useState(false);
  const [addMinutes, setAddMinutes] = useState('');
  const [addNote, setAddNote] = useState('');
  const [savingTime, setSavingTime] = useState(false);
  const [noteMediaUrl, setNoteMediaUrl] = useState<string | null>(null);
  const [noteMediaUploading, setNoteMediaUploading] = useState(false);
  const [notePhotoPickerOpen, setNotePhotoPickerOpen] = useState(false);
  const [noteUrlInput, setNoteUrlInput] = useState('');
  const notePhotoPickerRef = useRef<HTMLDivElement>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likerUserIds, setLikerUserIds] = useState<string[]>([]);
  const [hideMenuOpen, setHideMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideMenuRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const noteFileRef = useRef<HTMLInputElement>(null);
  const book = entry.book;
  const profile = allProfiles.find((p) => p.id === entry.user_id) ?? entry.profile;
  const commentCount = entry.comment_ids?.length ?? 0;
  const isAudiobook = entry.entry_type === 'audiobook';
  const isOwn = entry.user_id === currentUser.id;
  const isMod = currentUser.is_moderator;
  const canAddTime = isOwn && (entry.status === 'reading' || entry.status === 'finished');

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!hideMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (hideMenuRef.current && !hideMenuRef.current.contains(e.target as Node)) {
        setHideMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [hideMenuOpen]);

  useEffect(() => {
    if (!statusDropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [statusDropdownOpen]);

  useEffect(() => {
    if (!notePhotoPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (notePhotoPickerRef.current && !notePhotoPickerRef.current.contains(e.target as Node)) {
        setNotePhotoPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notePhotoPickerOpen]);

  async function toggleHide() {
    setHideMenuOpen(false);
    if (isHidden) {
      await supabase.from('hidden_entries').delete().eq('entry_id', entry.id).eq('user_id', currentUser.id);
    } else {
      await supabase.from('hidden_entries').insert({ entry_id: entry.id, user_id: currentUser.id });
    }
    onRefresh();
  }

  async function updateStatus(status: 'want_to_read' | 'reading' | 'finished' | 'did_not_finish') {
    setMenuOpen(false);
    setStatusDropdownOpen(false);
    const update: Record<string, unknown> = { status };
    if (status === 'finished' || status === 'did_not_finish') update.finished_at = new Date().toISOString();
    await supabase.from('reading_entries').update(update).eq('id', entry.id);
    if (status === 'finished') {
      const { data: existing } = await supabase
        .from('time_logs')
        .select('id')
        .eq('entry_id', entry.id)
        .eq('status_override', 'finished')
        .eq('minutes_added', 0)
        .maybeSingle();
      if (!existing) {
        await supabase.from('time_logs').insert({
          entry_id: entry.id,
          book_id: entry.book_id,
          minutes_added: 0,
          status_override: 'finished',
        });
      }
    }
    onRefresh();
  }

  async function handleDelete() {
    await supabase.from('reading_entries').delete().eq('id', entry.id);
    onRefresh();
  }

  async function handleNotePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNoteMediaUploading(true);
    const ext = file.name.split('.').pop();
    const path = `time-logs/${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      setNoteMediaUrl(data.publicUrl);
    }
    setNoteMediaUploading(false);
    if (noteFileRef.current) noteFileRef.current.value = '';
  }

  async function handleLogTime() {
    const mins = parseInt(addMinutes || '0', 10);
    if (!mins || mins <= 0) return;
    if (mins > 600) return;
    if (countWords(addNote) > 150) return;
    setSavingTime(true);
    await supabase.from('time_logs').insert({
      entry_id: entry.id,
      book_id: entry.book_id,
      minutes_added: mins,
      note: addNote.trim() || null,
      media_url: noteMediaUrl,
    });
    setAddingTime(false);
    setAddMinutes('');
    setAddNote('');
    setNoteMediaUrl(null);
    setSavingTime(false);
    onRefresh();
  }

  useEffect(() => {
    supabase
      .from('entry_likes')
      .select('user_id')
      .eq('entry_id', entry.id)
      .then(({ data }) => {
        const rows = data ?? [];
        const ids = rows.map((r) => r.user_id);
        setLikerUserIds(ids);
        setLikeCount(ids.length);
        setIsLiked(ids.includes(currentUser.id));
      });
  }, [entry.id]);

  async function toggleEntryLike() {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount((n) => Math.max(n - 1, 0));
      setLikerUserIds((prev) => prev.filter((id) => id !== currentUser.id));
      await supabase.from('entry_likes').delete().eq('entry_id', entry.id).eq('user_id', currentUser.id);
    } else {
      setIsLiked(true);
      setLikeCount((n) => n + 1);
      setLikerUserIds((prev) => [...prev, currentUser.id]);
      await supabase.from('entry_likes').insert({ entry_id: entry.id });
      if (entry.user_id !== currentUser.id) {
        await supabase.from('notifications').insert({
          recipient_id: entry.user_id,
          sender_user_id: currentUser.id,
          entry_id: entry.id,
          type: 'like',
        });
      }
    }
  }

  if (!book) return null;

  const phrase = entryStatusPhrase(entry.status, entry.entry_type);

  if (isHidden) {
    return (
      <>
        <div className="bg-white border-2 border-brand-blue flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 opacity-50">
            <EyeOff className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400 truncate">
              <span className="font-medium text-gray-500">{profile?.username ?? 'Unknown'}</span>
              {' — '}
              {book.title}
            </span>
          </div>
          <div className="relative shrink-0 ml-2" ref={hideMenuRef}>
            <button
              onClick={() => setHideMenuOpen((o) => !o)}
              className="text-gray-300 hover:text-gray-600 transition-colors p-0.5"
              aria-label="Entry options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {hideMenuOpen && (
              <div className="absolute right-0 top-6 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[160px]">
                <button
                  onClick={toggleHide}
                  className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Unhide Entry
                </button>
              </div>
            )}
          </div>
        </div>
        {confirmDelete && (
          <ConfirmDialog
            message="Delete this entry? This cannot be undone."
            onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
    <article ref={entryRef} id={`entry-${entry.id}`} className="bg-white border-2 border-brand-blue">
      {/* Author header */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-gray-100">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-7 h-7 border-2 border-brand-blue object-cover shrink-0"
          />
        ) : (
          <AvatarIcon avatarColor={profile?.avatar_color ?? '#888'} userId={profile?.id ?? ''} size="md" className="border-2 border-brand-blue" />
        )}
        <p className="text-sm text-gray-700 min-w-0 flex-1">
          <button
            onClick={() => { if (profile?.id) { onSelectUser(profile.id); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
            className="font-semibold text-gray-900 hover:underline cursor-pointer"
          >{profile?.username ?? 'Unknown'}</button>
          {' '}
          <span className="text-gray-500">{phrase}</span>
        </p>
        <span className="text-xs text-gray-400 shrink-0">{timeAgo(entry.created_at)}</span>
      </div>

      {/* Main content */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Cover / icon */}
          <div className="shrink-0 relative">
            {book.cover_url && !isAudiobook ? (
              <button
                type="button"
                onClick={() => setSynopsisOpen(true)}
                className="block cursor-pointer focus:outline-none"
                title="View synopsis"
              >
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-12 h-[68px] object-cover border-2 border-brand-blue hover:opacity-80 transition-opacity"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.parentElement!.style.display = 'none';
                  }}
                />
              </button>
            ) : isAudiobook && book.source_url ? (
              <FaviconCover url={book.source_url} entryId={entry.id} />
            ) : !isAudiobook ? (
              <button
                type="button"
                onClick={() => setSynopsisOpen(true)}
                className="block cursor-pointer focus:outline-none"
                title="View synopsis"
              >
                <div
                  className="w-12 h-[68px] border-2 border-brand-blue flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ background: coverPairing(entry.id).bg }}
                >
                  <BookOpen className="w-5 h-5" style={{ color: coverPairing(entry.id).icon }} />
                </div>
              </button>
            ) : (
              <div
                className="w-12 h-[68px] border-2 border-brand-blue flex items-center justify-center"
                style={{ background: coverPairing(entry.id).bg }}
              >
                <Headphones className="w-5 h-5" style={{ color: coverPairing(entry.id).icon }} />
              </div>
            )}
          </div>

          {/* Book info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                {isAudiobook && book.source_url ? (
                  <a
                    href={book.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-gray-900 text-base leading-snug hover:underline block"
                  >
                    {book.title}
                  </a>
                ) : (
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{book.title}</h3>
                )}
                <p className="text-sm text-gray-500">{book.author}</p>
              </div>

              {/* Ellipsis menu — own entries or moderator */}
              {(isOwn || isMod) && (
                <div className="relative shrink-0 mt-0.5" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="text-gray-400 hover:text-gray-900 transition-colors p-0.5"
                    aria-label="Entry options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-6 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[200px]">
                      {isOwn && (
                        <>
                          <button
                            onClick={() => { setMenuOpen(false); onEdit?.(entry); }}
                            className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue border-b-2 border-brand-blue hover:bg-blue-50 transition-colors"
                          >
                            Edit Entry
                          </button>
                        </>
                      )}
                      <button
                        onClick={toggleHide}
                        className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600 border-b-2 border-brand-blue hover:bg-gray-50 transition-colors"
                      >
                        {isHidden ? 'Unhide Entry' : 'Hide Entry'}
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                        className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-red border-b-2 border-brand-blue hover:bg-red-50 transition-colors"
                      >
                        Delete Entry
                      </button>
                      {!isAudiobook && (
                        <a
                          href={book.bookshop_url ?? `https://bookshop.org/beta-search?keywords=${encodeURIComponent(book.title + ' ' + book.author)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue hover:bg-blue-50 transition-colors"
                        >
                          Buy on Bookshop.org
                        </a>
                      )}
                      {isAudiobook && (
                        <a
                          href={book.bookshop_url ?? `https://libro.fm/search?q=${encodeURIComponent(book.title + ' ' + book.author)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue hover:bg-blue-50 transition-colors"
                        >
                          Listen on Libro.fm
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Hide menu for other users' entries */}
              {!isOwn && !isMod && (
                <div className="relative shrink-0 mt-0.5" ref={hideMenuRef}>
                  <button
                    onClick={() => setHideMenuOpen((o) => !o)}
                    className="text-gray-400 hover:text-gray-900 transition-colors p-0.5"
                    aria-label="Entry options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {hideMenuOpen && (
                    <div className="absolute right-0 top-6 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[180px]">
                      <button
                        onClick={toggleHide}
                        className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {isHidden ? 'Unhide Entry' : 'Hide Entry'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {isOwn ? (
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    onClick={() => setStatusDropdownOpen((o) => !o)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border uppercase tracking-wide transition-colors ${STATUS_STYLES[entry.status]}`}
                  >
                    {statusLabel(entry.status, entry.entry_type)}
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute left-0 top-full mt-0.5 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[160px]">
                      {(
                        ['want_to_read', 'reading', 'finished', 'did_not_finish'] as Status[]
                      )
                        .filter((s) => s !== entry.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(s)}
                            className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors"
                          >
                            {statusLabel(s, entry.entry_type)}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border uppercase tracking-wide ${STATUS_STYLES[entry.status]}`}>
                  {statusLabel(entry.status, entry.entry_type)}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border border-brand-blue bg-white text-gray-900">
                {isAudiobook ? 'Audiobook' : 'Book'}
              </span>
              {!isOwn && !isAudiobook && onLogBook && (
                <button
                  onClick={() => onLogBook({
                    title: book.title,
                    author: book.author,
                    isbn: book.isbn,
                    coverUrl: book.cover_url,
                    bookshopUrl: book.bookshop_url ?? `https://bookshop.org/beta-search?keywords=${encodeURIComponent(book.title + ' ' + book.author)}`,
                    description: book.description,
                  })}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border border-brand-red text-brand-red bg-white hover:bg-red-50 transition-colors"
                >
                  <Plus className="w-3 h-3" strokeWidth={3} />
                  Log
                </button>
              )}
              {entry.time_read_minutes > 0 && (
                <span className="text-[11px] text-gray-400">
                  {formatTimeRead(entry.time_read_minutes)} {isAudiobook ? 'listened' : 'read'}
                </span>
              )}
              {canAddTime && !addingTime && (
                <button
                  onClick={() => setAddingTime(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold border border-brand-red text-brand-red hover:bg-red-50 transition-colors"
                >
                  <PlusCircle className="w-3 h-3" />
                  Add Time
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline add-time form */}
        {addingTime && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            {noteMediaUrl && (
              <div className="relative inline-block mb-2">
                <img src={noteMediaUrl} alt="" className="h-16 rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => setNoteMediaUrl(null)}
                  className="absolute -top-1 -right-1 bg-gray-900 text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={addMinutes}
                  onChange={(e) => setAddMinutes(String(Math.min(parseInt(e.target.value || '0', 10), 600)))}
                  placeholder="0"
                  className="w-20 px-2 py-1.5 pr-8 border-2 border-brand-blue text-sm focus:outline-none focus:border-brand-blue text-center"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">min</span>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="relative flex items-center border-2 border-brand-blue bg-white">
                  <input
                    type="text"
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    placeholder="Optional note…"
                    className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-transparent"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLogTime(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setNotePhotoPickerOpen((o) => !o)}
                    disabled={noteMediaUploading}
                    className="px-2 py-1.5 text-gray-400 hover:text-brand-blue transition-colors shrink-0"
                    title="Attach photo"
                  >
                    {noteMediaUploading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Camera className={`w-4 h-4 ${noteMediaUrl ? 'text-brand-blue' : ''}`} />}
                  </button>
                </div>
                {notePhotoPickerOpen && (
                  <div
                    ref={notePhotoPickerRef}
                    className="absolute right-0 top-full mt-1 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] w-64"
                  >
                    <button
                      type="button"
                      onClick={() => { setNotePhotoPickerOpen(false); noteFileRef.current?.click(); }}
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
                          value={noteUrlInput}
                          onChange={(e) => setNoteUrlInput(e.target.value)}
                          placeholder="Paste image URL…"
                          className="flex-1 text-xs border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-brand-blue"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && noteUrlInput.trim()) {
                              setNoteMediaUrl(noteUrlInput.trim());
                              setNoteUrlInput('');
                              setNotePhotoPickerOpen(false);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (noteUrlInput.trim()) {
                              setNoteMediaUrl(noteUrlInput.trim());
                              setNoteUrlInput('');
                              setNotePhotoPickerOpen(false);
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
                {countWords(addNote) >= 140 && (
                  <p className={`text-[11px] mt-0.5 text-right font-medium ${countWords(addNote) > 150 ? 'text-brand-red' : 'text-amber-500'}`}>
                    {countWords(addNote)} / 150 words
                  </p>
                )}
              </div>
              <button
                onClick={handleLogTime}
                disabled={savingTime || !addMinutes || parseInt(addMinutes) <= 0 || parseInt(addMinutes) > 600 || countWords(addNote) > 150}
                className="px-3 py-1.5 bg-brand-red border-2 border-brand-blue text-white text-sm font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {savingTime ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log'}
              </button>
              <button
                onClick={() => { setAddingTime(false); setAddMinutes(''); setAddNote(''); setNoteMediaUrl(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={noteFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleNotePhotoUpload}
            />
          </div>
        )}

        {/* Note */}
        {entry.note && (
          <p className="mt-3 text-sm text-gray-700 leading-relaxed">{entry.note}</p>
        )}
      </div>

      {/* Attached image (full width) */}
      {entry.media_url && entry.media_type === 'upload' && (
        <div className="border-t-2 border-brand-blue bg-gray-50">
          <img
            src={entry.media_url}
            alt="Attached"
            className="w-full max-h-96 object-contain p-3"
          />
        </div>
      )}

      {/* Footer — like + comment button + also logged */}
      <div className="flex items-center justify-between px-4 py-3 border-t-2 border-brand-blue bg-brand-pink">
        {alsoLoggedBy.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              {alsoLoggedBy.slice(0, 3).map((p) => (
                <AvatarIcon key={p.id} avatarColor={p.avatar_color} userId={p.id} size="xs" className="border border-brand-blue" />
              ))}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-900">
              Also logged by {(() => {
                const names = alsoLoggedBy.map((p) => p.username);
                const max = 3;
                if (names.length <= max) {
                  return names.length === 1
                    ? names[0]
                    : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
                }
                const shown = names.slice(0, max);
                const rest = names.length - max;
                return shown.join(', ') + `, and ${rest} other${rest > 1 ? 's' : ''}`;
              })()}
            </p>
          </div>
        ) : <span />}
        <div className="flex items-center gap-3">
          <LikeButton
            isLiked={isLiked}
            count={likeCount}
            likerUserIds={likerUserIds}
            allProfiles={allProfiles}
            onToggle={toggleEntryLike}
          />
          <button
            onClick={() => setCommentsOpen(!commentsOpen)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}` : 'comment'}
            <span className="text-[10px]">{commentsOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* Comments */}
      {commentsOpen && (
        <CommentSection
          entryId={entry.id}
          entryOwnerId={entry.user_id}
          currentUser={currentUser}
          allProfiles={allProfiles}
          onRefresh={onRefresh}
        />
      )}
    </article>

    {confirmDelete && (
      <ConfirmDialog
        message="Delete this entry? This cannot be undone."
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}

    {synopsisOpen && book && !isAudiobook && (
      <BookSynopsisModal
        bookId={book.id}
        title={book.title}
        author={book.author}
        coverUrl={book.cover_url}
        isbn={book.isbn}
        description={book.description ?? null}
        onClose={() => setSynopsisOpen(false)}
      />
    )}
  </>
  );
}
