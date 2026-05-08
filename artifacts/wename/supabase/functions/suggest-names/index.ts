// Supabase Edge Function: suggest-names
//
// Required secrets (set via `supabase secrets set`):
//   OPENAI_API_KEY  — must be set manually
//
// Required env vars (auto-provided by Supabase):
//   SUPABASE_URL               — project URL

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonError(msg: string, status = 500): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Cache key ────────────────────────────────────────────────────────────────
async function sha256Short(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

// ── Static fallback names ─────────────────────────────────────────────────────
// Served when OpenAI is unavailable so the tab is never completely empty.
interface FallbackName {
  name: string;
  meaning: string;
  reason: string;
}
const FALLBACK: Record<"boy" | "girl", Record<"classic" | "modern" | "unique", FallbackName[]>> = {
  boy: {
    classic: [
      { name: "William", meaning: "Germanic origin meaning 'resolute protector'.", reason: "A strong, timeless choice with royal heritage." },
      { name: "James", meaning: "Hebrew origin meaning 'supplanter', a classic apostle's name.", reason: "Elegant and enduring, beloved across centuries." },
      { name: "Henry", meaning: "Germanic origin meaning 'ruler of the home'.", reason: "Regal and classic, never feels dated." },
      { name: "Arthur", meaning: "Celtic origin, possibly meaning 'bear' or 'noble'.", reason: "Timeless and storied with legendary charm." },
      { name: "George", meaning: "Greek origin meaning 'farmer' or 'earth-worker'.", reason: "Solidly classic with quiet dignity." },
      { name: "Charles", meaning: "Germanic origin meaning 'free man'.", reason: "Distinguished with centuries of history." },
      { name: "Thomas", meaning: "Aramaic origin meaning 'twin'.", reason: "Dependably classic with gentle strength." },
      { name: "Edward", meaning: "Old English meaning 'wealthy guardian'.", reason: "A noble classic that wears well through time." },
      { name: "Frederick", meaning: "Germanic meaning 'peaceful ruler'.", reason: "Stately, with the warm nickname Freddie." },
      { name: "Edmund", meaning: "Old English meaning 'fortunate protector'.", reason: "Underused yet unmistakably classic." },
    ],
    modern: [
      { name: "Liam", meaning: "Irish form of William, meaning 'strong-willed warrior'.", reason: "Crisp and modern with enduring warmth." },
      { name: "Noah", meaning: "Hebrew origin meaning 'rest' or 'comfort'.", reason: "Gentle yet strong — a modern staple." },
      { name: "Elijah", meaning: "Hebrew origin meaning 'my God is Yahweh'.", reason: "Lyrical and contemporary with spiritual depth." },
      { name: "Mason", meaning: "English occupational name for a stonemason.", reason: "Modern and grounded with an artisan feel." },
      { name: "Logan", meaning: "Scottish origin meaning 'little hollow'.", reason: "Cool and current with easy-going style." },
      { name: "Lucas", meaning: "Greek and Latin origin meaning 'light'.", reason: "Sleek and modern with timeless roots." },
      { name: "Ethan", meaning: "Hebrew origin meaning 'strong' or 'firm'.", reason: "Solid and fresh-feeling at once." },
      { name: "Carter", meaning: "English occupational name for a cart driver.", reason: "Confident and modern with strong sounds." },
      { name: "Wyatt", meaning: "English origin meaning 'brave in war'.", reason: "Bold and current with a frontier spirit." },
      { name: "Finn", meaning: "Irish origin meaning 'fair' or 'white'.", reason: "Short, bright, and effortlessly appealing." },
    ],
    unique: [
      { name: "Caspian", meaning: "Named after the Caspian Sea, of uncertain ancient origin.", reason: "Rare and adventurous with literary magic." },
      { name: "Soren", meaning: "Scandinavian origin meaning 'stern'.", reason: "Distinctive yet effortlessly wearable." },
      { name: "Leander", meaning: "Greek origin meaning 'lion man'.", reason: "Rare and romantic with classical roots." },
      { name: "Evander", meaning: "Scottish and Greek origin meaning 'good man'.", reason: "Uncommon with a heroic, mythological ring." },
      { name: "Idris", meaning: "Arabic and Welsh origin meaning 'ardent lord'.", reason: "Striking and rare with multicultural appeal." },
      { name: "Theron", meaning: "Greek origin meaning 'hunter'.", reason: "Powerful and rare — heard once, remembered." },
      { name: "Stellan", meaning: "Scandinavian origin, possibly meaning 'calm'.", reason: "Cool and rare with a celestial feel." },
      { name: "Caius", meaning: "Latin origin meaning 'rejoice', an ancient Roman name.", reason: "Brief, rare, and quietly striking." },
      { name: "Emrys", meaning: "Welsh origin meaning 'immortal', the wizard name of Merlin.", reason: "Mythical and deeply rare — truly one of a kind." },
      { name: "Raffael", meaning: "Hebrew origin meaning 'God has healed', an artistic variant.", reason: "Distinctive and creative with Renaissance flair." },
    ],
  },
  girl: {
    classic: [
      { name: "Eleanor", meaning: "Greek origin meaning 'bright, shining one'.", reason: "Elegant and timeless with effortless grace." },
      { name: "Margaret", meaning: "Greek origin meaning 'pearl'.", reason: "A classic that carries quiet, enduring beauty." },
      { name: "Catherine", meaning: "Greek origin meaning 'pure'.", reason: "Regal and classic with royal heritage." },
      { name: "Charlotte", meaning: "French feminine form of Charles, meaning 'free woman'.", reason: "Perfectly classic with a gentle, charming lilt." },
      { name: "Vivienne", meaning: "Latin origin meaning 'alive'.", reason: "Sophisticated and classic with French elegance." },
      { name: "Beatrice", meaning: "Latin origin meaning 'she who brings happiness'.", reason: "Literary and luminous — a Dante classic." },
      { name: "Rosalind", meaning: "Germanic origin meaning 'gentle horse', later linked to 'rose'.", reason: "Romantic and classic with Shakespearean charm." },
      { name: "Cecily", meaning: "Latin origin from the patron saint of music.", reason: "Refined and underused — quietly beautiful." },
      { name: "Harriet", meaning: "Germanic origin meaning 'ruler of the home'.", reason: "Strong and classic — literary, dignified, lovely." },
      { name: "Dorothea", meaning: "Greek origin meaning 'gift of God'.", reason: "Warm and classic — due for a graceful comeback." },
    ],
    modern: [
      { name: "Olivia", meaning: "Latin origin meaning 'olive tree', symbolising peace.", reason: "Graceful and modern with universal appeal." },
      { name: "Isla", meaning: "Scottish origin from the River Isla, meaning 'island'.", reason: "Soft and contemporary with natural beauty." },
      { name: "Luna", meaning: "Latin origin meaning 'moon'.", reason: "Dreamy and modern with celestial charm." },
      { name: "Willow", meaning: "English nature name from the graceful willow tree.", reason: "Gentle and current with a poetic feel." },
      { name: "Aria", meaning: "Italian origin meaning 'air' or 'song' in music.", reason: "Lyrical and fresh — melodic to say and hear." },
      { name: "Stella", meaning: "Latin origin meaning 'star'.", reason: "Bright and modern with timeless stellar beauty." },
      { name: "Aurora", meaning: "Latin origin meaning 'dawn'.", reason: "Radiant and contemporary with mythological warmth." },
      { name: "Hazel", meaning: "English nature name from the hazel tree.", reason: "Warm and modern with a soft vintage edge." },
      { name: "Freya", meaning: "Norse origin, the goddess of love and fertility.", reason: "Modern and mythological — strong and feminine." },
      { name: "Quinn", meaning: "Irish origin meaning 'wisdom' or 'chief'.", reason: "Crisp and current — confident and cool." },
    ],
    unique: [
      { name: "Seraphina", meaning: "Hebrew origin meaning 'fiery ones', an angelic name.", reason: "Luminous and rare with angelic grandeur." },
      { name: "Isolde", meaning: "Celtic origin possibly meaning 'ice ruler' or 'beautiful'.", reason: "Deeply rare with tragic romantic legend." },
      { name: "Elowen", meaning: "Cornish origin meaning 'elm tree'.", reason: "Rare and ethereal — whisper-soft and lovely." },
      { name: "Vesper", meaning: "Latin origin meaning 'evening star'.", reason: "Rare and atmospheric — quietly enchanting." },
      { name: "Calliope", meaning: "Greek origin meaning 'beautiful voice', the muse of epic poetry.", reason: "Rare and musical — bold, mythological, stunning." },
      { name: "Thessaly", meaning: "Greek origin from the ancient region of Thessaly.", reason: "Rare and geographic with a magical quality." },
      { name: "Celestine", meaning: "Latin origin meaning 'heavenly'.", reason: "Rare and celestial with old-world grace." },
      { name: "Ondine", meaning: "Latin origin from Undine, the spirit of water.", reason: "Rare and mythical — hauntingly beautiful." },
      { name: "Araminta", meaning: "Possibly Hebrew origin meaning 'lofty mountain'.", reason: "Victorian rare, whimsical, and wholly distinctive." },
      { name: "Marisol", meaning: "Spanish compound meaning 'sea and sun'.", reason: "Rare and radiant — warm, vivid, memorable." },
    ],
  },
};

function buildFallbackText(
  gender: string,
  style: string | null,
  excludeNames: string[],
): string {
  const gKey = gender === "girl" ? "girl" : "boy";
  const excludeSet = new Set(excludeNames.map((n) => n.toLowerCase()));

  let pool: FallbackName[];
  if (style === "classic" || style === "modern" || style === "unique") {
    pool = FALLBACK[gKey][style];
  } else {
    pool = [
      ...FALLBACK[gKey].classic.slice(0, 4),
      ...FALLBACK[gKey].modern.slice(0, 3),
      ...FALLBACK[gKey].unique.slice(0, 3),
    ];
  }

  const available = pool.filter((n) => !excludeSet.has(n.name.toLowerCase()));
  // If the exclude list has exhausted the pool, serve all names anyway so
  // the user always gets something rather than an empty screen.
  const selected = (available.length >= 4 ? available : pool).slice(0, 8);
  return selected
    .map((n) => JSON.stringify({ name: n.name, meaning: n.meaning, gender: gKey, reason: n.reason }))
    .join("\n") + "\n";
}

function plainResponse(text: string): Response {
  return new Response(text, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return jsonError("OpenAI API key not configured");
  }

  let body: {
    gender?: string;
    likedNames?: string[];
    matchedNames?: string[];
    partnerLikedNames?: string[];
    excludeNames?: string[];
    style?: string | null;
    lastName?: string;
    tuningPreferences?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const {
    gender = "boy",
    likedNames = [],
    matchedNames = [],
    partnerLikedNames = [],
    excludeNames: rawExclude = [],
    style = null,
    lastName = "",
    tuningPreferences: rawTuning = [],
  } = body;

  const excludeNames = rawExclude.slice(0, 50);

  // ── Tuning preferences ───────────────────────────────────────────────────
  // Free-form chip selections from the client. We map each known label to a
  // concrete prompt instruction; unknown labels are silently dropped.
  const TUNING_INSTRUCTIONS: Record<string, string> = {
    "Short names":
      "Prefer short names — ideally 1-2 syllables and no more than 5 letters.",
    "Easy to pronounce":
      "Choose names that are immediately intuitive to pronounce for English speakers — avoid ambiguous or counter-intuitive spellings.",
    "Rare but not weird":
      "Favour names that are uncommon and distinctive but still clearly recognisable as a real name — not bizarre or unwearable.",
    "Traditional":
      "Lean toward timeless, classical names with long histories across cultures.",
    "Modern":
      "Lean toward fresh, contemporary names that feel current and stylish.",
    "Spiritual":
      "Prefer names with spiritual, religious, or sacred origins from any tradition.",
    "Arabic origin":
      "Prioritise names with Arabic origin or strong Arabic heritage.",
    "Hebrew origin":
      "Prioritise names with Hebrew origin or strong Hebrew/Biblical heritage.",
    "Works in English/French":
      "Choose names that sound natural and are easy to use in both English and French-speaking contexts.",
    "Strong meaning":
      "Prioritise names with powerful, rich, or uplifting meanings — the meaning should feel significant.",
    "Soft sounding":
      "Prefer names with gentle, melodic phonetics — flowing vowels and soft consonants like L, M, N, R.",
  };
  const tuningPreferences = (Array.isArray(rawTuning) ? rawTuning : [])
    .filter((p): p is string => typeof p === "string" && p in TUNING_INSTRUCTIONS)
    .slice(0, 11);

  console.log("[suggest-names] request", {
    gender,
    style,
    likedCount: likedNames.length,
    matchedCount: matchedNames.length,
    partnerLikedCount: partnerLikedNames.length,
    excludeCount: excludeNames.length,
    tuningPreferences,
  });

  // ── Deno KV cache ─────────────────────────────────────────────────────────
  // Key: hash of the deterministic request fingerprint (taste + style, not
  // exclude list since that changes per-refresh but the taste profile doesn't).
  // TTL: 20 minutes — balances freshness with avoiding redundant OpenAI calls.
  const cacheFingerprint = JSON.stringify({
    g: gender,
    l: likedNames.slice(0, 15).slice().sort(),
    m: matchedNames.slice(0, 10).slice().sort(),
    p: partnerLikedNames.slice(0, 8).slice().sort(),
    s: style ?? null,
    ln: lastName ?? "",
    tp: tuningPreferences.slice().sort(),
  });
  const cacheKey = await sha256Short(cacheFingerprint);

  let kv: Deno.Kv | null = null;
  try {
    kv = await Deno.openKv();
  } catch {
    // KV unavailable in this environment — skip caching
  }

  if (kv) {
    try {
      const cached = await kv.get<string>(["sg", cacheKey]);
      if (cached.value) {
        // Filter out any names the user has already seen in this session
        const excludeSet = new Set(excludeNames.map((n) => n.toLowerCase()));
        const filtered = cached.value
          .split("\n")
          .filter((line) => {
            if (!line.trim()) return false;
            try {
              const obj = JSON.parse(line) as { name: string };
              return !excludeSet.has(obj.name.toLowerCase());
            } catch {
              return false;
            }
          })
          .join("\n") + "\n";

        // Only use the cache if at least 4 names survive the exclusion filter
        const count = filtered.split("\n").filter((l) => l.trim()).length;
        if (count >= 4) {
          return plainResponse(filtered);
        }
        // Otherwise fall through and fetch fresh results
      }
    } catch {
      // KV read error — continue to OpenAI
    }
  }

  // ── Taste context ────────────────────────────────────────────────────────
  let tasteContext: string;
  if (matchedNames.length > 0 && likedNames.length > 0) {
    const matched = matchedNames.slice(0, 10).join(", ");
    const liked = likedNames.slice(0, 12).join(", ");
    const partnerPart =
      partnerLikedNames.length > 0
        ? ` Their partner has also liked: ${partnerLikedNames.slice(0, 8).join(", ")}.`
        : "";
    tasteContext = `Both parents have agreed and matched on these names (highest priority for style): ${matched}. The user has personally liked: ${liked}.${partnerPart} Use all of these to understand the couple's shared taste.`;
  } else if (matchedNames.length > 0) {
    tasteContext = `Both parents matched on these names: ${matchedNames.slice(0, 10).join(", ")}. Suggest names with a very similar style and feel.`;
  } else if (likedNames.length > 0) {
    const liked = likedNames.slice(0, 15).join(", ");
    const partnerPart =
      partnerLikedNames.length > 0
        ? ` Their partner has liked: ${partnerLikedNames.slice(0, 8).join(", ")}.`
        : "";
    tasteContext = `The user has personally liked: ${liked}.${partnerPart} Suggest names with a similar style or feel.`;
  } else {
    tasteContext = "Suggest a variety of beautiful, timeless names.";
  }

  // ── Style context ────────────────────────────────────────────────────────
  const styleMap: Record<string, string> = {
    classic:
      "Focus on timeless, traditional names with long histories — think elegant and enduring.",
    modern:
      "Focus on fresh, contemporary names that feel current and stylish.",
    unique:
      "Focus on rare, distinctive names that stand out — uncommon but beautiful.",
  };
  const styleContext =
    style && styleMap[style] ? "\n" + styleMap[style] : "";

  // ── Last name context ────────────────────────────────────────────────────
  const lastNameContext = lastName
    ? `\nThe baby's last name will be '${lastName}'. Make sure the first names flow well with it.`
    : "";

  // ── Exclude context ──────────────────────────────────────────────────────
  const excludeContext =
    excludeNames.length > 0
      ? `\nIMPORTANT: Do NOT suggest any of these names (they have already been seen or swiped): ${excludeNames.join(", ")}.`
      : "";

  // ── Tuning preferences context ───────────────────────────────────────────
  const tuningContext =
    tuningPreferences.length > 0
      ? "\nUser preferences (apply each, but never below 8 results — relax constraints if they conflict):\n" +
        tuningPreferences
          .map((p) => `- ${TUNING_INSTRUCTIONS[p]}`)
          .join("\n")
      : "";

  // Request 8 names — enough for a good set, fewer tokens means faster response.
  const prompt = `You are a helpful baby name expert. Suggest 8 unique baby ${gender} names.
${tasteContext}${styleContext}${lastNameContext}${tuningContext}${excludeContext}

Always return exactly 8 names. If constraints conflict, relax the weakest ones to reach 8.

Return ONLY a JSON array of objects, nothing else. Each object must have:
- "name": the baby name (string)
- "meaning": a short 1-sentence meaning or origin (string)
- "gender": "${gender}" (string, always this exact value)
- "reason": a warm, personalized 1-sentence explanation of why this name suits the parents' taste (string)

Example format:
[{"name":"Aria","meaning":"Italian origin meaning 'air' or 'song'.","gender":"girl","reason":"Like Isla and Luna, Aria has a lyrical, melodic quality you seem to love."}]

Do not include markdown, code blocks, or any text outside the JSON array.`;

  // ── Call OpenAI with streaming + 25 s timeout ────────────────────────────
  const openaiController = new AbortController();
  const openaiTimeout = setTimeout(() => openaiController.abort(), 25_000);

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: openaiController.signal,
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1100,
        temperature: 0.75,
        stream: true,
      }),
    });
  } catch {
    clearTimeout(openaiTimeout);
    // OpenAI unreachable or timed out — return static fallback
    return plainResponse(buildFallbackText(gender, style, excludeNames));
  } finally {
    clearTimeout(openaiTimeout);
  }

  if (!openaiRes.ok) {
    return plainResponse(buildFallbackText(gender, style, excludeNames));
  }

  // ── Stream back parsed suggestion objects ────────────────────────────────
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = openaiRes.body!.getReader();
    const decoder = new TextDecoder();
    let jsonBuffer = "";
    // Accumulate the full output for caching after the stream ends.
    let cacheAccumulator = "";

    const flush = async () => {
      let i = 0;
      while (i < jsonBuffer.length) {
        if (jsonBuffer[i] !== "{") { i++; continue; }

        let depth = 0;
        let inString = false;
        let escaped = false;
        let j = i;
        let foundComplete = false;

        while (j < jsonBuffer.length) {
          const ch = jsonBuffer[j];
          if (escaped) { escaped = false; j++; continue; }
          if (ch === "\\" && inString) { escaped = true; j++; continue; }
          if (ch === '"') { inString = !inString; j++; continue; }
          if (!inString) {
            if (ch === "{") depth++;
            else if (ch === "}") {
              depth--;
              if (depth === 0) {
                const slice = jsonBuffer.slice(i, j + 1);
                try {
                  const obj = JSON.parse(slice);
                  if (obj.name && obj.gender) {
                    const line = JSON.stringify(obj) + "\n";
                    await writer.write(encoder.encode(line));
                    cacheAccumulator += line;
                  }
                } catch {
                  // invalid slice — skip
                }
                i = j + 1;
                foundComplete = true;
                break;
              }
            }
          }
          j++;
        }

        if (!foundComplete) break;
      }
      jsonBuffer = jsonBuffer.slice(i);
    };

    try {
      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break outer;
          try {
            const parsed = JSON.parse(data);
            const content: string =
              parsed.choices?.[0]?.delta?.content ?? "";
            if (content) {
              jsonBuffer += content;
              await flush();
            }
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }
    } finally {
      await writer.close();

      // Persist to KV cache (20-minute TTL) after the stream completes.
      if (kv && cacheAccumulator) {
        try {
          await kv.set(["sg", cacheKey], cacheAccumulator, {
            expireIn: 20 * 60 * 1000,
          });
        } catch {
          // Cache write failed — not critical
        }
      }
    }
  })();

  return new Response(readable, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
});
