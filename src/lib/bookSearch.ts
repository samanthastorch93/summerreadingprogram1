import { supabase } from './supabase';
import type { BookSearchResult } from './types';

const GOOGLE_BOOKS_API_KEY = 'AIzaSyBra5vSQxneQ-A5o5_seeLZVVtM7wCHpsg';
const FETCH_TIMEOUT_MS = 2500;

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mapGoogleItem(item: any): BookSearchResult | null {
  const info = item.volumeInfo;
  if (!info?.title) return null;
  const ratingsCount = Number(info.ratingsCount) || 0;
  const averageRating = Number(info.averageRating) || 0;
  const popularity = Math.min(
    1,
    (Math.log10(ratingsCount + 1) / 5) * 0.75 + (averageRating / 5) * 0.25,
  );
  const author = info.authors?.[0] ?? 'Unknown';
  const identifiers: any[] = info.industryIdentifiers ?? [];
  const isbn =
    identifiers.find((x: any) => x.type === 'ISBN_13')?.identifier ??
    identifiers.find((x: any) => x.type === 'ISBN_10')?.identifier ??
    null;
  const rawThumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
  const coverUrl = rawThumb
    ? rawThumb.replace('http://', 'https://').replace('&edge=curl', '')
    : null;
  return {
    title: info.title,
    author,
    isbn,
    coverUrl,
    description: info.description ?? null,
    popularity,
    bookshopUrl: `https://bookshop.org/beta-search?keywords=${encodeURIComponent(info.title + ' ' + author)}`,
  };
}

async function searchGoogleBooks(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const keyParam = GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : '';

  async function fetchQuery(q: string, orderBy = 'relevance'): Promise<any[]> {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=40&printType=books&orderBy=${orderBy}${keyParam}`
    );
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.items ?? [];
  }

  const isRawQuery = titleQ && authorQ && titleQ === authorQ;

  let items: any[] = [];

  if (isRawQuery) {
    items = await fetchQuery(titleQ);
  } else {
    const parts: string[] = [];
    if (titleQ) parts.push(`intitle:"${titleQ}"`);
    if (authorQ) parts.push(`inauthor:"${authorQ}"`);
    items = await fetchQuery(parts.join(' '));

    if (items.length === 0 && titleQ) {
      const fallbackParts: string[] = [`intitle:${titleQ}`];
      if (authorQ) fallbackParts.push(authorQ);
      items = await fetchQuery(fallbackParts.join(' '));
    }

    if (items.length === 0) {
      items = await fetchQuery([titleQ, authorQ].filter(Boolean).join(' '));
    }
  }

  const relevanceResults = items.map(mapGoogleItem).filter((b): b is BookSearchResult => b !== null);

  // For recent (2026) books: do a second query ordered by newest publication date.
  // This catches newly released titles that may not rank highly by relevance.
  if (titleQ) {
    try {
      const newestQ = isRawQuery
        ? titleQ
        : [titleQ, authorQ].filter(Boolean).join(' ');
      const newestItems = await fetchQuery(newestQ, 'newest');
      const newestResults = newestItems
        .map(mapGoogleItem)
        .filter((b): b is BookSearchResult => b !== null);
      // Merge newest results that aren't already in the relevance set
      const seen = new Set(relevanceResults.map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`));
      for (const book of newestResults) {
        const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          relevanceResults.push(book);
        }
      }
    } catch { /* best effort */ }
  }

  return relevanceResults;
}

async function searchOpenLibrary(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const params = new URLSearchParams({
    fields: 'title,author_name,isbn,cover_i,key,ratings_average,ratings_count,want_to_read_count,readinglog_count,edition_count',
    limit: '40',
    sort: 'rating',
  });
  const isRawQuery = titleQ && authorQ && titleQ === authorQ;
  if (isRawQuery) {
    params.set('q', titleQ);
  } else {
    if (titleQ) params.set('title', titleQ);
    if (authorQ) params.set('author', authorQ);
  }
  if (!titleQ && !authorQ) return [];
  const res = await fetchWithTimeout(`https://openlibrary.org/search.json?${params}`);
  if (!res.ok) throw new Error('Open Library error');
  const data = await res.json();
  return (data.docs ?? [])
    .filter((d: any) => d.title)
    .map((d: any) => {
      const author = d.author_name?.[0] ?? 'Unknown';
      const isbn = d.isbn?.[0] ?? null;
      const coverId = d.cover_i ?? null;
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
      const ratingsCount = Number(d.ratings_count) || 0;
      const wantToReadCount = Number(d.want_to_read_count) || 0;
      const readingLogCount = Number(d.readinglog_count) || 0;
      const popularity = Math.min(
        1,
        (Math.log10(ratingsCount + wantToReadCount + readingLogCount + 1) / 6) * 0.8
          + ((Number(d.ratings_average) || 0) / 5) * 0.2,
      );
      return {
        title: d.title,
        author,
        isbn,
        coverUrl,
        description: null,
        popularity,
        bookshopUrl: `https://bookshop.org/beta-search?keywords=${encodeURIComponent(d.title + ' ' + author)}`,
      };
    });
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function titleMatchScore(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();
  if (!q) return 0;
  if (t === q) return 1.0;
  if (t.startsWith(q)) return 0.92;
  if (t.includes(q)) return 0.85;
  return similarity(q, t.slice(0, Math.max(q.length, t.length))) * 0.7;
}

function authorMatchScore(query: string, author: string): number {
  const q = query.toLowerCase().trim();
  const a = author.toLowerCase().trim();
  if (!q) return 0;
  if (a === q) return 1.0;
  if (a.startsWith(q)) return 0.9;
  if (a.includes(q)) return 0.8;
  return similarity(q, a) * 0.6;
}

export function rankResults(results: BookSearchResult[], titleQ: string, authorQ?: string): BookSearchResult[] {
  const tq = (titleQ || '').toLowerCase().trim();
  const aq = (authorQ ?? '').toLowerCase().trim();
  if (!tq && !aq) return results;
  return [...results].sort((a, b) => {
    const aTitle = titleMatchScore(tq, a.title);
    const bTitle = titleMatchScore(tq, b.title);
    const aAuthor = authorMatchScore(aq, a.author);
    const bAuthor = authorMatchScore(aq, b.author);
    // Title match dominates; author is a tiebreaker
    const aScore = aTitle * 2 + aAuthor + (a.popularity ?? 0) * 0.35;
    const bScore = bTitle * 2 + bAuthor + (b.popularity ?? 0) * 0.35;
    return bScore - aScore;
  });
}

export async function searchBooksInDb(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const t = (titleQ || '').trim();
  const a = (authorQ || '').trim();
  if (!t && !a) return [];

  const { data, error } = await supabase.rpc('fuzzy_search_books', {
    search_title: t || null,
    search_author: a || null,
    limit_count: 10,
  });

  if (error || !data) {
    let fallback = supabase.from('books').select('id, title, author, isbn, cover_url, open_library_cover_id, description, bookshop_url, source_url').limit(10);
    if (t) fallback = fallback.ilike('title', `%${t}%`);
    if (a) fallback = fallback.ilike('author', `%${a}%`);
    const { data: fbData } = await fallback;
    return (fbData ?? []).map(dbRowToBookSearchResult);
  }

  return (data as any[]).map(dbRowToBookSearchResult);
}

function dbRowToBookSearchResult(b: any): BookSearchResult {
  const cover = b.cover_url
    ?? (b.open_library_cover_id ? `https://covers.openlibrary.org/b/id/${b.open_library_cover_id}-M.jpg` : null);
  return {
    title: b.title,
    author: b.author,
    isbn: b.isbn,
    coverUrl: cover,
    description: b.description,
    popularity: 0,
    bookshopUrl: b.bookshop_url ?? `https://bookshop.org/beta-search?keywords=${encodeURIComponent(b.title + ' ' + b.author)}`,
  };
}

export async function searchExternal(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  // Run Google Books and Open Library in parallel so the slowest source
  // determines the wait, not the sum of both.
  const [googleResult, olResult] = await Promise.allSettled([
    searchGoogleBooks(titleQ, authorQ),
    searchOpenLibrary(titleQ, authorQ),
  ]);

  const googleBooks = googleResult.status === 'fulfilled' ? googleResult.value : [];
  const olBooks = olResult.status === 'fulfilled' ? olResult.value : [];

  // Merge: Google Books first (better metadata for recent books), then OL for extras
  const seen = new Set(googleBooks.map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`));
  const merged = [...googleBooks];
  for (const book of olBooks) {
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(book);
    }
  }

  return merged;
}

export async function searchBooks(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const external = await searchExternal(titleQ, authorQ);
  return rankResults(external, titleQ, authorQ);
}

export async function searchBooksHybrid(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const dbTitleQ = titleQ;
  const dbAuthorQ = authorQ || titleQ;

  const [dbResult, externalResult] = await Promise.allSettled([
    searchBooksInDb(dbTitleQ, dbAuthorQ),
    searchExternal(titleQ, authorQ),
  ]);

  const dbResults = dbResult.status === 'fulfilled' ? dbResult.value : [];
  const externalResults = externalResult.status === 'fulfilled' ? externalResult.value : [];

  // Merge: prefer external results for better metadata, but include DB results
  // that don't match an external result. External results carry fresher covers,
  // ISBNs, and descriptions.
  const externalKeys = new Set(externalResults.map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`));
  const merged = [...externalResults];
  for (const book of dbResults) {
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
    if (!externalKeys.has(key)) {
      externalKeys.add(key);
      merged.push(book);
    }
  }

  return rankResults(merged, titleQ, authorQ).slice(0, 10);
}

export function cleanIsbn(isbn: string | null): string | null {
  if (!isbn) return null;
  const cleaned = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length >= 10 ? cleaned : null;
}

export async function fetchBookDescription(
  bookId: string | null,
  title: string,
  author: string,
  rawIsbn: string | null
): Promise<string | null> {
  const isbn = cleanIsbn(rawIsbn);

  if (bookId) {
    const { data: bookRow } = await supabase.from('books').select('description').eq('id', bookId).maybeSingle();
    if (bookRow?.description) return bookRow.description;
  }

  if (bookId) {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/populate-book-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ book_id: bookId }),
      }, 5000);
      if (res.ok) {
        const data = await res.json();
        if (data.description) return data.description;
      }
    } catch { /* fall through */ }
  }

  // Client-side fallback: try Open Library directly (useful when book isn't in DB yet)
  try {
    if (isbn) {
      try {
        const editionRes = await fetchWithTimeout(`https://openlibrary.org/isbn/${isbn}.json`);
        if (editionRes.ok) {
          const edition = await editionRes.json();
          const workKey: string | null = edition?.works?.[0]?.key ?? null;
          if (workKey) {
            const workRes = await fetchWithTimeout(`https://openlibrary.org${workKey}.json`);
            if (workRes.ok) {
              const workData = await workRes.json();
              const raw = workData?.description ?? workData?.notes ?? null;
              const text = raw ? (typeof raw === 'string' ? raw : raw.value ?? null) : null;
              if (text && text.trim().length >= 50) return text;
            }
          }
        }
      } catch { /* fall through */ }
    }
    const search = await fetchWithTimeout(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=3`
    );
    if (search.ok) {
      const results = await search.json();
      for (const doc of results.docs ?? []) {
        if (!doc.key) continue;
        try {
          const workRes = await fetchWithTimeout(`https://openlibrary.org${doc.key}.json`);
          if (!workRes.ok) continue;
          const workData = await workRes.json();
          const raw = workData?.description ?? workData?.notes ?? null;
          const text = raw ? (typeof raw === 'string' ? raw : raw.value ?? null) : null;
          if (text && text.trim().length >= 50) return text;
        } catch { continue; }
      }
    }
  } catch { /* fall through */ }
  return null;
}
