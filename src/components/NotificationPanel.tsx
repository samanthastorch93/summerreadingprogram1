import { useState, useEffect } from 'react';
import { X, Bell, Check, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/types';
import type { Notification, Profile } from '../lib/types';
import AvatarIcon from './AvatarIcon';

interface Props {
  currentUserId: string;
  allProfiles: Profile[];
  onClose: () => void;
  onNavigateToEntry: (entryId: string) => void;
}

export default function NotificationPanel({ currentUserId, allProfiles, onClose, onNavigateToEntry }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, comments(content)')
      .eq('recipient_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(40);

    if (!data) { setLoading(false); return; }

    const enriched: Notification[] = (data as any[]).map((n) => ({
      ...n,
      sender: profileMap.get(n.sender_user_id ?? ''),
      comment: n.comments,
    }));

    setNotifications(enriched);
    setLoading(false);
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', currentUserId)
      .eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(notification: Notification) {
    if (!notification.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }
    if (notification.entry_id) {
      onNavigateToEntry(notification.entry_id);
      onClose();
    }
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-lg text-gray-900">Notifications</h2>
            {unread > 0 && (
              <span className="bg-brand-red text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-brand-blue hover:text-blue-800 font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-brand-pink flex items-center justify-center mb-4">
                <MessageCircle className="w-7 h-7 text-brand-red/60" />
              </div>
              <p className="font-semibold text-gray-900 mb-1">No notifications</p>
              <p className="text-sm text-gray-500">
                You&rsquo;ll be notified when someone comments on your posts or mentions you.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                const sender = profileMap.get(n.sender_user_id ?? '');
                const preview = n.comment
                  ? (n.comment as any).content?.slice(0, 60)
                  : null;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${
                      !n.read ? 'bg-brand-sky/50' : ''
                    }`}
                  >
                    {sender ? (
                      sender.avatar_url ? (
                        <img
                          src={sender.avatar_url}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5"
                        />
                      ) : (
                        <AvatarIcon avatarColor={sender.avatar_color} userId={sender.id} size="lg" className="rounded-full mt-0.5" />
                      )
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0 mt-0.5 flex items-center justify-center">
                        <Bell className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 leading-snug">
                        <strong className="font-semibold">{sender?.username ?? 'Someone'}</strong>{' '}
                        {n.type === 'comment'
                          ? 'commented on your post'
                          : n.type === 'like'
                          ? 'liked your reading entry'
                          : n.type === 'log_like'
                          ? 'liked your reading log'
                          : 'mentioned you in a comment'}
                      </p>
                      {preview && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">&ldquo;{preview}&rdquo;</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-brand-red shrink-0 mt-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
