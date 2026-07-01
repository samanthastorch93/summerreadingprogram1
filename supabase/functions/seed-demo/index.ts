import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function daysAgo(n: number, hoursOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hoursOffset);
  return d.toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Grant moderator to all pre-existing profiles
  await supabase.from("profiles").update({ is_moderator: true }).not("username", "like", "%_demo");

  // Idempotency check
  const { data: existing } = await supabase
    .from("profiles").select("id").eq("username", "alice_demo").maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ message: "Already seeded" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const DEMO_PASSWORD = "SummerReading2026!";
  const demoUsers = [
    { username: "alice_demo",  display_name: "Alice Chen",       color: "#0F00E3" },
    { username: "bob_demo",    display_name: "Bob Martinez",     color: "#E30D00" },
    { username: "carlos_demo", display_name: "Carlos Rivera",    color: "#D97706" },
    { username: "diana_demo",  display_name: "Diana Patel",      color: "#059669" },
    { username: "elena_demo",  display_name: "Elena Kowalski",   color: "#0891B2" },
    { username: "frank_demo",  display_name: "Frank Thompson",   color: "#B45309" },
    { username: "grace_demo",  display_name: "Grace Okafor",     color: "#1D4ED8" },
    { username: "henry_demo",  display_name: "Henry Zhang",      color: "#DC4A04" },
    { username: "iris_demo",   display_name: "Iris Williams",    color: "#0F00E3" },
    { username: "jack_demo",   display_name: "Jack Anderson",    color: "#E30D00" },
  ];

  const profileIds: Record<string, string> = {};
  for (const u of demoUsers) {
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: `${u.username}@demo.test`,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (!authUser?.user) continue;
    await supabase.from("profiles").insert({
      id: authUser.user.id,
      username: u.username,
      display_name: u.display_name,
      avatar_color: u.color,
      is_moderator: false,
    });
    profileIds[u.username] = authUser.user.id;
  }

  // Books
  const { data: insertedBooks } = await supabase.from("books").insert([
    { title: "The Giver",                              author: "Lois Lowry" },
    { title: "Charlotte's Web",                        author: "E.B. White" },
    { title: "Matilda",                                author: "Roald Dahl" },
    { title: "Percy Jackson & the Lightning Thief",    author: "Rick Riordan" },
    { title: "Harry Potter and the Sorcerer's Stone",  author: "J.K. Rowling" },
    { title: "Wonder",                                 author: "R.J. Palacio" },
    { title: "Hatchet",                                author: "Gary Paulsen" },
  ]).select("id, title");

  const B: Record<string, string> = {};
  for (const b of insertedBooks ?? []) B[b.title] = b.id;

  // Reading entries
  const { data: entries } = await supabase.from("reading_entries").insert([
    // Alice
    { user_id: profileIds["alice_demo"],  book_id: B["The Giver"],                             status: "finished",     entry_type: "book", time_read_minutes: 240, note: "Such a beautiful and haunting book. The ending left me speechless.",                          created_at: daysAgo(14) },
    { user_id: profileIds["alice_demo"],  book_id: B["Wonder"],                                status: "reading",      entry_type: "book", time_read_minutes:  90, note: "Can't put it down! August is such an inspiring character.",                                  created_at: daysAgo(3)  },
    // Bob
    { user_id: profileIds["bob_demo"],    book_id: B["Percy Jackson & the Lightning Thief"],   status: "finished",     entry_type: "book", time_read_minutes: 300, note: "My kids and I read this together — everyone loved it!",                                      created_at: daysAgo(11) },
    { user_id: profileIds["bob_demo"],    book_id: B["Hatchet"],                               status: "want_to_read", entry_type: "book", time_read_minutes:   0, note: null,                                                                                          created_at: daysAgo(7)  },
    // Carlos
    { user_id: profileIds["carlos_demo"], book_id: B["Matilda"],                               status: "finished",     entry_type: "book", time_read_minutes: 180, note: "Roald Dahl is a genius. This book made me want to visit a library immediately.",             created_at: daysAgo(9)  },
    { user_id: profileIds["carlos_demo"], book_id: B["Harry Potter and the Sorcerer's Stone"], status: "reading",      entry_type: "book", time_read_minutes: 120, note: "Re-reading this as an adult hits different. The world-building is incredible.",              created_at: daysAgo(2)  },
    // Diana
    { user_id: profileIds["diana_demo"],  book_id: B["Charlotte's Web"],                       status: "finished",     entry_type: "book", time_read_minutes: 150, note: "I cried at the end (again). A timeless classic.",                                            created_at: daysAgo(12) },
    { user_id: profileIds["diana_demo"],  book_id: B["Wonder"],                                status: "finished",     entry_type: "book", time_read_minutes: 280, note: "This book changed how I think about kindness. Required reading for everyone.",               created_at: daysAgo(5)  },
    // Elena
    { user_id: profileIds["elena_demo"],  book_id: B["The Giver"],                             status: "reading",      entry_type: "book", time_read_minutes: 100, note: "Only halfway through but already deeply unsettled in the best way.",                         created_at: daysAgo(4)  },
    // Frank
    { user_id: profileIds["frank_demo"],  book_id: B["Hatchet"],                               status: "finished",     entry_type: "book", time_read_minutes: 200, note: "Brian's survival story kept me on the edge of my seat the whole time.",                      created_at: daysAgo(8)  },
    { user_id: profileIds["frank_demo"],  book_id: B["Percy Jackson & the Lightning Thief"],   status: "want_to_read", entry_type: "book", time_read_minutes:   0, note: null,                                                                                          created_at: daysAgo(6)  },
    // Grace
    { user_id: profileIds["grace_demo"],  book_id: B["Matilda"],                               status: "want_to_read", entry_type: "book", time_read_minutes:   0, note: "My daughter keeps recommending this to me!",                                                  created_at: daysAgo(10) },
    { user_id: profileIds["grace_demo"],  book_id: B["Charlotte's Web"],                       status: "reading",      entry_type: "book", time_read_minutes:  60, note: "Reading this to my kids at bedtime. They're obsessed.",                                       created_at: daysAgo(1)  },
    // Henry
    { user_id: profileIds["henry_demo"],  book_id: B["Harry Potter and the Sorcerer's Stone"], status: "finished",     entry_type: "book", time_read_minutes: 350, note: "The magic never gets old no matter how many times you read it.",                              created_at: daysAgo(13) },
    // Iris
    { user_id: profileIds["iris_demo"],   book_id: B["Wonder"],                                status: "want_to_read", entry_type: "book", time_read_minutes:   0, note: null,                                                                                          created_at: daysAgo(6)  },
    { user_id: profileIds["iris_demo"],   book_id: B["The Giver"],                             status: "finished",     entry_type: "book", time_read_minutes: 220, note: "I read this in one sitting. Absolutely riveting.",                                            created_at: daysAgo(15) },
    // Jack
    { user_id: profileIds["jack_demo"],   book_id: B["Hatchet"],                               status: "reading",      entry_type: "book", time_read_minutes:  80, note: "This is giving me major camping vibes. Perfect summer read.",                                 created_at: daysAgo(2)  },
    { user_id: profileIds["jack_demo"],   book_id: B["Percy Jackson & the Lightning Thief"],   status: "finished",     entry_type: "book", time_read_minutes: 260, note: "The action never stops! Already starting book 2.",                                            created_at: daysAgo(10) },
  ]).select("id, book_id, user_id");

  const E = entries ?? [];

  function findEntry(username: string, title: string) {
    return E.find(e => e.user_id === profileIds[username] && e.book_id === B[title]);
  }

  // Comments
  const giverAlice   = findEntry("alice_demo", "The Giver");
  const percyBob     = findEntry("bob_demo", "Percy Jackson & the Lightning Thief");
  const wonderDiana  = findEntry("diana_demo", "Wonder");
  const hatchetFrank = findEntry("frank_demo", "Hatchet");
  const hpHenry      = findEntry("henry_demo", "Harry Potter and the Sorcerer's Stone");

  if (giverAlice) {
    const { data: c1 } = await supabase.from("comments").insert([
      { entry_id: giverAlice.id, user_id: profileIds["bob_demo"],   content: "The ending is so ambiguous — I love it!",                         created_at: daysAgo(13) },
      { entry_id: giverAlice.id, user_id: profileIds["diana_demo"], content: "One of my all-time favorites. Did you read the sequels?",          created_at: daysAgo(12) },
      { entry_id: giverAlice.id, user_id: profileIds["elena_demo"], content: "Adding this to my re-read list after seeing your note!",           created_at: daysAgo(11) },
    ]).select("id");
    // Reply
    if (c1?.[1]) {
      await supabase.from("comments").insert({
        entry_id: giverAlice.id,
        user_id: profileIds["alice_demo"],
        content: "Yes! Gathering Blue is amazing too.",
        parent_comment_id: c1[1].id,
        created_at: daysAgo(11, 2),
      });
    }
  }

  if (percyBob) {
    await supabase.from("comments").insert([
      { entry_id: percyBob.id, user_id: profileIds["alice_demo"], content: "Reading with kids is the best! Which character was their favorite?", created_at: daysAgo(10) },
      { entry_id: percyBob.id, user_id: profileIds["jack_demo"],  content: "Grover is underrated honestly",                                     created_at: daysAgo(9)  },
      { entry_id: percyBob.id, user_id: profileIds["grace_demo"], content: "The whole series is wonderful — don't stop at book 1!",             created_at: daysAgo(8)  },
    ]);
  }

  if (wonderDiana) {
    await supabase.from("comments").insert([
      { entry_id: wonderDiana.id, user_id: profileIds["alice_demo"],  content: "YES! I'm reading this right now and feel the same way!",         created_at: daysAgo(4) },
      { entry_id: wonderDiana.id, user_id: profileIds["henry_demo"],  content: "This book belongs in every school curriculum.",                  created_at: daysAgo(3) },
      { entry_id: wonderDiana.id, user_id: profileIds["carlos_demo"], content: "The multiple perspectives make it so rich.",                     created_at: daysAgo(2) },
    ]);
  }

  if (hatchetFrank) {
    await supabase.from("comments").insert([
      { entry_id: hatchetFrank.id, user_id: profileIds["bob_demo"],   content: "The chapter where he finds the lake is peak survival fiction.",  created_at: daysAgo(7) },
      { entry_id: hatchetFrank.id, user_id: profileIds["jack_demo"],  content: "Makes me want to go camping and also absolutely not go camping", created_at: daysAgo(6) },
    ]);
  }

  if (hpHenry) {
    await supabase.from("comments").insert([
      { entry_id: hpHenry.id, user_id: profileIds["iris_demo"],   content: "How many times have you read it now? 😄",               created_at: daysAgo(12) },
      { entry_id: hpHenry.id, user_id: profileIds["grace_demo"],  content: "The Sorting Hat chapter still gets me every single time", created_at: daysAgo(11) },
    ]);
  }

  // Time logs
  const tlInserts = [];
  if (giverAlice)  tlInserts.push({ user_id: profileIds["alice_demo"],  entry_id: giverAlice.id,  book_id: B["The Giver"],                             minutes_added: 60,  note: "Morning reading session",  created_at: daysAgo(16) });
  if (percyBob)    tlInserts.push({ user_id: profileIds["bob_demo"],    entry_id: percyBob.id,    book_id: B["Percy Jackson & the Lightning Thief"],   minutes_added: 45,  note: "Bedtime reading with kids", created_at: daysAgo(12) });
  if (hpHenry)     tlInserts.push({ user_id: profileIds["henry_demo"],  entry_id: hpHenry.id,     book_id: B["Harry Potter and the Sorcerer's Stone"], minutes_added: 120, note: "Weekend marathon session",  created_at: daysAgo(14) });
  if (hatchetFrank)tlInserts.push({ user_id: profileIds["frank_demo"],  entry_id: hatchetFrank.id, book_id: B["Hatchet"],                              minutes_added: 75,  note: "Lunch break read",          created_at: daysAgo(9)  });

  if (tlInserts.length) await supabase.from("time_logs").insert(tlInserts);

  return new Response(
    JSON.stringify({
      message: "Demo data seeded!",
      credentials: demoUsers.map(u => ({ email: `${u.username}@demo.test`, password: DEMO_PASSWORD, display_name: u.display_name })),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
