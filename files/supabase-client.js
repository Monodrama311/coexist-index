// supabase-client.js
// 注意:替换 SUPABASE_URL 和 SUPABASE_ANON_KEY 为你的实际值
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zfrginwphvxkjtdhdzgz.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmcmdpbndwaHZ4a2p0ZGhkemd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDMxMDcsImV4cCI6MjA5MjkxOTEwN30.5JY5sxo5SH948bir039kd-mwCRWDu39fq_1hoMPm_v0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 检测是否配置完成
export const isConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_URL';

if (!isConfigured) {
  console.warn('[Coexist] Supabase 未配置,运行在 mock 模式');
}
