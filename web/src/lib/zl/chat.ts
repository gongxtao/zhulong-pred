/* =====================================================================
   feat-023 ChatBI · /api/chat SSE 消费（纯回调，无 DOM 依赖，engine 命令式接线）
   QwenPaw 事件的 output 可能是累计快照或增量文本——startsWith 自适应两者。
   ===================================================================== */
export interface ChatCbs { onText(full: string): void; onStatus(s: 'thinking' | 'done' | 'error'): void }

export async function streamChat(text: string, sessionId: string, cbs: ChatCbs): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sessionId }),
    });
  } catch { cbs.onStatus('error'); return { ok: false, error: 'network' }; }
  if (!res.ok || !res.body) {
    let code = `http-${res.status}`;
    try { code = (await res.json()).error || code; } catch { /* keep http code */ }
    cbs.onStatus('error'); return { ok: false, error: code };
  }
  cbs.onStatus('thinking');
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '', acc = ''; /* acc=已积累文本；事件文本若是快照（startsWith acc）则替换，否则追加 */
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev: {
        status?: string; error?: { message?: string };
        output?: { role?: string; content?: { type?: string; text?: string }[] }[];
      };
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }
      if (ev.error) { cbs.onStatus('error'); return { ok: false, error: ev.error.message || 'agent-error' }; }
      const t = (ev.output ?? []).filter(o => o.role === 'assistant')
        .flatMap(o => o.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('');
      if (t) { acc = t.startsWith(acc) ? t : acc + t; cbs.onText(acc); }
      if (ev.status === 'completed') { cbs.onStatus('done'); return { ok: true }; }
      if (ev.status === 'failed') { cbs.onStatus('error'); return { ok: false, error: 'agent-failed' }; }
    }
  }
  cbs.onStatus(acc ? 'done' : 'error');
  return { ok: !!acc, error: acc ? undefined : 'stream-end' };
}
