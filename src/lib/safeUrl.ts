/**
 * Returns the URL only when it is a plain http(s) link, otherwise null.
 * Anything a user typed (an audiobook listen link, a pasted image address) is
 * rendered for OTHER readers, so a `javascript:` or `data:` URL would run in
 * their browser. Everything that becomes an href or an img src goes through here.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(url: string | null | undefined): boolean {
  return safeHttpUrl(url) !== null;
}
