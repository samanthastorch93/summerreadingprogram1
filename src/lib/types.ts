export type Status = 'want_to_read' | 'reading' | 'finished' | 'did_not_finish';
export type MediaType = 'upload' | null;
export type EntryType = 'book' | 'audiobook';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  is_moderator: boolean;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  open_library_cover_id: string | null;
  cover_url: string | null;
  bookshop_url: string | null;
  source_url: string | null;
  description: string | null;
  narrator: string | null;
  created_at: string;
}

export interface ReadingEntry {
  id: string;
  user_id: string;
  book_id: string;
  status: Status;
  entry_type: EntryType;
  time_read_minutes: number;
  note: string | null;
  media_url: string | null;
  media_type: MediaType;
  finished_at: string | null;
  created_at: string;
  // client-joined
  book?: Book;
  profile?: Profile;
  comment_ids?: { id: string }[];
}

export interface Comment {
  id: string;
  entry_id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  media_type: MediaType;
  parent_comment_id: string | null;
  created_at: string;
  profile?: Profile;
  replies?: Comment[];
}

export interface TimeLog {
  id: string;
  user_id: string;
  entry_id: string;
  book_id: string;
  minutes_added: number;
  note: string | null;
  media_url: string | null;
  status_override: Status | null;
  created_at: string;
  // client-joined
  book?: Book;
  profile?: Profile;
  entry_status?: Status;
  entry_type?: EntryType;
}

export interface Notification {
  id: string;
  recipient_id: string;
  sender_user_id: string | null;
  comment_id: string | null;
  entry_id: string | null;
  time_log_id: string | null;
  type: 'mention' | 'comment' | 'like' | 'log_like';
  read: boolean;
  created_at: string;
  sender?: Profile;
  entry?: ReadingEntry & { book?: Book };
  comment?: Pick<Comment, 'content'>;
}

export interface BookSearchResult {
  title: string;
  author: string;
  isbn: string | null;
  coverUrl: string | null;
  bookshopUrl: string;
  description: string | null;
}

export const AVATAR_COLORS = [
  '#0F00E3', // brand blue
  '#E30D00', // brand red
  '#FFC400', // brand yellow
  '#FFE3E3', // brand pink
  '#E3FAFF', // brand sky
];

export const STATUS_LABELS: Record<Status, string> = {
  want_to_read: 'Want to Read',
  reading: 'Reading',
  finished: 'Finished',
  did_not_finish: 'Did Not Finish',
};

const AUDIO_STATUS_LABELS: Record<Status, string> = {
  want_to_read: 'Want to Listen',
  reading: 'Listening',
  finished: 'Finished',
  did_not_finish: 'Did Not Finish',
};

export function statusLabel(status: Status, entryType?: EntryType): string {
  return entryType === 'audiobook' ? AUDIO_STATUS_LABELS[status] : STATUS_LABELS[status];
}

export function entryStatusPhrase(status: Status, entryType?: EntryType): string {
  if (entryType === 'audiobook') {
    if (status === 'reading') return 'is listening to';
    if (status === 'finished') return 'finished listening to';
    if (status === 'did_not_finish') return 'did not finish';
    return 'wants to listen to';
  }
  if (status === 'reading') return 'is reading';
  if (status === 'finished') return 'finished reading';
  if (status === 'did_not_finish') return 'did not finish';
  return 'wants to read';
}

export function formatTimeRead(minutes: number): string {
  if (!minutes || minutes === 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
