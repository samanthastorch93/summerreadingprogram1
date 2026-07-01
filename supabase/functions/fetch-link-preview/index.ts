import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getMeta(html: string, property: string): string | null {
  const ogMatch = html.match(
    new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i")
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i")
  );
  if (ogMatch) return ogMatch[1];

  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i")
  );
  return nameMatch ? nameMatch[1] : null;
}

function getTitle(html: string): string | null {
  const og = getMeta(html, "title");
  if (og) return og;
  const tag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return tag ? tag[1].trim() : null;
}

function getSiteName(html: string, url: string): string | null {
  const og = getMeta(html, "site_name");
  if (og) return og;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getAuthor(html: string): string | null {
  // article:author meta
  const article = getMeta(html, "author") ??
    html.match(/<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:author["']/i)?.[1] ??
    html.match(/<meta[^>]+name=["']dc\.creator["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+name=["']byl["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    null;
  return article;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block non-http(s) schemes and private/internal hosts (SSRF prevention)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const hostname = parsed.hostname.toLowerCase();
    const blocked =
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^169\.254\./.test(hostname) || // link-local / AWS metadata
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]";
    if (blocked) {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: ${res.status}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return new Response(JSON.stringify({ error: "Not an HTML page" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read only first 50KB to avoid huge payloads
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      let bytes = 0;
      while (bytes < 50000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
        bytes += value.byteLength;
      }
      reader.cancel();
    }

    const title = getTitle(html);
    const author = getAuthor(html);
    const siteName = getSiteName(html, url);
    const image = getMeta(html, "image");
    const description = getMeta(html, "description");

    return new Response(
      JSON.stringify({ title, author, siteName, image, description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
