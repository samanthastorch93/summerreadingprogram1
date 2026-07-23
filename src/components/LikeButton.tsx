import { useState, useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';
import type { Profile } from '../lib/types';
import AvatarIcon from './AvatarIcon';

interface Props {
  isLiked: boolean;
  count: number;
  likerUserIds: string[];
  allProfiles: Profile[];
  onToggle: () => void;
  size?: 'sm' | 'md';
}

const VARIANTS = {
  sm: { icon: 'w-3 h-3', text: 'text-[11px]', gap: 'gap-1', unliked: 'text-gray-400', margin: 'mt-1' },
  md: { icon: 'w-3.5 h-3.5', text: 'text-xs', gap: 'gap-1.5', unliked: 'text-gray-500', margin: '' },
};

export default function LikeButton({ isLiked, count, likerUserIds, allProfiles, onToggle, size = 'md' }: Props) {
  const [showPopover, setShowPopover] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFiredRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const v = VARIANTS[size];

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCanHover(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!showPopover) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPopover(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showPopover]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function openPopover() {
    if (count === 0) return;
    cancelClose();
    setShowPopover(true);
  }

  function scheduleClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setShowPopover(false), 120);
  }

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function startHold(e: React.PointerEvent) {
    if (count === 0) return;
    holdFiredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = setTimeout(() => {
      holdFiredRef.current = true;
      setShowPopover(true);
    }, 450);
  }

  function cancelHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startPosRef.current) return;
    if (Math.abs(e.clientX - startPosRef.current.x) > 10 || Math.abs(e.clientY - startPosRef.current.y) > 10) {
      cancelHold();
      startPosRef.current = null;
    }
  }

  function handleClick() {
    if (holdFiredRef.current) {
      holdFiredRef.current = false;
      return;
    }
    onToggle();
  }

  return (
    <div
      ref={groupRef}
      className="relative"
      onMouseEnter={() => { if (canHover && count > 0) openPopover(); }}
      onMouseLeave={() => { if (canHover) scheduleClose(); }}
    >
      <button
        onClick={handleClick}
        onPointerDown={(e) => { if (e.pointerType === 'touch') startHold(e); }}
        onPointerUp={() => { cancelHold(); startPosRef.current = null; }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => cancelHold()}
        onPointerCancel={() => { cancelHold(); startPosRef.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'pan-y' }}
        className={`flex items-center ${v.gap} ${v.text} ${v.margin} font-medium transition-colors select-none ${
          isLiked ? 'text-red-500' : `${v.unliked} hover:text-red-400`
        }`}
      >
        <Heart className={`${v.icon} ${isLiked ? 'fill-current' : ''}`} />
        {count > 0 && <span>{count}</span>}
      </button>

      {showPopover && count > 0 && (
        <div
          className="absolute bottom-full mb-1 right-0 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[180px] max-h-44 overflow-y-auto"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 sticky top-0 bg-white">
            Liked by
          </p>
          {likerUserIds.map((id) => {
            const p = allProfiles.find((prof) => prof.id === id);
            return (
              <div key={id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                {p?.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <AvatarIcon avatarColor={p?.avatar_color ?? '#aaa'} userId={id} size="xs" className="rounded-full" />
                )}
                <span className="text-xs text-gray-900 truncate">@{p?.username ?? 'Unknown reader'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
