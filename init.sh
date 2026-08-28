#!/usr/bin/env bash
# ZHULONG 启动验证：结构完整 + 快照可解析 + 页面脚本语法 + 密钥安全 + 数据源可达
set -uo pipefail
cd "$(dirname "$0")"
fail=0
ZL_ANON_KEY="${ZL_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1aG9veHpvaXRyZXh1Y254dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4OTk5MjMsImV4cCI6MjEwMzQ3NTkyM30.mRnANC3mIqof3syzYOQKZRBuKlGmtHCT7Vzd7EJb1EA}"

P=docs/prototype/zhulong.html
S=docs/prototype/data/zhulong-data.js

# 1) 主文件
[ -f "$P" ] && echo "✓ 主文件 $P" || { echo "✗ 缺 $P"; fail=1; }

# 2) 快照在位且可解析（列式结构自检）
if [ -f "$S" ]; then
  node -e "
    global.window={};require('./$S');
    const d=window.ZL_DATA; if(!d) throw new Error('无 ZL_DATA');
    for(const z of ['AEP','DAYTON','DOM']){
      const zz=d.zones[z]; if(!zz||!zz.loads||!zz.loads.length) throw new Error(z+' 空');
      if(zz.loads.some(v=>!isFinite(v))) throw new Error(z+' 含非有限值');
    }
    console.log('✓ 快照', Object.keys(d.zones).map(z=>z+':'+d.zones[z].n).join(' '),
      'model:', d.model?.modelId||'无', 'pred:', d.pred?'有':'无');
  " || { echo "✗ 快照解析失败"; fail=1; }
else
  echo "⚠ 快照未生成（ZL_SKEY=<service_key> node scripts/build-snapshot.mjs）"
fi

# 3) 页面内联脚本语法
node -e "
  const fs=require('fs');const html=fs.readFileSync('$P','utf8');
  const segs=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for(const s of segs) new Function(s[1]);
  console.log('✓ 页面内联脚本语法', segs.length, '段');
" || { echo "✗ 页面脚本语法错误"; fail=1; }

# 4) 密钥安全：不得出现 service_role 的 JWT 特征段（base64 of "role":"service_role"）
leak=$(grep -rl "cm9sZSI6InNlcnZpY2Vfcm9sZS[I]" docs scripts CLAUDE.md init.sh feature_list.json progress.md 2>/dev/null || true)
if [ -n "$leak" ]; then echo "✗ service_role 密钥泄漏: $leak"; fail=1; else echo "✓ 无 service_role 密钥泄漏"; fi

# 5) Supabase 可达性（不阻塞离线）
code=$(curl -sS -m 8 -o /dev/null -w "%{http_code}" \
  "https://guhooxzoitrexucnxvew.supabase.co/rest/v1/energy_hourly?select=zone&limit=1" \
  -H "apikey: $ZL_ANON_KEY" 2>/dev/null || echo 000)
[ "$code" = "200" ] && echo "✓ Supabase 可达" || echo "⚠ Supabase 不可达($code)——离线快照模式可用"

exit $fail
