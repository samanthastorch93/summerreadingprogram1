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

function isGoodDescription(text: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 50) return false;
  if (/no description/i.test(t)) return false;
  if (/preview/i.test(t)) return false;
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

      // Check edition-level descriptions — one edition often has a
      // publisher-provided description even when the work doesn't
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

  // 1. ISBN → edition → work → description (most reliable path)
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

  // 2. Search by title + author
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

  // 3. Search by title only — author name mismatches (typos, transliterations)
  //    cause the title+author search to miss. Title-only is broader but catches
  //    the right work when the author name in our DB doesn't match Open Library.
  try {
    const search = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`,
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
    console.error("OpenLibrary title-only search error", err);
  }

  // 4. Raw query search — catches books whose title is stored differently
  //    (e.g. "I who have never known men" is the English translation title;
  //    Open Library has the French original "Moi qui n'ai pas connu les hommes")
  try {
    const search = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=5`,
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
