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

function mockUser(fingerprint) {
  const cacheKey = 'coexist_user_id';
  const cached = localStorage.getItem(cacheKey);
  const id = cached || 'mock-' + fingerprint.slice(0, 8);
  localStorage.setItem(cacheKey, id);
  return {
    id,
    fingerprint,
    visit_count: 1,
    cards_collected: [],
    hidden_cards_unlocked: [],
    _mock: true
  };
}

export async function getOrCreateUser() {
  const fingerprint = await generateFingerprint();

  if (!isConfigured) {
    return mockUser(fingerprint);
  }

  // 累加防御:任何 supabase 错误都退到 mock,不让页面崩
  try {
    const cacheKey = 'coexist_user_id';

    const { data: existing, error: selErr } = await supabase
      .from('users')
      .select('*')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (selErr) {
      console.warn('[Coexist] supabase select error, falling back to mock:', selErr.message);
      return mockUser(fingerprint);
    }

    if (existing) {
      await supabase.from('users')
        .update({
          last_seen: new Date().toISOString(),
          visit_count: (existing.visit_count || 0) + 1
        })
        .eq('id', existing.id);
      localStorage.setItem(cacheKey, existing.id);
      return existing;
    }

    const { data: newUser, error: insErr } = await supabase
      .from('users')
      .insert({ fingerprint })
      .select()
      .single();

    if (insErr || !newUser) {
      console.warn('[Coexist] supabase insert error, falling back to mock:', insErr ? insErr.message : 'no data');
      return mockUser(fingerprint);
    }

    localStorage.setItem(cacheKey, newUser.id);
    return newUser;
  } catch (e) {
    console.warn('[Coexist] supabase exception, falling back to mock:', e.message);
    return mockUser(fingerprint);
  }
}
