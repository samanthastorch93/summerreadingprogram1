import { useState, useRef, useEffect } from 'react';
import { Clock, BookOpen, MoreHorizontal, Loader2, Check, X, Camera, Trash2, Heart, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { timeAgo, formatTimeRead, STATUS_LABELS } from '../lib/types';
import type { TimeLog, Profile } from '../lib/types';
import ConfirmDialog from './ConfirmDialog';
import CommentSection from './CommentSection';
import AvatarIcon from './AvatarIcon';
import BookSynopsisModal from './BookSynopsisModal';

interface Props {
  log: TimeLog;
  allProfiles: Profile[];
  currentUser: Profile;
  onRefresh: () => void;
}

export default function ActivityCard({ log, allProfiles, currentUser, onRefresh }: Props) {
  const profile = allProfiles.find((p) => p.id === log.user_id) ?? log.profile;
  const book = log.book;
  const isFinishedEvent = log.minutes_added === 0 && log.status_override === 'finished';
  const timeLabel = isFinishedEvent ? null : formatTimeRead(log.minutes_added);
  const isOwn = log.user_id === currentUser.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editMinutes, setEditMinutes] = useState(String(log.minutes_added));
  const [editNote, setEditNote] = useState(log.note ?? '');
  const [editMediaUrl, setEditMediaUrl] = useState<string | null>(log.media_url ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingFinished, setMarkingFinished] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  async function handleDelete() {
    setDeleting(true);
    await supabase.from('time_logs').delete().eq('id', log.id);
    setDeleting(false);
    onRefresh();
  }

  function startEdit() {
    setMenuOpen(false);
    setEditMinutes(String(log.minutes_added));
    setEditNote(log.note ?? '');
    setEditMediaUrl(log.media_url ?? null);
    setEditing(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    const ext = file.name.split('.').pop();
    const path = `time-logs/${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      setEditMediaUrl(data.publicUrl);
    }
    setPhotoUploading(false);
    if (photoFileRef.current) photoFileRef.current.value = '';
  }

  async function handleSave() {
    const mins = parseInt(editMinutes || '0', 10);
    if (!mins || mins <= 0) return;
    setSaving(true);
    await supabase
      .from('time_logs')
      .update({ minutes_added: mins, note: editNote.trim() || null, media_url: editMediaUrl })
      .eq('id', log.id);
    setSaving(false);
    setEditing(false);
    onRefresh();
  }

  async function handleMarkFinished() {
    setMenuOpen(false);
    setMarkingFinished(true);
    await supabase
      .from('reading_entries')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', log.entry_id);
    await supabase
      .from('time_logs')
      .update({ status_override: 'finished' })
      .eq('id', log.id);
    setMarkingFinished(false);
    onRefresh();
  }

  useEffect(() => {
    supabase
      .from('time_log_likes')
      .select('user_id')
      .eq('time_log_id', log.id)
      .then(({ data }) => {
        const rows = data ?? [];
        setLikeCount(rows.length);
        setIsLiked(rows.some((r) => r.user_id === currentUser.id));
      });
  }, [log.id]);

  async function toggleLike() {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount((n) => Math.max(n - 1, 0));
      await supabase.from('time_log_likes').delete().eq('time_log_id', log.id).eq('user_id', currentUser.id);
    } else {
      setIsLiked(true);
      setLikeCount((n) => n + 1);
      await supabase.from('time_log_likes').insert({ time_log_id: log.id });
      if (log.user_id !== currentUser.id) {
        await supabase.from('notifications').insert({
          recipient_id: log.user_id,
          sender_user_id: currentUser.id,
          time_log_id: log.id,
          entry_id: log.entry_id ?? null,
          type: 'log_like',
        });
      }
    }
  }

  return (
    <>
    <article className="bg-white border-2 border-brand-blue">
      {/* Author + action header */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-gray-100">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-7 h-7 border-2 border-brand-blue object-cover shrink-0"
          />
        ) : (
          <AvatarIcon avatarColor={profile?.avatar_color ?? '#888'} userId={profile?.id ?? ''} size="md" className="border-2 border-brand-blue" />
        )}
        <p className="text-sm text-gray-700 min-w-0 flex-1">
          <span className="font-semibold text-gray-900">{profile?.username ?? 'Unknown'}</span>
          {' '}
          {isFinishedEvent ? (
            <>
              <span className="text-gray-500">finished reading</span>
            </>
          ) : (
            <>
              <span className="text-gray-500">logged</span>
              {' '}
              <span className="font-semibold text-gray-900">{timeLabel}</span>
              {log.status_override === 'finished' && (
                <>
                  {' '}
                  <span className="text-gray-500">and</span>
                  {' '}
                  <span className="text-gray-500">
                    finished
                  </span>
                </>
              )}
              {log.status_override && log.status_override !== 'finished' && (
                <>
                  {' '}
                  <span className="text-gray-500">— now</span>
                  {' '}
                  <span className="text-gray-900">
                    {STATUS_LABELS[log.status_override]}
                  </span>
                </>
              )}
            </>
          )}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-400">{timeAgo(log.created_at)}</span>
          {isOwn && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                disabled={deleting || markingFinished}
                className="p-0.5 text-gray-400 hover:text-gray-900 transition-colors"
                aria-label="Time log options"
              >
                {(deleting || markingFinished)
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <MoreHorizontal className="w-4 h-4" />}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-6 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] min-w-[160px]">
                  {!isFinishedEvent && (
                    <button
                      onClick={startEdit}
                      className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue border-b-2 border-brand-blue hover:bg-blue-50 transition-colors"
                    >
                      Edit Log
                    </button>
                  )}
                  {log.status_override !== 'finished' && (
                    <button
                      onClick={handleMarkFinished}
                      disabled={markingFinished}
                      className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-700 border-b-2 border-brand-blue hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {markingFinished ? 'Saving…' : 'Mark as Finished'}
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                    className="w-full text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-red hover:bg-red-50 transition-colors"
                  >
                    Delete Log
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Book row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {book?.cover_url ? (
          <button
            type="button"
            onClick={() => setSynopsisOpen(true)}
            className="block cursor-pointer focus:outline-none"
            title="View synopsis"
          >
            <img
              src={book.cover_url}
              alt={book?.title}
              className="w-9 h-[52px] object-cover border-2 border-brand-blue shrink-0 hover:opacity-80 transition-opacity"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSynopsisOpen(true)}
            className="block cursor-pointer focus:outline-none"
            title="View synopsis"
          >
            <div className="w-9 h-[52px] border-2 border-brand-blue bg-gray-100 flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
              <BookOpen className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-snug truncate">{book?.title ?? 'Unknown Book'}</p>
          <p className="text-xs text-gray-500 truncate">{book?.author}</p>
          {!editing && log.note && (
            <p className="text-sm text-gray-700 mt-3 leading-relaxed">{log.note}</p>
          )}
        </div>
        {!editing && !isFinishedEvent && (
          <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0 border-2 border-brand-blue px-2 py-1">
            <Clock className="w-3 h-3" />
            <span>{timeLabel}</span>
          </div>
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="px-4 pb-4 space-y-2">
          {/* Minutes + note row */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="number"
                min="1"
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                className="w-20 px-2 py-1.5 pr-8 border-2 border-brand-blue text-sm focus:outline-none text-center"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">min</span>
            </div>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Note…"
              className="flex-1 px-3 py-1.5 border-2 border-brand-blue text-sm focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            <button
              onClick={handleSave}
              disabled={saving || !editMinutes || parseInt(editMinutes) <= 0}
              className="p-1.5 bg-brand-blue text-white hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo edit row */}
          <div className="flex items-center gap-2">
            {editMediaUrl ? (
              <>
                <img src={editMediaUrl} alt="" className="h-14 rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => photoFileRef.current?.click()}
                  disabled={photoUploading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-brand-blue text-[11px] font-semibold uppercase tracking-wide text-brand-blue hover:bg-blue-50 transition-colors"
                >
                  {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setEditMediaUrl(null)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-brand-blue text-[11px] font-semibold uppercase tracking-wide text-brand-red hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => photoFileRef.current?.click()}
                disabled={photoUploading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-brand-blue text-[11px] font-semibold uppercase tracking-wide text-brand-blue hover:bg-blue-50 transition-colors"
              >
                {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                Add Photo
              </button>
            )}
          </div>

          <input
            ref={photoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
      )}

      {/* Attached photo (non-editing view) */}
      {!editing && editMediaUrl && (
        <div className="border-t-2 border-brand-blue bg-gray-50">
          <img
            src={editMediaUrl}
            alt="Attached"
            className="w-full max-h-96 object-contain p-3"
          />
        </div>
      )}

      {/* Footer action bar */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t-2 border-brand-blue bg-brand-pink">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
        <button
          onClick={() => setCommentsOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          comment
          <span className="text-[10px]">{commentsOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {commentsOpen && (
        <CommentSection
          entryId={log.entry_id}
          currentUser={currentUser}
          allProfiles={allProfiles}
          onRefresh={onRefresh}
        />
      )}
    </article>

    {confirmDelete && (
      <ConfirmDialog
        message="Delete this time log? This cannot be undone."
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    )}

    {synopsisOpen && book && (
      <BookSynopsisModal
        bookId={book.id}
        title={book.title}
        author={book.author}
        coverUrl={book.cover_url}
        isbn={book.isbn}
        description={book.description ?? null}
        onClose={() => setSynopsisOpen(false)}
      />
    )}
  </>
  );
}
