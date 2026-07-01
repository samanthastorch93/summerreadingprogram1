import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatTimeRead } from '../lib/types';
import type { Status } from '../lib/types';

interface Stats {
  totalMinutes: number;
  wantToReadCount: number;
  inProgressCount: number;
  finishedCount: number;
}

interface Props {
  userId: string;
  selectedUserId: string | null;
  selectedUserName: string | null;
  statusFilter: Status | null;
  onStatusFilter: (status: Status | null) => void;
  onSelectSelf: () => void;
  onClearSelectedUser: () => void;
}

type StatsMode = 'mine' | 'everyone' | 'selected';

export default function StatsSection({ userId, selectedUserId, selectedUserName, statusFilter, onStatusFilter, onSelectSelf, onClearSelectedUser }: Props) {
  const [mode, setMode] = useState<StatsMode>('everyone');
  const [myStats, setMyStats] = useState<Stats>({ totalMinutes: 0, wantToReadCount: 0, inProgressCount: 0, finishedCount: 0 });
  const [everyoneStats, setEveryoneStats] = useState<Stats>({ totalMinutes: 0, wantToReadCount: 0, inProgressCount: 0, finishedCount: 0 });
  const [selectedStats, setSelectedStats] = useState<Stats>({ totalMinutes: 0, wantToReadCount: 0, inProgressCount: 0, finishedCount: 0 });

  useEffect(() => {
    loadMyAndEveryoneStats();
  }, [userId]);

  useEffect(() => {
    if (selectedUserId && selectedUserId !== userId) {
      setMode('selected');
      loadSelectedStats(selectedUserId);
    } else if (!selectedUserId) {
      setMode('everyone');
    }
  }, [selectedUserId, userId]);

  async function loadMyAndEveryoneStats() {
    const [{ data: mine }, { data: all }, { data: myLogs }, { data: allLogs }] = await Promise.all([
      supabase.from('reading_entries').select('status, time_read_minutes').eq('user_id', userId),
      supabase.from('reading_entries').select('status, time_read_minutes'),
      supabase.from('time_logs').select('minutes_added').eq('user_id', userId).gt('minutes_added', 0),
      supabase.from('time_logs').select('minutes_added').gt('minutes_added', 0),
    ]);
    const myLogMinutes = (myLogs ?? []).reduce((s, r) => s + (r.minutes_added || 0), 0);
    const allLogMinutes = (allLogs ?? []).reduce((s, r) => s + (r.minutes_added || 0), 0);
    setMyStats(calcStats(mine ?? [], myLogMinutes));
    setEveryoneStats(calcStats(all ?? [], allLogMinutes));
  }

  async function loadSelectedStats(uid: string) {
    const [{ data }, { data: logs }] = await Promise.all([
      supabase.from('reading_entries').select('status, time_read_minutes').eq('user_id', uid),
      supabase.from('time_logs').select('minutes_added').eq('user_id', uid).gt('minutes_added', 0),
    ]);
    const logMinutes = (logs ?? []).reduce((s, r) => s + (r.minutes_added || 0), 0);
    setSelectedStats(calcStats(data ?? [], logMinutes));
  }

  function calcStats(rows: { status: string; time_read_minutes: number }[], extraMinutes = 0): Stats {
    return {
      totalMinutes: rows.reduce((s, r) => s + (r.time_read_minutes || 0), 0) + extraMinutes,
      wantToReadCount: rows.filter((r) => r.status === 'want_to_read').length,
      inProgressCount: rows.filter((r) => r.status === 'reading').length,
      finishedCount: rows.filter((r) => r.status === 'finished').length,
    };
  }

  const stats = mode === 'mine' ? myStats : mode === 'everyone' ? everyoneStats : selectedStats;

  const firstName = selectedUserName?.split(' ')[0] ?? '';

  const cards: { value: string; label: string; sub: string; filter: Status | null }[] = [
    { value: stats.totalMinutes > 0 ? formatTimeRead(stats.totalMinutes) : '—', label: 'TIME READ', sub: 'total logged', filter: null },
    { value: String(stats.wantToReadCount), label: 'WANT TO READ', sub: 'on list', filter: 'want_to_read' },
    { value: String(stats.inProgressCount), label: 'IN PROGRESS', sub: 'titles', filter: 'reading' },
    { value: String(stats.finishedCount), label: 'FINISHED', sub: 'titles', filter: 'finished' },
  ];

  return (
    <section className="border-b-2 border-brand-blue bg-brand-sky">
      <div className="pt-5 pb-5">
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          <button
            onClick={() => { setMode('mine'); onSelectSelf(); }}
            className={`text-xs font-bold uppercase tracking-widest px-2 py-1 border-2 border-brand-blue transition-colors ${
              mode === 'mine' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            My Stats
          </button>
          <button
            onClick={() => { setMode('everyone'); onClearSelectedUser(); }}
            className={`text-xs font-bold uppercase tracking-widest px-2 py-1 border-2 border-brand-blue transition-colors ${
              mode === 'everyone' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            Everyone&rsquo;s Stats
          </button>
          {selectedUserId && selectedUserId !== userId && firstName && (
            <button
              onClick={() => setMode('selected')}
              className={`text-xs font-bold uppercase tracking-widest px-2 py-1 border-2 border-brand-blue transition-colors ${
                mode === 'selected' ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'
              }`}
            >
              {firstName}&rsquo;s Stats
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-0 border-2 border-brand-blue">
          {cards.map(({ value, label, sub, filter }, i) => {
            const isActive = statusFilter === filter && filter !== null;
            return (
              <button
                key={label}
                type="button"
                onClick={() => filter !== null && onStatusFilter(isActive ? null : filter)}
                className={`px-3 py-2.5 text-left transition-colors ${
                  i < cards.length - 1 ? 'border-r-2 border-brand-blue' : ''
                } ${
                  isActive
                    ? 'bg-brand-blue'
                    : filter !== null
                    ? 'bg-white hover:bg-brand-yellow cursor-pointer'
                    : 'bg-white cursor-default'
                }`}
              >
                <p className={`font-bold text-2xl leading-none ${isActive ? 'text-white' : 'text-brand-blue'}`}>{value}</p>
                <p className={`font-semibold text-[10px] uppercase tracking-widest mt-2 ${isActive ? 'text-white' : 'text-gray-900'}`}>{label}</p>
                <p className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{sub}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
