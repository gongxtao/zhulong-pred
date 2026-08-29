/* =====================================================================
   feat-023 ChatBI · /api/chat SSE 消费（纯回调，无 DOM 依赖，engine 命令式接线）
   QwenPaw 真实协议（2026-08-29 实测抓包，与官方文档有出入）：
   - object:"message"（type:"reasoning"|"message"，带 id）= 消息帧，先于其增量到达
   - {type:"text",delta:true,msg_id,text} = token 级增量；delta:false = 该消息快照
   - object:"response" status:"completed" 的 output[] = 权威全文（type:"message" 才是答案）
   兼容官方文档的 output 快照格式作为回退路径。
   ===================================================================== */
export interface ChatCbs {
  onText(full: string): void
  onThink(full: string): void /* 思考流（reasoning 累计），供 UI 展示"没卡住" */
  onAct(label: string): void /* 工具调用提示（plugin_call → 中文动作标签） */
  onStatus(s: 'thinking' | 'done' | 'error'): void
}

/* 工具名/参数 → 用户可读动作标签 */
function actLabel(name: string, args: string): string {
  const n = (name || '').toLowerCase(), a = args || '';
  if (n.includes('skill')) return '载入分析技能' + (a.includes('zhulong') ? ' zhulong_analysis' : '');
  if (n.includes('exec') || n.includes('python') || n.includes('bash') || n.includes('shell') || n.includes('command'))
    return '执行代码' + (a.includes('supabase') || a.includes('http') ? ' · 查询生产库…' : '分析…');
  if (n.includes('read') || n.includes('file')) return '读取文件';
  if (n.includes('search') || n.includes('browser') || n.includes('web')) return '联网查询';
  return `调用工具 ${name}`;
}

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
  let buf = '';
  const msgText = new Map<string, string>(); /* msg_id → 已积累文本 */
  const msgKind = new Map<string, string>(); /* msg_id → 'reasoning' | 'message' */
  const callState = new Map<string, { name: string; args: string }>(); /* msg_id → 工具调用累计 */
  let acc = ''; /* 答案文本（type:"message" 串接） */
  let thinkAcc = ''; /* 思考文本（type:"reasoning" 串接） */

  const emit = () => {
    const parts: string[] = [], thinks: string[] = [];
    for (const [id, kind] of msgKind) {
      const t = msgText.get(id);
      if (!t) continue;
      (kind === 'message' ? parts : thinks).push(t);
    }
    const full = parts.join('\n'), th = thinks.join('\n');
    if (th && th !== thinkAcc) { thinkAcc = th; cbs.onThink(thinkAcc); }
    if (full) { acc = full; cbs.onText(acc); }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev: Record<string, unknown>;
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }
      /* 错误帧（两种位置：顶层 error 或 response 帧 error 字段） */
      const errObj = ev.error as { message?: string } | undefined;
      if (errObj) { cbs.onStatus('error'); return { ok: false, error: errObj.message || 'agent-error' }; }
      const status = ev.status as string | undefined;
      const obj = ev.object as string | undefined;

      if (obj === 'message' && typeof ev.id === 'string') {
        /* 消息帧：登记类型；status:completed 时带全文快照，直接对齐 */
        msgKind.set(ev.id, (ev.type as string) || 'message');
        const content = ev.content as { text?: string; data?: { name?: string; arguments?: string } }[] | undefined;
        if (Array.isArray(content)) {
          const full = content.map(c => c.text ?? '').join('');
          if (full) msgText.set(ev.id, full);
          /* plugin_call 完成帧：工具名+完整参数快照 */
          for (const c of content) {
            if (c.data?.name) {
              const st = callState.get(ev.id) ?? { name: '', args: '' };
              st.name = c.data.name; if (c.data.arguments) st.args = c.data.arguments;
              callState.set(ev.id, st);
              cbs.onAct(`第 ${callState.size} 步 · ${actLabel(st.name, st.args)}`);
            }
          }
        }
        emit();
      } else if (ev.type === 'text' && typeof ev.msg_id === 'string') {
        /* 增量/快照文本帧 */
        const delta = ev.delta === true, t = (ev.text as string) || '';
        const cur = msgText.get(ev.msg_id) ?? '';
        msgText.set(ev.msg_id, delta ? cur + t : (t || cur));
        emit(); /* message → 答案流；reasoning → 思考流 */
      } else if (ev.type === 'data' && typeof ev.msg_id === 'string' && ev.data && typeof ev.data === 'object') {
        /* 工具调用增量帧（plugin_call 参数流式拼装） */
        const d = ev.data as { name?: string; arguments?: string };
        const st = callState.get(ev.msg_id) ?? { name: '', args: '' };
        if (d.name) st.name = d.name;
        if (d.arguments) st.args += d.arguments;
        callState.set(ev.msg_id, st);
        cbs.onAct(`第 ${callState.size} 步 · ${actLabel(st.name, st.args)}`);
      } else if (obj === 'response') {
        if (status === 'completed') {
          /* 权威终值：output[] 中 type:"message" 的全文 */
          const output = ev.output as { type?: string; content?: { text?: string }[] }[] | undefined;
          if (Array.isArray(output)) {
            const full = output.filter(o => o.type === 'message')
              .flatMap(o => o.content ?? []).map(c => c.text ?? '').join('');
            if (full) { acc = full; cbs.onText(acc); }
          }
          cbs.onStatus('done'); return { ok: !!acc || !!msgText.size };
        }
        if (status === 'failed') { cbs.onStatus('error'); return { ok: false, error: 'agent-failed' }; }
        /* 文档格式的 in_progress 快照（回退路径）：output[].content[].text 且带 role */
        const output = ev.output as { role?: string; content?: { type?: string; text?: string }[] }[] | undefined;
        if (Array.isArray(output)) {
          const t = output.filter(o => o.role === 'assistant')
            .flatMap(o => o.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('');
          if (t && !acc) { acc = t; cbs.onText(acc); }
        }
      }
    }
  }
  cbs.onStatus(acc ? 'done' : 'error');
  return { ok: !!acc, error: acc ? undefined : 'stream-end' };
}
