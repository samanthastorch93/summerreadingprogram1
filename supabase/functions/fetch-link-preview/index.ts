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

// Returns true when the hostname must never be fetched: loopback, link-local,
// private ranges, internal suffixes, and non-dotted-decimal encodings of the same.
function isBlockedHost(rawHost: string): boolean {
  const hostname = rawHost.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) return true;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "::"
  ) return true;

  // IPv6 loopback / unique-local (fc00::/7) / link-local (fe80::/10)
  if (hostname.includes(":")) {
    if (/^(f[cd]|fe[89ab])/i.test(hostname)) return true;
    // IPv4-mapped IPv6, e.g. ::ffff:169.254.169.254
    const mapped = hostname.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedHost(mapped[1]);
    return false;
  }

  // Normalise decimal / octal / hex encodings of an IPv4 address to dotted quad.
  let octets: number[] | null = null;
  const dotted = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    octets = dotted.slice(1).map((n) => parseInt(n, 10));
  } else if (/^\d+$/.test(hostname)) {
    const n = Number(hostname);
    if (Number.isFinite(n) && n <= 0xffffffff) {
      octets = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    }
  } else if (/^0x[0-9a-f]+$/.test(hostname)) {
    const n = parseInt(hostname, 16);
    if (Number.isFinite(n) && n <= 0xffffffff) {
      octets = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    }
  }

  if (octets && octets.every((o) => o >= 0 && o <= 255)) {
    const [a, b] = octets;
    if (a === 0 || a === 127) return true;                 // this-host, loopback
    if (a === 10) return true;                             // private
    if (a === 172 && b >= 16 && b <= 31) return true;       // private
    if (a === 192 && b === 168) return true;                // private
    if (a === 169 && b === 254) return true;                // link-local / metadata
    if (a === 100 && b >= 64 && b <= 127) return true;       // carrier-grade NAT
    if (a >= 224) return true;                              // multicast / reserved
  }

  return false;
}

const MAX_REDIRECTS = 5;

// Follows redirects by hand so that EVERY hop is validated, not just the first one.
async function safeFetch(startUrl: string): Promise<Response | { error: string }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { error: "Invalid url" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "Invalid url" };
    }
    if (isBlockedHost(parsed.hostname)) {
      return { error: "Invalid url" };
    }

    const res = await fetch(current, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) return { error: "Invalid url" };
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return { error: "Too many redirects" };
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
    if (isBlockedHost(parsed.hostname)) {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fetched = await safeFetch(url);
    if ("error" in fetched) {
      return new Response(JSON.stringify({ error: fetched.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = fetched;

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
    console.error("fetch-link-preview failed", err);
    return new Response(
      JSON.stringify({ error: "Could not fetch link preview" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
