import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { BookSearchResult } from '../lib/types';
import { searchBooks } from '../lib/bookSearch';

interface Props {
  title: string;
  author: string;
  onTitleChange: (title: string) => void;
  onAuthorChange: (author: string) => void;
  onEnrich: (data: Omit<BookSearchResult, 'bookshopUrl'>) => void;
}

export default function BookSearch({ title, author, onTitleChange, onAuthorChange, onEnrich }: Props) {
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef('');
  const bookSelectedRef = useRef(false);
  const onEnrichRef = useRef(onEnrich);
  onEnrichRef.current = onEnrich;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (bookSelectedRef.current) { bookSelectedRef.current = false; return; }
    const normalize = (s: string) => s.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const titleQ = normalize(title);
    const authorQ = normalize(author);
    const combined = [titleQ, authorQ].filter(Boolean).join(' ');
    if (combined.length < 2) { setResults([]); setOpen(false); return; }
    const cacheKey = `${titleQ}|${authorQ}`;
    if (cacheKey === lastQueryRef.current) return;

    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = cacheKey;
      setLoading(true);
      try {
        const books = await searchBooks(titleQ, authorQ);
        setResults(books);
        setOpen(books.length > 0);
      } catch {
        // silent fail — user can type manually
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [title, author]);

  function handleSelect(book: BookSearchResult) {
    onTitleChange(book.title);
    onAuthorChange(book.author);
    onEnrichRef.current({ title: book.title, author: book.author, isbn: book.isbn, coverUrl: book.coverUrl, description: book.description });
    bookSelectedRef.current = true;
    setOpen(false);
    lastQueryRef.current = '';
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Book Title</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={title}
            onChange={(e) => { bookSelectedRef.current = false; onTitleChange(e.target.value); lastQueryRef.current = ''; setOpen(true); }}
            onFocus={() => !bookSelectedRef.current && results.length > 0 && setOpen(true)}
            placeholder="Type a title…"
            className="w-full pl-9 pr-4 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:ring-0 focus:border-brand-blue bg-white"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border-2 border-brand-blue border-t-0 z-50 max-h-64 overflow-y-auto animate-scale-in">
            {results.map((book, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(book)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-yellow transition-colors text-left border-b border-gray-100 last:border-0"
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    className="w-7 h-10 object-cover border border-brand-blue shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-7 h-10 bg-gray-100 border border-brand-blue shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">{book.author}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{book.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Author</p>
        <input
          type="text"
          value={author}
          onChange={(e) => { onAuthorChange(e.target.value); lastQueryRef.current = ''; }}
          placeholder="Author name…"
          className="w-full px-3 py-2.5 border-2 border-brand-blue text-sm font-medium focus:outline-none focus:ring-0 focus:border-brand-blue bg-white"
        />
      </div>
    </div>
  );
}
