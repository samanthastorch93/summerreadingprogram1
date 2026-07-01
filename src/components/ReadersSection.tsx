import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Profile } from '../lib/types';
import AvatarIcon from './AvatarIcon';

interface Props {
  profiles: Profile[];
  selectedUserId: string | null;
  currentUserId: string;
  onSelect: (userId: string | null) => void;
}

export default function ReadersSection({ profiles, selectedUserId, currentUserId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [profiles]);

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  }

  if (profiles.length === 0) return null;

  return (
    <section className="border-2 border-t-0 border-brand-blue bg-brand-pink">
      <div className="py-2 px-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Readers
        </p>
        <div className="relative flex items-center">
          {canScrollLeft && (
            <button
              onClick={() => scrollBy(-1)}
              className="absolute left-0 z-10 w-6 h-full flex items-center justify-center bg-gradient-to-r from-brand-pink via-brand-pink to-transparent pr-1 shrink-0"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
            </button>
          )}
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 w-full"
            style={{ scrollbarWidth: 'none' }}
          >
            {profiles.map((p) => {
              const isSelected = selectedUserId === p.id;
              const isSelf = p.id === currentUserId;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(isSelected ? null : p.id)}
                  className={`flex items-center gap-2 shrink-0 border-2 border-brand-blue px-2.5 py-1.5 transition-all ${
                    isSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-white hover:bg-brand-yellow'
                  }`}
                >
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="w-6 h-6 object-cover shrink-0 border border-brand-blue"
                    />
                  ) : (
                    <AvatarIcon avatarColor={p.avatar_color} userId={p.id} size="sm" className="border border-brand-blue" />
                  )}
                  <span className="text-xs font-medium whitespace-nowrap">
                    {p.username}
                  </span>
                </button>
              );
            })}
          </div>
          {canScrollRight && (
            <button
              onClick={() => scrollBy(1)}
              className="absolute right-0 z-10 w-6 h-full flex items-center justify-center bg-gradient-to-l from-brand-pink via-brand-pink to-transparent pl-1 shrink-0"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
