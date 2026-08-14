import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

export async function sendMentionNotifications(
  text: string,
  allProfiles: Profile[],
  currentUserId: string,
  entryId: string | null,
  timeLogId: string | null,
  commentId: string | null,
) {
  const mentionedUsernames = (text.match(/@(\w+)/g) ?? []).map((m) => m.slice(1));
  const mentioned = allProfiles.filter(
    (p) => mentionedUsernames.includes(p.username) && p.id !== currentUserId
  );
  if (mentioned.length === 0) return;

  const notifications = mentioned.map((p) => ({
    recipient_id: p.id,
    sender_user_id: currentUserId,
    entry_id: entryId,
    time_log_id: timeLogId,
    comment_id: commentId,
    type: 'mention' as const,
  }));

  await supabase.from('notifications').insert(notifications);
}
