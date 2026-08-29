/* =====================================================================
   feat-023 ChatBI · QwenPaw 代理路由
   POST {text, sessionId} → SSE 透传 QwenPaw /api/console/chat 响应流。
   密钥纪律：QWENPAW_URL / QWENPAW_AGENT_ID / QWENPAW_TOKEN 只经环境变量，绝不入仓。
   ===================================================================== */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_MAX = 20, RATE_WIN = 60_000, MAX_LEN = 500, TIMEOUT_MS = 180_000;
const hits = new Map<string, number[]>(); /* 实例内内存限流，演示级足够 */

function limited(ip: string): boolean {
  const now = Date.now();
  const a = (hits.get(ip) ?? []).filter(t => now - t < RATE_WIN);
  a.push(now);
  hits.set(ip, a);
  return a.length > RATE_MAX;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  let body: { text?: unknown; sessionId?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: 'bad-request' }, { status: 400 }); }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : '';
  if (!text || text.length > MAX_LEN || !sessionId) return Response.json({ error: 'bad-request' }, { status: 400 });
  if (limited(ip)) return Response.json({ error: 'rate-limited' }, { status: 429 });

  const base = process.env.QWENPAW_URL;
  if (!base) return Response.json({ error: 'agent-unreachable' }, { status: 503 });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const up = await fetch(`${base.replace(/\/$/, '')}/api/console/chat`, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': process.env.QWENPAW_AGENT_ID || 'default',
        ...(process.env.QWENPAW_TOKEN ? { Authorization: `Bearer ${process.env.QWENPAW_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        input: [{ role: 'user', content: [{ type: 'text', text }] }],
        session_id: sessionId, user_id: 'zhulong-web', channel: 'console',
      }),
    });
    if (!up.ok || !up.body) return Response.json({ error: 'agent-error' }, { status: 502 });
    return new Response(up.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    return Response.json({ error: timedOut ? 'agent-timeout' : 'agent-error' }, { status: timedOut ? 504 : 502 });
  } finally { clearTimeout(timer); }
}
