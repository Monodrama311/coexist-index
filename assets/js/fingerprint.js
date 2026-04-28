// fingerprint.js
import { supabase, isConfigured } from './supabase-client.js';

// 简单浏览器指纹(无依赖,够用)
async function generateFingerprint() {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.deviceMemory || 0
  ].join('|');

  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('').slice(0, 24);
}

export async function getOrCreateUser() {
  const fingerprint = await generateFingerprint();

  // localStorage 兜底缓存
  const cacheKey = 'coexist_user_id';
  const cached = localStorage.getItem(cacheKey);

  if (!isConfigured) {
    // mock 模式
    return {
      id: cached || 'mock-' + fingerprint.slice(0, 8),
      fingerprint,
      visit_count: 1,
      cards_collected: [],
      hidden_cards_unlocked: []
    };
  }

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  if (existing) {
    await supabase.from('users')
      .update({
        last_seen: new Date().toISOString(),
        visit_count: existing.visit_count + 1
      })
      .eq('id', existing.id);
    localStorage.setItem(cacheKey, existing.id);
    return existing;
  }

  const { data: newUser } = await supabase
    .from('users')
    .insert({ fingerprint })
    .select()
    .single();

  localStorage.setItem(cacheKey, newUser.id);
  return newUser;
}
