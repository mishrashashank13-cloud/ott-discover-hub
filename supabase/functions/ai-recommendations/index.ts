/**
 * AI Recommendations Edge Function
 * --------------------------------
 * WHAT IT DOES (in plain words):
 *   It looks at everything BingeGuide knows about the signed-in user
 *   (preferred languages, preferred genres, the titles they liked, the titles
 *   they disliked, what they browsed recently, and the "classics" catalogue we
 *   use to understand taste) and asks an AI model:
 *      "Given this person's taste, which OTT titles should we suggest next?"
 *
 *   The AI answers with a short list of title names. The browser then looks up
 *   each name on TMDB (through the existing tmdb-proxy) to get posters, ids and
 *   ratings, so the cards look exactly like every other ribbon on the site.
 *
 * WHY AN EDGE FUNCTION:
 *   The AI key (LOVABLE_API_KEY) must never reach the browser. It lives here.
 *
 * COST CONTROL:
 *   The answer is cached per user in `ai_recommendation_cache` for 12 hours.
 *   The cache also stores a "signature" of the user's taste data — if the user
 *   likes/dislikes something new, the signature changes and we ask the AI again.
 */

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// The AI model we use. Fast, cheap and good enough for taste matching.
const AI_MODEL = 'google/gemini-3.6-flash';
const AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

/** One suggestion coming back from the AI model. */
interface Suggestion {
  title: string;
  year: number | null;
  type: 'movie' | 'tv';
  reason: string;
}

/** Small helper: keeps only clean, sane strings (protects the prompt). */
const clean = (value: unknown, maxLength = 120): string =>
  String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip control characters
    .trim()
    .slice(0, maxLength);

/** Turns a list of rows into a short, readable line for the prompt. */
const titleList = (rows: Array<{ content_title: string | null }>, max: number): string => {
  const names = rows
    .map((row) => clean(row.content_title))
    .filter(Boolean)
    .slice(0, max);
  return names.length ? names.join(', ') : 'none yet';
};

/** Builds a short fingerprint of the taste data so we know when to refresh. */
async function buildSignature(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/**
 * Reads the AI reply and pulls out the suggestion array, whatever wrapper the
 * model decided to use. Never throws — returns an empty list if unreadable.
 */
function parseSuggestions(raw: string): Suggestion[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    // Some models wrap JSON in prose or markdown fences — grab the first
    // {...} or [...] block and try again.
    const match = raw.match(/[\[{][\s\S]*[\]}]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch (_error2) {
      return [];
    }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
      : [];

  return list
    .map((item: any): Suggestion => ({
      title: clean(item?.title),
      year: Number.isFinite(Number(item?.year)) ? Number(item.year) : null,
      // Models sometimes answer "series" or "show" instead of "tv".
      type: /^(tv|series|show|web series)$/i.test(String(item?.type ?? '').trim())
        ? 'tv'
        : 'movie',
      reason: clean(item?.reason, 160),
    }))
    .filter((item: Suggestion) => item.title.length > 0)
    .slice(0, 20);
}

Deno.serve(async (req) => {
  // Browsers send a pre-flight OPTIONS request before the real one.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const aiKey = Deno.env.get('LOVABLE_API_KEY') ?? '';

    if (!aiKey) return json({ error: 'AI is not configured' }, 500);

    // ---------------------------------------------------------------------
    // 1. Identify the caller. Recommendations are personal, so we require a
    //    signed-in user (the browser sends its session token automatically).
    // ---------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Sign in to get AI recommendations' }, 401);

    // Admin client: used only to write the cache row.
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ---------------------------------------------------------------------
    // 2. Collect the user's taste context (all reads are scoped to this user).
    // ---------------------------------------------------------------------
    const [profileRes, prefsRes, historyRes, classicsRes] = await Promise.all([
      userClient
        .from('profiles')
        .select('language_preferences, genre_preferences')
        .eq('user_id', user.id)
        .maybeSingle(),
      userClient
        .from('user_preferences')
        .select('content_title, content_type, reaction')
        .eq('user_id', user.id)
        .limit(200),
      userClient
        .from('browsing_history')
        .select('content_title, content_type, viewed_at')
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false })
        .limit(40),
      userClient
        .from('taste_classics')
        .select('title, genre, language')
        .limit(30),
    ]);

    const profile = profileRes.data;
    const preferences = prefsRes.data ?? [];
    const history = historyRes.data ?? [];
    const classics = classicsRes.data ?? [];

    const liked = preferences.filter((p) => p.reaction === 'like');
    const disliked = preferences.filter((p) => p.reaction === 'dislike');

    // Ranked language / genre preferences stored on the profile.
    const languages = ((profile?.language_preferences as any[]) ?? [])
      .slice()
      .sort((a, b) => (a?.rank ?? 99) - (b?.rank ?? 99))
      .map((l) => clean(l?.name, 40))
      .filter(Boolean);
    const genres = ((profile?.genre_preferences as any[]) ?? [])
      .slice()
      .sort((a, b) => (a?.rank ?? 99) - (b?.rank ?? 99))
      .map((g) => clean(g?.name, 40))
      .filter(Boolean);

    // If we know nothing about the user there is nothing to personalise.
    const hasSignal =
      languages.length > 0 || genres.length > 0 || liked.length > 0 || history.length > 0;
    if (!hasSignal) {
      return json({ recommendations: [], cached: false, reason: 'not-enough-signal' });
    }

    // The exact context text handed to the AI. Also used as the cache key.
    const contextText = [
      `Preferred languages (best first): ${languages.join(', ') || 'not set'}`,
      `Preferred genres (best first): ${genres.join(', ') || 'not set'}`,
      `Titles the user LIKED: ${titleList(liked, 25)}`,
      `Titles the user DISLIKED: ${titleList(disliked, 25)}`,
      `Recently browsed titles: ${titleList(history, 25)}`,
      `Classic titles in our catalogue for taste reference: ${classics
        .map((c) => `${clean(c.title, 60)} (${clean(c.genre, 30)}/${clean(c.language, 20)})`)
        .slice(0, 20)
        .join('; ') || 'none'}`,
    ].join('\n');

    const signature = await buildSignature(contextText);

    // ---------------------------------------------------------------------
    // 3. Serve from cache when the taste data has not changed.
    // ---------------------------------------------------------------------
    const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1';
    if (!forceRefresh) {
      const { data: cached } = await userClient
        .from('ai_recommendation_cache')
        .select('recommendations, signature, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        cached &&
        cached.signature === signature &&
        new Date(cached.expires_at).getTime() > Date.now()
      ) {
        return json({ recommendations: cached.recommendations, cached: true });
      }
    }

    // ---------------------------------------------------------------------
    // 4. Ask the AI model for fresh suggestions.
    // ---------------------------------------------------------------------
    const systemPrompt = [
      'You are the recommendation engine of BingeGuide, an OTT (streaming) discovery app for viewers in India.',
      'Recommend only movies or web series that are available on mainstream OTT platforms in India',
      '(Netflix, Amazon Prime Video, JioHotstar, Zee5, SonyLIV, Apple TV+, MX Player, Crunchyroll).',
      'Never recommend a title the user already liked, disliked or recently browsed.',
      'Respect the preferred languages and genres, but include a couple of tasteful surprises.',
      'Answer with JSON only, using this exact shape:',
      '{"recommendations":[{"title":"...","year":2019,"type":"movie","reason":"one short sentence"}]}',
      'Return exactly 12 items. "type" must be "movie" or "tv". Use the original release year.',
    ].join(' ');

    const aiResponse = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': aiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the viewer's taste profile:\n${contextText}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      // 429 = too many requests, 402 = workspace out of AI credits. Both are
      // surfaced to the UI so it can show a helpful message.
      if (aiResponse.status === 429) {
        return json({ error: 'AI is busy right now. Please try again in a minute.' }, 429);
      }
      if (aiResponse.status === 402) {
        return json({ error: 'AI credits exhausted. Please add credits to continue.' }, 402);
      }
      console.error('AI gateway error', aiResponse.status, detail.slice(0, 300));
      return json({ error: 'Could not generate recommendations right now.' }, 502);
    }

    const aiJson = await aiResponse.json();
    const suggestions = parseSuggestions(aiJson?.choices?.[0]?.message?.content ?? '');

    if (suggestions.length === 0) {
      return json({ recommendations: [], cached: false, reason: 'empty-answer' });
    }

    // ---------------------------------------------------------------------
    // 5. Store in the cache (12 hours) and return.
    // ---------------------------------------------------------------------
    await adminClient.from('ai_recommendation_cache').upsert(
      {
        user_id: user.id,
        signature,
        recommendations: suggestions,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return json({ recommendations: suggestions, cached: false });
  } catch (error) {
    console.error('ai-recommendations failed', error);
    return json({ error: 'Could not generate recommendations right now.' }, 500);
  }
});
