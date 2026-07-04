// supabase-client.js
// ⚡ Cloudflare 版:不再依赖 Supabase(免费版会 pause)。
// 这是一个"薄壳",对外保持和原来 supabase 一样的调用方式,
// 底下改成打自建的 Cloudflare Worker + D1。其余文件一行都不用改。
//
// 部署完 Worker 后,把它的地址粘到下面这一行 —— 只需改这一处:
const API = 'https://coexist-api.waterloony.workers.dev';   // 已部署 · 留空则回退 mock

export const isConfigured = !!API;

if (!isConfigured) {
  console.warn('[Coexist] Worker API 未设置,运行在 mock 模式(把 supabase-client.js 里的 API 填上即可上线)');
}

// ---- 与 Worker 通信 ----
async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error('worker ' + r.status);
  return r.json();
}
async function get(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error('worker ' + r.status);
  return r.json();
}

// ---- 一个只覆盖本项目用到的链式调用的最小 query builder ----
// 用到的链:
//   from('users').select('*').eq('fingerprint',fp).maybeSingle()
//   from('users').update({...}).eq('id',id)
//   from('users').insert({fingerprint}).select().single()
//   from('sessions').insert({...}).select().single()   → no-op(用回退 id)
//   from('sessions').update({...}).eq('id',id)          → no-op
//   from('sessions').select('*',{count,head}).not('main_card','is',null) → 总数
//   from('answers'|'hidden_triggers').insert({...})      → no-op(遥测,不影响体验)
//   from('card_stats').select('*').eq('card_id',c).single()
class Query {
  constructor(table) { this.table = table; this.op = null; this.payload = null; this.filters = {}; this._count = false; }
  select(_cols, opts) { if (!this.op) this.op = 'select'; if (opts && opts.count) this._count = true; return this; }
  insert(obj) { this.op = 'insert'; this.payload = obj; return this; }
  update(obj) { this.op = 'update'; this.payload = obj; return this; }
  eq(col, val) { this.filters[col] = val; return this; }
  not(_col, _o, _v) { return this; }
  single() { return this._run(); }
  maybeSingle() { return this._run(); }
  then(resolve, reject) { return this._run().then(resolve, reject); }

  async _run() {
    try {
      // users
      if (this.table === 'users') {
        if (this.op === 'select' || this.op === 'insert') {
          const fp = this.filters.fingerprint || (this.payload && this.payload.fingerprint);
          const u = await post('/user', { fingerprint: fp });
          return { data: u, error: null };
        }
        return { data: null, error: null }; // update last_seen 等 → 已在 /user 里累加,忽略
      }
      // card_stats
      if (this.table === 'card_stats') {
        const s = await get('/stats?card=' + encodeURIComponent(this.filters.card_id));
        return { data: s, error: null };
      }
      // sessions 总数
      if (this.table === 'sessions' && this.op === 'select' && this._count) {
        const s = await get('/session-count');
        return { count: s.count, data: null, error: null };
      }
      // sessions insert/update、answers/hidden_triggers insert → 遥测,no-op
      return { data: null, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };  // 失败自动退回 mock,页面不崩
    }
  }
}

// ---- RPC ----
async function rpc(name, params) {
  try {
    if (name === 'increment_card_count') { await post('/count', { card: params.card }); return { data: null, error: null }; }
    if (name === 'add_to_collection')    { await post('/collect', { user_id: params.p_user_id, card: params.p_card }); return { data: null, error: null }; }
    if (name === 'add_hidden_to_user')   { await post('/collect', { user_id: params.p_user_id, cards: params.p_cards, hidden: true }); return { data: null, error: null }; }
    return { data: null, error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

// ---- 实时(Cloudflare 版先不做实时,给个空壳,result.html 不会崩)----
function channel() {
  const ch = { on() { return ch; }, subscribe() { return ch; } };
  return ch;
}

export const supabase = {
  from: (table) => new Query(table),
  rpc,
  channel
};
