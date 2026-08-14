import { useRef, useState } from 'react';
import type { Profile } from '../lib/types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  allProfiles: Profile[];
  currentUserId: string;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function MentionTextarea({
  value,
  onChange,
  allProfiles,
  currentUserId,
  placeholder,
  className,
  wrapperClassName,
  rows = 2,
  onKeyDown,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);
    const cursor = e.target.selectionStart ?? v.length;
    const before = v.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setSuggestions(
        allProfiles
          .filter(
            (p) =>
              p.id !== currentUserId &&
              (p.username.toLowerCase().includes(q) ||
                p.display_name.toLowerCase().includes(q))
          )
          .slice(0, 5)
      );
    } else {
      setSuggestions([]);
    }
  }

  function selectMention(profile: Profile) {
    const el = ref.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor).replace(/@(\w*)$/, `@${profile.username} `);
    const after = value.slice(cursor);
    onChange(before + after);
    setSuggestions([]);
    requestAnimationFrame(() => {
      if (el) {
        const pos = before.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className={className}
        onKeyDown={(e) => {
          if (suggestions.length > 0 && e.key === 'Escape') {
            setSuggestions([]);
            e.preventDefault();
          }
          onKeyDown?.(e);
        }}
      />
      {suggestions.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[180px]">
          {suggestions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectMention(p)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors"
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: p.avatar_color }} />
              )}
              <span className="font-medium text-gray-900 truncate">{p.username}</span>
              {p.display_name && p.display_name !== p.username && (
                <span className="text-xs text-gray-400 truncate">{p.display_name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
