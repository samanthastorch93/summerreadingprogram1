import { useEffect, useState, useCallback } from 'react';
import { X, Loader2, BookOpen, Users, Clock, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchBookDescription } from '../lib/bookSearch';
import { timeAgo, formatTimeRead, STATUS_LABELS, entryStatusPhrase } from '../lib/types';
import type { Profile, Status } from '../lib/types';
import type { BookSearchResult } from '../lib/types';
import AvatarIcon from './AvatarIcon';

interface ActivityItem {
  id: string;
  user_id: string;
  type: 'entry' | 'time_log';
  status: Status | null;
  note: string | null;
  minutes: number | null;
  created_at: string;
}

interface Props {
  book: BookSearchResult;
  allProfiles: Profile[];
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  onLogBook: (book: BookSearchResult) => void;
}

export default function BookDetailModal({ book, allProfiles, onClose, onSelectUser, onLogBook }: Props) {
  const [description, setDescription] = useState<string | null>(book.description);
  const [loadingDesc, setLoadingDesc] = useState(!book.description);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadDescription = useCallback(async () => {
    if (book.description) return;
    setLoadingDesc(true);
    const d = await fetchBookDescription(bookId, book.title, book.author, book.isbn);
    setDescription(d);
    setLoadingDesc(false);
  }, [book.description, bookId, book.title, book.author, book.isbn]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      setLoadingActivity(true);

      // Find book(s) in DB matching title + author
      const { data: books } = await supabase
        .from('books')
        .select('id, title, author')
        .ilike('title', `%${book.title}%`)
        .limit(10);

      const matchingBooks = (books ?? []).filter(
        (b) => b.author?.toLowerCase().trim() === book.author.toLowerCase().trim()
      );

      if (matchingBooks.length === 0) {
        if (!cancelled) { setActivity([]); setLoadingActivity(false); }
        return;
      }

      const bookIds = matchingBooks.map((b) => b.id);
      if (matchingBooks.length === 1) setBookId(matchingBooks[0].id);

      const [entriesRes, timeLogsRes] = await Promise.all([
        supabase
          .from('reading_entries')
          .select('id, user_id, status, note, created_at')
          .in('book_id', bookIds)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('time_logs')
          .select('id, user_id, minutes_added, note, created_at')
          .in('book_id', bookIds)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (cancelled) return;

      const entryItems: ActivityItem[] = (entriesRes.data ?? []).map((e) => ({
        id: e.id,
        user_id: e.user_id,
        type: 'entry' as const,
        status: e.status as Status,
        note: e.note,
        minutes: null,
        created_at: e.created_at,
      }));

      const timeLogItems: ActivityItem[] = (timeLogsRes.data ?? []).map((t) => ({
        id: t.id,
        user_id: t.user_id,
        type: 'time_log' as const,
        status: null,
        note: t.note,
        minutes: t.minutes_added,
        created_at: t.created_at,
      }));

      const merged = [...entryItems, ...timeLogItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivity(merged);
      setLoadingActivity(false);
    }

    loadActivity();
    loadDescription();
    return () => { cancelled = true; };
  }, [book.title, book.author, loadDescription]);

  const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)] animate-scale-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-brand-blue bg-brand-yellow shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-blue">Book Details</p>
          <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity" aria-label="Close">
            <X className="w-4 h-4" strokeWidth={3} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Book header */}
          <div className="flex gap-4 p-5">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-20 h-[114px] object-cover border-2 border-brand-blue shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-20 h-[114px] border-2 border-brand-blue bg-gray-100 flex items-center justify-center shrink-0">
                <BookOpen className="w-7 h-7 text-gray-400" />
              </div>
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <h2 className="font-bold text-gray-900 text-lg leading-snug">{book.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{book.author}</p>
              <div className="flex items-center gap-3 mt-2">
                <a
                  href={book.bookshopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-blue hover:underline w-fit"
                >
                  Find on Bookshop.org
                </a>
                <button
                  onClick={() => onLogBook(book)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-red text-white font-bold text-[11px] uppercase tracking-wide border-2 border-brand-blue hover:bg-red-700 transition-colors"
                >
                  <Plus className="w-3 h-3" strokeWidth={3} />
                  Log this book
                </button>
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">Synopsis</span>
            </div>
            {loadingDesc ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : description ? (
              <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No synopsis available for this book.</p>
            )}
          </div>

          {/* Community Activity */}
          <div className="px-5 pb-5 border-t-2 border-brand-blue bg-brand-pink/30">
            <div className="flex items-center gap-1.5 pt-4 mb-3">
              <Users className="w-3.5 h-3.5 text-brand-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">Community Activity</span>
            </div>

            {loadingActivity ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No one has logged this book yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((item) => {
                  const profile = profileMap.get(item.user_id);
                  return (
                    <div key={item.id} className="bg-white border border-brand-blue p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full border border-brand-blue object-cover shrink-0"
                          />
                        ) : (
                          <AvatarIcon
                            avatarColor={profile?.avatar_color ?? '#888'}
                            userId={profile?.id ?? ''}
                            size="sm"
                            className="rounded-full border border-brand-blue"
                          />
                        )}
                        <button
                          onClick={() => { onSelectUser(item.user_id); onClose(); }}
                          className="text-xs font-semibold text-gray-900 hover:underline"
                        >
                          @{profile?.username ?? 'unknown'}
                        </button>
                        <span className="text-xs text-gray-400 ml-auto shrink-0">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.type === 'entry' && item.status ? (
                          <>
                            <span className="text-xs text-gray-600">{entryStatusPhrase(item.status)}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold border border-brand-blue bg-brand-yellow text-gray-900 uppercase tracking-wide">
                              {STATUS_LABELS[item.status]}
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-600">
                              logged {formatTimeRead(item.minutes ?? 0)} of reading
                            </span>
                          </>
                        )}
                      </div>
                      {item.note && (
                        <p className="text-xs text-gray-700 mt-2 leading-relaxed">{item.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
