import { useEffect, useState } from 'react';
import { X, Loader2, BookOpen } from 'lucide-react';
import { fetchBookDescription } from '../lib/bookSearch';

interface Props {
  bookId: string | null;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  description: string | null;
  onClose: () => void;
  onDescriptionFetched?: (description: string) => void;
}

export default function BookSynopsisModal({ bookId, title, author, coverUrl, isbn, description: initialDescription, onClose, onDescriptionFetched }: Props) {
  const [description, setDescription] = useState<string | null>(initialDescription);
  const [loading, setLoading] = useState(!initialDescription);

  useEffect(() => {
    if (initialDescription) return;
    let cancelled = false;
    setLoading(true);
    fetchBookDescription(bookId, title, author, isbn).then((d) => {
      if (!cancelled) {
        setDescription(d);
        setLoading(false);
        if (d) onDescriptionFetched?.(d);
      }
    });
    return () => { cancelled = true; };
  }, [bookId, title, author, isbn, initialDescription]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)] animate-scale-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-brand-blue bg-brand-yellow">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-blue">Synopsis</p>
          <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity" aria-label="Close">
            <X className="w-4 h-4" strokeWidth={3} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {/* Book header */}
          <div className="flex gap-4 mb-5">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={title}
                className="w-16 h-[92px] object-cover border-2 border-brand-blue shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-16 h-[92px] border-2 border-brand-blue bg-gray-100 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <h2 className="font-bold text-gray-900 text-base leading-snug">{title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{author}</p>
            </div>
          </div>

          {/* Synopsis body */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : description ? (
            <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No synopsis available for this book.</p>
          )}
        </div>
      </div>
    </div>
  );
}
