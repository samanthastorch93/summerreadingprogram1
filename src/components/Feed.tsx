import { useState, useEffect } from 'react';
import { Loader2, Frown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatTimeRead } from '../lib/types';
import type { ReadingEntry, TimeLog, Profile, Status } from '../lib/types';
import EntryCard from './EntryCard';
import ActivityCard from './ActivityCard';

type FilterTab = 'all' | Exclude<Status, 'did_not_finish'>;

type FeedItem =
  | { kind: 'entry'; data: ReadingEntry; sortKey: string }
  | { kind: 'timelog'; data: TimeLog; sortKey: string };

interface Props {
  currentUser: Profile;
  allProfiles: Profile[];
  selectedUserId: string | null;
  refreshKey: number;
  focusedEntryId: string | null;
  onRefresh: () => void;
  onEdit: (entry: ReadingEntry) => void;
  statusFilter: Status | null;
  onStatusFilter: (status: Status | null) => void;
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
];

export default function Feed({ currentUser, allProfiles, selectedUserId, refreshKey, focusedEntryId, onRefresh, onEdit, statusFilter, onStatusFilter }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [commentedEntryIds, setCommentedEntryIds] = useState<Set<string>>(new Set());
  const [hiddenEntryIds, setHiddenEntryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const activeTab: FilterTab = (statusFilter === 'did_not_finish' ? null : statusFilter) ?? 'all';

  function setActiveTab(tab: FilterTab) {
    onStatusFilter(tab === 'all' ? null : tab);
  }

  useEffect(() => {
    if (selectedUserId) {
      loadUserActivity(selectedUserId);
    } else {
      loadAllItems();
    }
  }, [selectedUserId, refreshKey]);

  const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

  function enrichEntries(raw: any[]): ReadingEntry[] {
    return raw.map((e) => ({
      ...e,
      book: e.books ?? null,
      profile: profileMap.get(e.user_id),
      comment_ids: e.comments ?? [],
    }));
  }

  function enrichTimeLogs(raw: any[]): TimeLog[] {
    return raw.map((tl) => ({
      ...tl,
      book: tl.books ?? null,
      profile: profileMap.get(tl.user_id),
    }));
  }

  async function loadAllItems() {
    setLoading(true);

    const [{ data: entryData }, { data: timeLogData }, { data: hiddenData }] = await Promise.all([
      supabase
        .from('reading_entries')
        .select('*, books(*), comments(id)')
        .order('created_at', { ascending: false }),
      supabase
        .from('time_logs')
        .select('*, books(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('hidden_entries')
        .select('entry_id')
        .eq('user_id', currentUser.id),
    ]);

    const entryItems: FeedItem[] = enrichEntries(entryData ?? []).map((e) => ({
      kind: 'entry',
      data: e,
      sortKey: e.created_at,
    }));

    const timeLogItems: FeedItem[] = enrichTimeLogs(timeLogData ?? []).map((tl) => ({
      kind: 'timelog',
      data: tl,
      sortKey: tl.created_at,
    }));

    const merged = [...entryItems, ...timeLogItems].sort(
      (a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime()
    );

    setItems(merged);
    setHiddenEntryIds(new Set((hiddenData ?? []).map((r: { entry_id: string }) => r.entry_id)));
    setCommentedEntryIds(new Set());
    setLoading(false);
  }

  async function loadUserActivity(userId: string) {
    setLoading(true);

    const [{ data: userEntries }, { data: userTimeLogs }, { data: hiddenData }] = await Promise.all([
      supabase
        .from('reading_entries')
        .select('*, books(*), comments(id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('time_logs')
        .select('*, books(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('hidden_entries')
        .select('entry_id')
        .eq('user_id', currentUser.id),
    ]);

    const entryItems: FeedItem[] = enrichEntries(userEntries ?? []).map((e) => ({
      kind: 'entry',
      data: e,
      sortKey: e.created_at,
    }));

    const timeLogItems: FeedItem[] = enrichTimeLogs(userTimeLogs ?? []).map((tl) => ({
      kind: 'timelog',
      data: tl,
      sortKey: tl.created_at,
    }));

    const merged = [...entryItems, ...timeLogItems].sort(
      (a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime()
    );

    setItems(merged);
    setHiddenEntryIds(new Set((hiddenData ?? []).map((r: { entry_id: string }) => r.entry_id)));
    setCommentedEntryIds(new Set());
    setLoading(false);
  }

  // Build "also logged by" map from non-DNF entry items only
  const bookUserMap = new Map<string, Set<string>>();
  items.forEach((item) => {
    if (item.kind !== 'entry' || item.data.status === 'did_not_finish') return;
    const e = item.data;
    if (!bookUserMap.has(e.book_id)) bookUserMap.set(e.book_id, new Set());
    bookUserMap.get(e.book_id)!.add(e.user_id);
  });

  function getAlsoLoggedBy(entry: ReadingEntry): Profile[] {
    const others = [...(bookUserMap.get(entry.book_id) ?? [])].filter(
      (uid) => uid !== entry.user_id
    );
    return others.map((uid) => allProfiles.find((p) => p.id === uid)).filter(Boolean) as Profile[];
  }

  const filtered = items.filter((item) => {
    if (activeTab === 'all') return true;
    if (item.kind === 'timelog') {
      return activeTab === 'finished' && item.data.status_override === 'finished' && item.data.minutes_added === 0;
    }
    return item.data.status === activeTab;
  });

  // In the finished tab, sort entries by finished_at (falling back to created_at)
  const finalItems = activeTab === 'finished'
    ? [...filtered].sort((a, b) => {
        const aKey = a.kind === 'entry' && a.data.finished_at ? a.data.finished_at : a.sortKey;
        const bKey = b.kind === 'entry' && b.data.finished_at ? b.data.finished_at : b.sortKey;
        return new Date(bKey).getTime() - new Date(aKey).getTime();
      })
    : filtered;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      {/* Filter tabs */}
      <div className="flex border-2 border-brand-blue mb-5 bg-white">
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                i > 0 ? 'border-l-2 border-brand-blue' : ''
              } ${
                activeTab === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : finalItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200">
          <Frown className="w-10 h-10 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-400 uppercase text-sm">No entries yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {selectedUserId ? 'No activity to show.' : 'Hit LOG to add your first entry!'}
          </p>
        </div>
      ) : (
        <>
          {finalItems.length > 0 && (
            <div className="space-y-4">
              {finalItems.map((item) => {
                if (item.kind === 'timelog') {
                  return (
                    <ActivityCard
                      key={`tl-${item.data.id}`}
                      log={item.data}
                      allProfiles={allProfiles}
                      currentUser={currentUser}
                      onRefresh={onRefresh}
                    />
                  );
                }
                return (
                  <EntryCard
                    key={`entry-${item.data.id}`}
                    entry={item.data}
                    alsoLoggedBy={getAlsoLoggedBy(item.data)}
                    currentUser={currentUser}
                    allProfiles={allProfiles}
                    isCommentedEntry={commentedEntryIds.has(item.data.id)}
                    autoExpandComments={focusedEntryId === item.data.id}
                    isHidden={hiddenEntryIds.has(item.data.id)}
                    onRefresh={onRefresh}
                    onEdit={onEdit}
                  />
                );
              })}
            </div>
          )}

        </>
      )}
    </div>
  );
}

