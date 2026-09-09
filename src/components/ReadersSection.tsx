import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, UserPlus, UserCheck } from 'lucide-react';
import type { Profile } from '../lib/types';
import AvatarIcon from './AvatarIcon';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  profiles: Profile[];
  selectedUserId: string | null;
  currentUserId: string;
  onSelect: (userId: string | null) => void;
  followingIds: Set<string>;
  onToggleFollow: (targetUserId: string) => void;
}

export default function ReadersSection({ profiles, selectedUserId, currentUserId, onSelect, followingIds, onToggleFollow }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [confirmUnfollowId, setConfirmUnfollowId] = useState<string | null>(null);

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
              const isFollowing = followingIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`group relative flex items-center gap-2 shrink-0 border-2 border-brand-blue px-2.5 py-1.5 transition-all ${
                    isSelected ? 'bg-gray-900' : 'bg-white hover:bg-brand-yellow'
                  }`}
                >
                  <button
                    onClick={() => onSelect(isSelected ? null : p.id)}
                    className="flex items-center gap-2"
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
                    <span className="text-xs font-medium whitespace-nowrap" style={{ color: isSelected ? 'white' : undefined }}>
                      {p.username}
                    </span>
                  </button>
                  {!isSelf && (
                    <button
                      onClick={(e) => { e.stopPropagation(); isFollowing ? setConfirmUnfollowId(p.id) : onToggleFollow(p.id); }}
                      className={`flex items-center justify-center w-5 h-5 border transition-all opacity-0 group-hover:opacity-100 shrink-0 ${
                        isFollowing
                          ? 'bg-green-100 text-green-700 border-green-500 hover:bg-green-200'
                          : 'bg-brand-blue text-white border-brand-blue hover:bg-blue-800'
                      }`}
                      title={isFollowing ? 'Unfollow' : 'Follow'}
                    >
                      {isFollowing
                        ? <UserCheck className="w-3 h-3" />
                        : <UserPlus className="w-3 h-3" />
                      }
                    </button>
                  )}
                </div>
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

      {confirmUnfollowId && (
        <ConfirmDialog
          message="Are you sure you want to unfollow?"
          confirmLabel="Unfollow"
          onConfirm={() => { onToggleFollow(confirmUnfollowId); setConfirmUnfollowId(null); }}
          onCancel={() => setConfirmUnfollowId(null)}
        />
      )}
    </section>
  );
}
