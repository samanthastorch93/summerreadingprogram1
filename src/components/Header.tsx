import { Plus, Bell, Sun, Smile } from 'lucide-react';
import type { Profile, BookSearchResult } from '../lib/types';
import HeaderSearch from './HeaderSearch';
import AvatarIcon from './AvatarIcon';

interface Props {
  profile: Profile;
  allProfiles: Profile[];
  unreadCount: number;
  onLogEntry: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onSelectUser: (userId: string) => void;
  onSelectBook: (book: BookSearchResult) => void;
  onHome: () => void;
}

export default function Header({
  profile,
  allProfiles,
  unreadCount,
  onLogEntry,
  onOpenNotifications,
  onOpenProfile,
  onSelectUser,
  onSelectBook,
  onHome,
}: Props) {
  return (
    <header className="sticky top-0 z-40 bg-brand-yellow border-b-2 border-brand-blue">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        {/* Logo */}
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 shrink-0 hover:opacity-70 transition-opacity"
        >
          <Sun className="w-6 h-6 text-brand-blue shrink-0" strokeWidth={2.5} />
          <span className="font-bold text-sm uppercase tracking-tighter text-brand-blue hidden sm:block">
            Summer Reading Program!
          </span>
          <Smile className="w-5 h-5 text-brand-blue shrink-0" strokeWidth={2.5} />
        </button>

        {/* Search */}
        <HeaderSearch
          allProfiles={allProfiles}
          onSelectUser={onSelectUser}
          onSelectBook={onSelectBook}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onLogEntry}
            className="flex items-center gap-1 bg-brand-red hover:bg-red-700 text-white font-bold text-sm px-3 py-1.5 border-2 border-brand-blue transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
            <span>LOG</span>
          </button>

          <button
            onClick={onOpenNotifications}
            className="relative p-2 bg-white border-2 border-brand-blue hover:bg-gray-50 transition-colors"
          >
            <Bell className="w-4 h-4 text-gray-900" strokeWidth={2.5} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-brand-red border-2 border-brand-blue text-white text-[9px] font-semibold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User avatar */}
          <button
            onClick={onOpenProfile}
            className="hover:opacity-80 transition-opacity"
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-9 h-9 border-2 border-brand-blue object-cover shrink-0"
              />
            ) : (
              <AvatarIcon avatarColor={profile.avatar_color} userId={profile.id} size="lg" className="border-2 border-brand-blue" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
