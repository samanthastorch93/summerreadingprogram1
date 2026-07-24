import { supabase } from './supabase';
import type { BookSearchResult } from './types';

const GOOGLE_BOOKS_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY ?? '';
const FETCH_TIMEOUT_MS = 3000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchGoogleBooks(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const keyParam = GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : '';

  async function fetchQuery(q: string) {
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books&orderBy=relevance${keyParam}`
    );
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.items ?? [];
  }

  function mapItem(item: any): BookSearchResult | null {
    const info = item.volumeInfo;
    if (!info?.title) return null;
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
      bookshopUrl: `https://bookshop.org/beta-search?keywords=${encodeURIComponent(info.title + ' ' + author)}`,
    };
  }

  const parts: string[] = [];
  if (titleQ) parts.push(`intitle:"${titleQ}"`);
  if (authorQ) parts.push(authorQ);
  const qualifiedQ = parts.join(' ');

  let items = await fetchQuery(qualifiedQ);

  if (items.length === 0 && titleQ) {
    const unquotedParts: string[] = [`intitle:${titleQ}`];
    if (authorQ) unquotedParts.push(authorQ);
    items = await fetchQuery(unquotedParts.join(' '));
  }

  if (items.length === 0) {
    const plainQ = [titleQ, authorQ].filter(Boolean).join(' ');
    items = await fetchQuery(plainQ);
  }

  return items.map(mapItem).filter((b): b is BookSearchResult => b !== null);
}

async function searchOpenLibrary(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const params = new URLSearchParams({ fields: 'title,author_name,isbn,cover_i,key', limit: '10' });
  if (titleQ) params.set('title', titleQ);
  if (authorQ) params.set('author', authorQ);
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
      return {
        title: d.title,
        author,
        isbn,
        coverUrl,
        description: null,
        bookshopUrl: `https://bookshop.org/beta-search?keywords=${encodeURIComponent(d.title + ' ' + author)}`,
      };
    });
}

function rankResults(results: BookSearchResult[], titleQ: string): BookSearchResult[] {
  const q = titleQ.toLowerCase().trim();
  return [...results].sort((a, b) => {
    const at = a.title.toLowerCase().trim();
    const bt = b.title.toLowerCase().trim();
    const aExact = at === q ? 0 : at.startsWith(q) ? 1 : at.includes(q) ? 2 : 3;
    const bExact = bt === q ? 0 : bt.startsWith(q) ? 1 : bt.includes(q) ? 2 : 3;
    return aExact - bExact;
  });
}

export async function searchBooksInDb(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  let query = supabase.from('books').select('id, title, author, isbn, cover_url, open_library_cover_id, description, bookshop_url, source_url').limit(10);
  if (titleQ) {
    query = query.ilike('title', `%${titleQ}%`);
  }
  if (authorQ) {
    query = query.ilike('author', `%${authorQ}%`);
  }
  const { data } = await query;
  if (!data) return [];
  return data.map((b) => {
    const cover = b.cover_url
      ?? (b.open_library_cover_id ? `https://covers.openlibrary.org/b/id/${b.open_library_cover_id}-M.jpg` : null);
    return {
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      coverUrl: cover,
      description: b.description,
      bookshopUrl: b.bookshop_url ?? `https://bookshop.org/beta-search?keywords=${encodeURIComponent(b.title + ' ' + b.author)}`,
    } as BookSearchResult;
  });
}

export async function searchBooks(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  try {
    return rankResults(await searchGoogleBooks(titleQ, authorQ), titleQ);
  } catch {
    return rankResults(await searchOpenLibrary(titleQ, authorQ), titleQ);
  }
}

export async function searchBooksHybrid(titleQ: string, authorQ: string): Promise<BookSearchResult[]> {
  const [dbResult, externalResult] = await Promise.allSettled([
    searchBooksInDb(titleQ, authorQ),
    searchBooks(titleQ, authorQ),
  ]);

  const dbResults = dbResult.status === 'fulfilled' ? dbResult.value : [];
  const externalResults = externalResult.status === 'fulfilled' ? externalResult.value : [];

  const seen = new Set(dbResults.map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`));
  const merged = [...dbResults];
  for (const book of externalResults) {
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(book);
    }
  }

  return rankResults(merged, titleQ).slice(0, 10);
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
