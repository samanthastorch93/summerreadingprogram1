import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function cleanIsbn(isbn: string | null): string | null {
  if (!isbn) return null;
  const cleaned = isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length >= 10 ? cleaned : null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
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
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

function authorMatches(expectedAuthor: string, foundAuthor: string): boolean {
  const sim = similarity(expectedAuthor, foundAuthor);
  if (sim >= 0.6) return true;
  // Check last-name match (handles "Thompson" vs "Thomson", "harpman" vs "Harpman")
  const expParts = normalize(expectedAuthor).split(' ');
  const foundParts = normalize(foundAuthor).split(' ');
  const expLast = expParts[expParts.length - 1];
  const foundLast = foundParts[foundParts.length - 1];
  if (expLast && foundLast && similarity(expLast, foundLast) >= 0.8) return true;
  // Check if any expected name part is contained in found author
  for (const part of expParts) {
    if (part.length >= 4 && foundParts.some((fp) => fp === part || (fp.length >= 4 && similarity(part, fp) >= 0.85))) {
      return true;
    }
  }
  return false;
}

function titleMatches(expectedTitle: string, foundTitle: string): boolean {
  const nt = normalize(expectedTitle);
  const nf = normalize(foundTitle);
  if (nt === nf) return true;
  if (nf.includes(nt) || nt.includes(nf)) return true;
  // For title-only searches, require high similarity to avoid matching
  // completely different books that share a word
  return similarity(nt, nf) >= 0.75;
}

function isGoodDescription(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 50) return false;
  // Reject bibliographic metadata that Open Library often puts in description
  const lower = t.toLowerCase();
  if (/no description/i.test(t)) return false;
  if (/preview/i.test(t)) return false;
  if (/^source title:/i.test(t)) return false;
  if (/^privately printed/i.test(t)) return false;
  if (/^catalog of an exhibition/i.test(t)) return false;
  if (/^previous ed\./i.test(t)) return false;
  if (/includes bibliographical references/i.test(t)) return false;
  if (/includes index/i.test(t)) return false;
  if (/^cover title\./i.test(t)) return false;
  if (/^gift;/i.test(t)) return false;
  if (/selections originally released/i.test(t)) return false;
  if (/^contains:/i.test(t)) return false;
  if (/title from container/i.test(t)) return false;
  // Reject if it's mostly metadata-like (short + no narrative sentences)
  if (t.length < 80 && !/\./.test(t.slice(0, -1))) return false;
  return true;
}

const clean = (text: string) =>
  text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function extractDesc(obj: any): string | null {
  const value = obj?.description ?? obj?.notes ?? null;
  if (!value) return null;
  const text = typeof value === "string" ? value : (value.value ?? null);
  return isGoodDescription(text) ? clean(text) : null;
}

async function checkWorkAndEditions(workKey: string): Promise<string | null> {
  try {
    const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
    if (workRes.ok) {
      const workData = await workRes.json();
      const workDesc = extractDesc(workData);
      if (workDesc) return workDesc;

      try {
        const editionsRes = await fetch(
          `https://openlibrary.org${workKey}/editions.json?limit=30`,
        );
        if (editionsRes.ok) {
          const editionsData = await editionsRes.json();
          for (const ed of editionsData.entries ?? []) {
            const edDesc = extractDesc(ed);
            if (edDesc) return edDesc;
          }
        }
      } catch { /* best effort */ }
    }
  } catch { /* best effort */ }
  return null;
}

async function fetchFromOpenLibrary(
  title: string,
  author: string,
  rawIsbn: string | null,
): Promise<string | null> {
  const isbn = cleanIsbn(rawIsbn);

  // 1. ISBN → edition → work → description (most reliable path — ISBN guarantees
  //    we're looking at the right book)
  if (isbn) {
    try {
      const editionRes = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
      if (editionRes.ok) {
        const edition = await editionRes.json();
        const edDesc = extractDesc(edition);
        if (edDesc) return edDesc;

        const workKey: string | null = edition?.works?.[0]?.key ?? null;
        if (workKey) {
          const desc = await checkWorkAndEditions(workKey);
          if (desc) return desc;
        }
      }
    } catch (err) {
      console.error("OpenLibrary ISBN→Work error", err);
    }
  }

  // 2. Search by title + author — both must match, so this is safe
  try {
    const search = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`,
    );
    if (search.ok) {
      const results = await search.json();
      for (const doc of results.docs ?? []) {
        if (!doc.key) continue;
        const desc = await checkWorkAndEditions(doc.key);
        if (desc) return desc;
      }
    }
  } catch (err) {
    console.error("OpenLibrary title+author search error", err);
  }

  // 3. Title-only search — MUST verify author and title similarity to avoid
  //    matching a completely different book that merely shares a title word.
  //    This catches author name mismatches (typos, transliterations) but
  //    rejects results for different books.
  try {
    const search = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=10`,
    );
    if (search.ok) {
      const results = await search.json();
      for (const doc of results.docs ?? []) {
        if (!doc.key) continue;
        const docTitle: string = doc.title ?? '';
        const docAuthors: string[] = doc.author_name ?? [];
        if (!titleMatches(title, docTitle)) continue;
        if (!docAuthors.some((a) => authorMatches(author, a))) continue;
        const desc = await checkWorkAndEditions(doc.key);
        if (desc) return desc;
      }
    }
  } catch (err) {
    console.error("OpenLibrary title-only search error", err);
  }

  // 4. Raw query search — same author+title verification required.
  //    Catches books stored under alternate titles (e.g. English translation
  //    vs. original language title).
  try {
    const search = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=10`,
    );
    if (search.ok) {
      const results = await search.json();
      for (const doc of results.docs ?? []) {
        if (!doc.key) continue;
        const docTitle: string = doc.title ?? '';
        const docAuthors: string[] = doc.author_name ?? [];
        if (!titleMatches(title, docTitle)) continue;
        if (!docAuthors.some((a) => authorMatches(author, a))) continue;
        const desc = await checkWorkAndEditions(doc.key);
        if (desc) return desc;
      }
    }
  } catch (err) {
    console.error("OpenLibrary raw search error", err);
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { book_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { book_id } = body;
  if (!book_id) {
    return new Response(
      JSON.stringify({ error: "book_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: book, error: fetchErr } = await supabase
    .from("books")
    .select("id, title, author, isbn, description, source_url")
    .eq("id", book_id)
    .maybeSingle();

  if (fetchErr || !book) {
    return new Response(
      JSON.stringify({ error: "Book not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (book.source_url) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "audiobook" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (book.description) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "already_populated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let description: string | null = null;

  try {
    description = await fetchFromOpenLibrary(book.title, book.author, book.isbn);
  } catch (err) {
    console.error("OpenLibrary error", err);
  }

  if (description) {
    description = description.trim();
    console.log(`Found synopsis for "${book.title}"`);
    const { error } = await supabase.from("books").update({ description }).eq("id", book_id);
    if (error) console.error("DB update error", error);
  } else {
    console.log(`No synopsis found for "${book.title}" by ${book.author}`);
  }

  return new Response(
    JSON.stringify({ updated: !!description, description }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
