import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, BookOpen, Loader2 } from 'lucide-react';
import { searchBooks } from '../lib/bookSearch';
import type { Profile, BookSearchResult } from '../lib/types';
import AvatarIcon from './AvatarIcon';

interface Props {
  allProfiles: Profile[];
  onSelectUser: (userId: string) => void;
  onSelectBook: (book: BookSearchResult) => void;
}

export default function HeaderSearch({ allProfiles, onSelectUser, onSelectBook }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUserResults([]);
      setBookResults([]);
      return;
    }
    setLoading(true);

    const lower = q.toLowerCase();

    const users = allProfiles
      .filter(
        (p) =>
          p.display_name.toLowerCase().includes(lower) ||
          p.username.toLowerCase().includes(lower)
      )
      .slice(0, 4);

    let books: BookSearchResult[] = [];
    try {
      books = await searchBooks(q, '');
      if (books.length > 5) books = books.slice(0, 5);
    } catch { /* silent fail */ }

    setUserResults(users);
    setBookResults(books);
    setLoading(false);
  }, [allProfiles]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const hasResults = userResults.length > 0 || bookResults.length > 0;
  const showDropdown = open && query.trim().length > 0;

  function selectUser(userId: string) {
    onSelectUser(userId);
    setQuery('');
    setOpen(false);
  }

  function selectBook(book: BookSearchResult) {
    onSelectBook(book);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-[160px] sm:max-w-xs">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search readers or books…"
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border-2 border-brand-blue focus:outline-none focus:ring-0 placeholder:text-gray-400 text-gray-900"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setUserResults([]); setBookResults([]); }}
            className="absolute right-2 text-gray-400 hover:text-gray-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border-2 border-brand-blue shadow-lg z-50 max-h-80 overflow-y-auto">
          {loading && !hasResults && (
            <div className="px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Searching…</span>
            </div>
          )}

          {!loading && !hasResults && (
            <div className="px-3 py-2 text-xs text-gray-400">No results for "{query}"</div>
          )}

          {userResults.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Readers</span>
              </div>
              {userResults.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={(e) => { e.preventDefault(); selectUser(p.id); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-sky transition-colors text-left"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <AvatarIcon avatarColor={p.avatar_color} userId={p.id} size="sm" className="rounded-full" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">@{p.username}</p>
                  </div>
                </button>
              ))}
            </>
          )}

          {bookResults.length > 0 && (
            <>
              <div className={`px-3 pt-2 pb-1 flex items-center gap-1.5${userResults.length > 0 ? ' border-t border-gray-100' : ''}`}>
                <BookOpen className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Books</span>
              </div>
              {bookResults.map((book, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); selectBook(book); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-sky transition-colors text-left"
                >
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="w-7 h-9 object-cover shrink-0 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-7 h-9 bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 rounded-sm">
                      <BookOpen className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{book.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{book.author}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
