import { useState, useEffect, useCallback } from 'react';
import { Sun } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import type { Profile, ReadingEntry, BookSearchResult } from './lib/types';
import AuthModal from './components/AuthModal';
import Header from './components/Header';
import StatsSection from './components/StatsSection';
import ReadersSection from './components/ReadersSection';
import Feed from './components/Feed';
import LogEntryModal from './components/LogEntryModal';
import NotificationPanel from './components/NotificationPanel';
import ProfileModal from './components/ProfileModal';
import PrivacyPolicy from './components/PrivacyPolicy';
import BookDetailModal from './components/BookDetailModal';

export default function App() {
  const { user, profile, loading, setProfile } = useAuth();
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editEntry, setEditEntry] = useState<ReadingEntry | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<import('./lib/types').Status | null>(null);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user) return;
    loadProfiles();
    loadUnreadCount(user.id);
    const cleanup = subscribeToNotifications(user.id);
    return cleanup;
  }, [user]);

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    setAllProfiles(data ?? []);
  }

  async function loadUnreadCount(userId: string) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);
    setUnreadCount(count ?? 0);
  }

  function subscribeToNotifications(userId: string) {
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        () => setUnreadCount((c) => c + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  function handleNavigateToEntry(entryId: string) {
    setSelectedUserId(null);
    setStatusFilter(null);
    setShowNotifications(false);
    setFocusedEntryId(entryId);
    setTimeout(() => setFocusedEntryId(null), 1500);
  }

  if (hash === '#privacy') {
    return <PrivacyPolicy onBack={() => { window.location.hash = ''; }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-yellow flex items-center justify-center">
        <Sun className="w-12 h-12 text-brand-blue animate-spin" strokeWidth={2.5} />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <AuthModal
        onProfileCreated={(p) => {
          setProfile(p);
          loadProfiles();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-brand-sky">
      <Header
        profile={profile}
        allProfiles={allProfiles}
        unreadCount={unreadCount}
        onLogEntry={() => setShowLogModal(true)}
        onOpenNotifications={() => { setShowNotifications(true); setUnreadCount(0); }}
        onOpenProfile={() => setShowProfileModal(true)}
        onSelectUser={(userId) => { setSelectedUserId(userId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onSelectBook={(book) => setSelectedBook(book)}
        onHome={() => { setSelectedUserId(null); setStatusFilter(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      <div className="max-w-3xl mx-auto px-4">
        <StatsSection
          key={refreshKey}
          userId={profile.id}
          selectedUserId={selectedUserId}
          selectedUserName={allProfiles.find((p) => p.id === selectedUserId)?.username ?? null}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          onSelectSelf={() => setSelectedUserId(profile.id)}
          onClearSelectedUser={() => setSelectedUserId(null)}
        />
        <ReadersSection
          profiles={allProfiles}
          selectedUserId={selectedUserId}
          currentUserId={profile.id}
          onSelect={setSelectedUserId}
        />
      </div>

      <Feed
        currentUser={profile}
        allProfiles={allProfiles}
        selectedUserId={selectedUserId}
        refreshKey={refreshKey}
        focusedEntryId={focusedEntryId}
        onRefresh={refresh}
        onEdit={(entry) => setEditEntry(entry)}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        onSelectUser={(userId) => { setSelectedUserId(userId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

      {(showLogModal || editEntry) && (
        <LogEntryModal
          currentUser={profile}
          editEntry={editEntry ?? undefined}
          onClose={() => { setShowLogModal(false); setEditEntry(null); }}
          onSaved={() => { setShowLogModal(false); setEditEntry(null); refresh(); }}
        />
      )}

      {showNotifications && (
        <NotificationPanel
          currentUserId={user.id}
          allProfiles={allProfiles}
          onClose={() => setShowNotifications(false)}
          onNavigateToEntry={handleNavigateToEntry}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          profile={profile}
          onClose={() => setShowProfileModal(false)}
          onSaved={(updated) => { setProfile(updated); loadProfiles(); }}
        />
      )}

      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          allProfiles={allProfiles}
          onClose={() => setSelectedBook(null)}
          onSelectUser={(userId) => { setSelectedUserId(userId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}

      <footer className="max-w-3xl mx-auto px-4 py-6 text-center">
        <a href="#privacy" className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
