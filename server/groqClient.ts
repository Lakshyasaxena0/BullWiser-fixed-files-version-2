// ─────────────────────────────────────────────────────────────────────────────
// groqClient.ts
// The ONLY external AI provider: Groq (llama-3.3-70b-versatile).
// Plain fetch — no OpenAI SDK/key involved. Returns null when Groq is not
// usable (no key, bad key, rate limit, timeout, garbage output) so callers can
// fall back to the built-in statistics + astrology engine.
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 20_000;

/** Accepts the existing Render var name (Groq_API_key) or the conventional GROQ_API_KEY. */
export function getGroqKey(): string {
  return (process.env.Groq_API_key || process.env.GROQ_API_KEY || '').trim();
}

export function isGroqConfigured(): boolean {
  return getGroqKey().length > 0;
}

export async function groqJSON(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 900
): Promise<any | null> {
  const key = getGroqKey();
  if (!key) return null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return valid JSON only. No markdown, no code fences.' },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: maxTokens,
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return JSON.parse(text);
        return null;
      }
      // Bad key / forbidden: retrying is pointless
      if (res.status === 401 || res.status === 403) {
        console.error(`[AI] Groq rejected the API key (${res.status}) — using built-in engine`);
        return null;
      }
      console.error(`[AI] Groq error ${res.status} (attempt ${attempt})`);
      if (res.status !== 429 && res.status < 500) return null;
    } catch (err: any) {
      console.error(`[AI] Groq call failed (attempt ${attempt}):`, err?.name === 'AbortError' ? 'timeout' : err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
