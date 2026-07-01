import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_BOOKS_API_KEY = "AIzaSyBra5vSQxneQ-A5o5_seeLZVVtM7wCHpsg";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const clean = (text: string) =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function fetchFullVolumeDescription(volumeId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes/${volumeId}?key=${GOOGLE_BOOKS_API_KEY}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const desc = data.volumeInfo?.description ?? null;
    return desc ? clean(desc) : null;
  } catch {
    return null;
  }
}

async function fetchFromGoogleBooks(
  title: string,
  author: string,
  isbn: string | null,
): Promise<string | null> {
  const key = `&key=${GOOGLE_BOOKS_API_KEY}`;

  const searchUrls: string[] = [];

  if (isbn) {
    searchUrls.push(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=5${key}`,
    );
  }

  searchUrls.push(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      `intitle:"${title}" inauthor:"${author}"`,
    )}&maxResults=5&printType=books${key}`,
  );

  for (const url of searchUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      for (const item of data.items ?? []) {
        if (item.volumeInfo?.description) {
          return clean(item.volumeInfo.description);
        }
        if (item.id) {
          const full = await fetchFullVolumeDescription(item.id);
          if (full) return full;
        }
      }
    } catch (err) {
      console.error("Google Books error", err);
    }
  }

  return null;
}

async function fetchFromOpenLibrary(
  title: string,
  author: string,
  isbn: string | null,
): Promise<string | null> {
  const extract = (obj: any): string | null => {
    const value = obj?.description ?? obj?.notes ?? null;
    if (!value) return null;
    if (typeof value === "string") return value;
    return value.value ?? null;
  };

  try {
    if (isbn) {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      );
      if (res.ok) {
        const data = await res.json();
        const synopsis = extract(data[`ISBN:${isbn}`]);
        if (synopsis) return synopsis;
      }
    }

    const search = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=2`,
    );
    if (!search.ok) return null;

    const results = await search.json();

    for (const doc of results.docs ?? []) {
      if (!doc.key) continue;
      const work = await fetch(`https://openlibrary.org${doc.key}.json`);
      if (!work.ok) continue;
      const workData = await work.json();
      const synopsis = extract(workData);
      if (synopsis) return synopsis;
    }
  } catch (err) {
    console.error("OpenLibrary error", err);
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

  // Articles have a source_url — skip them
  if (book.source_url) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "article" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Already has a description — skip
  if (book.description) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "already_populated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let description = await fetchFromGoogleBooks(book.title, book.author, book.isbn);
  if (!description) {
    description = await fetchFromOpenLibrary(book.title, book.author, book.isbn);
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
