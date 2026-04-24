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
    excludeNames = [],
    style = null,
    lastName = "",
  } = body;

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

  const prompt = `You are a helpful baby name expert. Suggest 12 unique baby ${gender} names.
${tasteContext}${styleContext}${lastNameContext}${excludeContext}

Return ONLY a JSON array of objects, nothing else. Each object must have:
- "name": the baby name (string)
- "meaning": a short 1-sentence meaning or origin (string)
- "gender": "${gender}" (string, always this exact value)
- "reason": a warm, personalized 1-sentence explanation of why this name suits the parents' taste (string)

Example format:
[{"name":"Aria","meaning":"Italian origin meaning 'air' or 'song'.","gender":"girl","reason":"Like Isla and Luna, Aria has a lyrical, melodic quality you seem to love."}]

Do not include markdown, code blocks, or any text outside the JSON array.`;

  // ── Call OpenAI with streaming ───────────────────────────────────────────
  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1800,
        temperature: 0.8,
        stream: true,
      }),
    });
  } catch (e) {
    return jsonError(String(e));
  }

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return new Response(
      JSON.stringify({
        error: `OpenAI error: ${openaiRes.status}`,
        detail: errText,
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  // ── Stream back parsed suggestion objects ────────────────────────────────
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = openaiRes.body!.getReader();
    const decoder = new TextDecoder();
    let jsonBuffer = "";

    const flush = async () => {
      let i = 0;
      while (i < jsonBuffer.length) {
        // Skip until we find the start of a JSON object
        if (jsonBuffer[i] !== "{") { i++; continue; }

        // Walk forward tracking depth, respecting string boundaries
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
                // Complete object found
                const slice = jsonBuffer.slice(i, j + 1);
                try {
                  const obj = JSON.parse(slice);
                  if (obj.name && obj.gender) {
                    await writer.write(encoder.encode(JSON.stringify(obj) + "\n"));
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

        // If we didn't finish a complete object the buffer is incomplete — stop
        if (!foundComplete) break;
      }
      // Trim everything we've already processed
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
