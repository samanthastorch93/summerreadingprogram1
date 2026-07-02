import { useState, useEffect, useRef } from 'react';
import { Send, Camera, X, Loader2, CornerDownRight, Trash2, Heart, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { timeAgo, countWords } from '../lib/types';
import type { Comment, Profile } from '../lib/types';
import ConfirmDialog from './ConfirmDialog';
import AvatarIcon from './AvatarIcon';

function SpoilerSpan({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      className="relative inline cursor-pointer select-none rounded px-0.5 transition-colors"
      style={{ backgroundColor: revealed ? 'transparent' : '#FFE3E3', color: revealed ? 'inherit' : '#FFE3E3' }}
      title="Hover to reveal spoiler"
    >
      {text}
    </span>
  );
}

function renderContent(text: string) {
  // Split on SPOILER: ... patterns first, then handle @mentions within each segment
  const spoilerParts = text.split(/(SPOILER:.*?)(?=\n|$)/g);

  return spoilerParts.map((part, i) => {
    if (part.startsWith('SPOILER:')) {
      const spoilerText = part.slice('SPOILER:'.length).trimStart();
      return (
        <span key={i}>
          <span className="text-xs font-semibold text-gray-500 mr-1">SPOILER:</span>
          <SpoilerSpan text={spoilerText} />
        </span>
      );
    }
    // Handle @mentions in non-spoiler segments
    return part.split(/(@\w+)/g).map((chunk, j) =>
      chunk.startsWith('@') ? (
        <strong key={`${i}-${j}`} className="text-brand-blue font-semibold">{chunk}</strong>
      ) : (
        <span key={`${i}-${j}`}>{chunk}</span>
      )
    );
  });
}

interface Props {
  entryId: string;
  entryOwnerId: string;
  currentUser: Profile;
  allProfiles: Profile[];
  onRefresh: () => void;
}

export default function CommentSection({ entryId, entryOwnerId, currentUser, allProfiles, onRefresh }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<Profile[]>([]);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
  }, [entryId]);

  useEffect(() => {
    if (!photoPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (photoPickerRef.current && !photoPickerRef.current.contains(e.target as Node)) {
        setPhotoPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [photoPickerOpen]);

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true });

    if (!data) { setLoading(false); return; }

    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const commentIds = data.map((c) => c.id);

    const { data: likes } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);

    const newLikedIds = new Set<string>();
    const counts: Record<string, number> = {};
    for (const like of likes ?? []) {
      counts[like.comment_id] = (counts[like.comment_id] ?? 0) + 1;
      if (like.user_id === currentUser.id) newLikedIds.add(like.comment_id);
    }
    setLikedIds(newLikedIds);
    setLikeCounts(counts);

    const enriched: Comment[] = data.map((c) => ({
      ...c,
      profile: profileMap.get(c.user_id),
    }));

    // Build thread tree
    const topLevel = enriched.filter((c) => !c.parent_comment_id);
    const byParent = new Map<string, Comment[]>();
    enriched
      .filter((c) => c.parent_comment_id)
      .forEach((c) => {
        const pid = c.parent_comment_id!;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid)!.push(c);
      });

    const threaded = topLevel.map((c) => ({ ...c, replies: byParent.get(c.id) ?? [] }));
    setComments(threaded);
    setLoading(false);
  }

  function handleTextChange(value: string) {
    setText(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionSuggestions(
        allProfiles.filter(
          (p) =>
            p.id !== currentUser.id &&
            (p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))
        ).slice(0, 5)
      );
    } else {
      setMentionSuggestions([]);
    }
  }

  function selectMention(profile: Profile) {
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, cursor).replace(/@(\w*)$/, `@${profile.username} `);
    const after = text.slice(cursor);
    setText(before + after);
    setMentionSuggestions([]);
    textareaRef.current?.focus();
  }

  function handleReply(comment: Comment) {
    const profile = allProfiles.find((p) => p.id === comment.user_id) ?? comment.profile;
    const username = profile?.username ?? '';
    // Always thread under the top-level comment so replies stay flat
    const topLevelComment = comment.parent_comment_id
      ? (comments.find((c) => c.id === comment.parent_comment_id) ?? comment)
      : comment;
    setReplyingTo(topLevelComment);
    setText(`@${username} `);
    textareaRef.current?.focus();
  }

  function cancelReply() {
    setReplyingTo(null);
    setText('');
  }

  async function toggleLike(commentId: string) {
    const liked = likedIds.has(commentId);
    if (liked) {
      setLikedIds((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
      setLikeCounts((prev) => ({ ...prev, [commentId]: Math.max((prev[commentId] ?? 1) - 1, 0) }));
      await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUser.id);
    } else {
      setLikedIds((prev) => new Set(prev).add(commentId));
      setLikeCounts((prev) => ({ ...prev, [commentId]: (prev[commentId] ?? 0) + 1 }));
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUser.id });
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      setMediaUrl(data.publicUrl);
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !mediaUrl) return;
    if (countWords(text) > 150) return;
    setSubmitting(true);

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        entry_id: entryId,
        content: text.trim() || '📷',
        media_url: mediaUrl,
        media_type: mediaUrl ? 'upload' : null,
        parent_comment_id: replyingTo?.id ?? null,
      })
      .select('id')
      .single();

    if (!error && comment) {
      const mentionedUsernames = (text.match(/@(\w+)/g) ?? []).map((m) => m.slice(1));
      const mentioned = allProfiles.filter(
        (p) => mentionedUsernames.includes(p.username) && p.id !== currentUser.id
      );

      const notificationsToInsert: object[] = mentioned.map((p) => ({
        recipient_id: p.id,
        sender_user_id: currentUser.id,
        comment_id: comment.id,
        entry_id: entryId,
        type: 'mention',
      }));

      // Notify entry owner if they're not the commenter and not already in mention list
      if (
        entryOwnerId !== currentUser.id &&
        !mentioned.some((p) => p.id === entryOwnerId)
      ) {
        notificationsToInsert.push({
          recipient_id: entryOwnerId,
          sender_user_id: currentUser.id,
          comment_id: comment.id,
          entry_id: entryId,
          type: 'comment',
        });
      }

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }
    }

    setText('');
    setMediaUrl(null);
    setMentionSuggestions([]);
    setReplyingTo(null);
    setSubmitting(false);
    await loadComments();
    onRefresh();
  }

  async function handleDelete(commentId: string) {
    await supabase.from('comments').delete().eq('id', commentId);
    await loadComments();
    onRefresh();
  }

  function CommentRow({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
    const commentProfile = allProfiles.find((p) => p.id === comment.user_id) ?? comment.profile;
    return (
      <div className={`flex gap-3${isReply ? ' ml-2' : ''}`}>
        {commentProfile?.avatar_url ? (
          <img
            src={commentProfile.avatar_url}
            alt=""
            className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
          />
        ) : (
          <AvatarIcon avatarColor={commentProfile?.avatar_color ?? '#aaa'} userId={commentProfile?.id ?? ''} size="md" className="rounded-full mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium text-gray-900">
              {commentProfile?.username ?? 'Unknown'}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
            {(comment.user_id === currentUser.id || currentUser.is_moderator) && (
              <button
                onClick={() => setPendingDeleteId(comment.id)}
                className="ml-1 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete comment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          {comment.content && comment.content !== '📷' && (
            <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
              {renderContent(comment.content)}
            </p>
          )}
          {comment.media_url && (
            <img
              src={comment.media_url}
              alt="Attached"
              className="mt-2 rounded-xl max-h-48 object-cover"
            />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleReply(comment)}
              className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-blue transition-colors"
            >
              <CornerDownRight className="w-3 h-3" />
              Reply
            </button>
            <button
              onClick={() => toggleLike(comment.id)}
              className={`mt-1 flex items-center gap-1 text-[11px] transition-colors ${
                likedIds.has(comment.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart className={`w-3 h-3 ${likedIds.has(comment.id) ? 'fill-current' : ''}`} />
              {(likeCounts[comment.id] ?? 0) > 0 && <span>{likeCounts[comment.id]}</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* Comment list with threads */}
          {comments.length > 0 && (
            <div className="space-y-4 mb-4">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <CommentRow comment={comment} />
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="space-y-3 mt-2 ml-10 pl-3 border-l-2 border-gray-200">
                      {comment.replies.map((reply) => (
                        <CommentRow key={reply.id} comment={reply} isReply />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Replying-to indicator */}
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-blue-50 border border-brand-blue/30 rounded-lg text-xs text-brand-blue">
              <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
              <span>
                Replying to{' '}
                <strong className="font-semibold">
                  {(allProfiles.find((p) => p.id === replyingTo.user_id) ?? replyingTo.profile)?.username ?? 'Unknown'}
                </strong>
              </span>
              <button onClick={cancelReply} className="ml-auto hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="relative">
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 animate-scale-in">
                {mentionSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectMention(p); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    <AvatarIcon avatarColor={p.avatar_color} userId={p.id} size="sm" className="rounded-full" />
                    <span className="text-sm text-gray-900">@{p.username}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <AvatarIcon avatarColor={currentUser.avatar_color} userId={currentUser.id} size="md" className="rounded-full" />
              )}
              <div className="flex-1 relative">
                {mediaUrl && (
                  <div className="relative inline-block mb-1">
                    <img src={mediaUrl} alt="" className="h-16 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setMediaUrl(null)}
                      className="absolute -top-1 -right-1 bg-gray-900 text-white rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder={replyingTo ? 'Write a reply…' : 'Add a comment… type @ to mention'}
                  rows={1}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                />
                {countWords(text) >= 140 && (
                  <p className={`text-[11px] mt-0.5 text-right font-medium ${countWords(text) > 150 ? 'text-brand-red' : 'text-amber-500'}`}>
                    {countWords(text)} / 150 words
                  </p>
                )}
              </div>
              <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPhotoPickerOpen((o) => !o)}
                disabled={uploading}
                className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
                title="Attach photo"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className={`w-4 h-4 ${mediaUrl ? 'text-brand-blue' : ''}`} />
                )}
              </button>
              {photoPickerOpen && (
                <div
                  ref={photoPickerRef}
                  className="absolute right-0 bottom-full mb-1 z-50 bg-white border-2 border-brand-blue shadow-[4px_4px_0px_0px_rgba(15,0,227,1)] w-64"
                >
                  <button
                    type="button"
                    onClick={() => { setPhotoPickerOpen(false); fileRef.current?.click(); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-brand-blue border-b border-gray-100 hover:bg-blue-50 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Upload from file
                  </button>
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste image URL…"
                        className="flex-1 text-xs border border-gray-200 px-2 py-1.5 focus:outline-none focus:border-brand-blue"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && urlInput.trim()) {
                            setMediaUrl(urlInput.trim());
                            setUrlInput('');
                            setPhotoPickerOpen(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (urlInput.trim()) {
                            setMediaUrl(urlInput.trim());
                            setUrlInput('');
                            setPhotoPickerOpen(false);
                          }
                        }}
                        className="px-2 py-1.5 bg-brand-blue text-white text-[10px] font-bold uppercase hover:bg-blue-800 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
              <button
                type="submit"
                disabled={submitting || (!text.trim() && !mediaUrl) || countWords(text) > 150}
                className="p-2 bg-brand-blue text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </form>
        </>
      )}
    </div>

    {pendingDeleteId && (
      <ConfirmDialog
        message="Delete this comment? This cannot be undone."
        onConfirm={() => { const id = pendingDeleteId; setPendingDeleteId(null); handleDelete(id); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    )}
  </>
  );
}
