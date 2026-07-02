// hidden-cards.js
import { supabase, isConfigured } from './supabase-client.js';

/* 保底 — the deck starts owing you from the third run (Genshin-style soft pity).
   Client-side counter; grants only from a "safe pool": special triggers
   (META/NULL/EVEN/MIRROR_NULL) and the sensitive card (GHOST_JUE) are never
   given away — those have to be earned by actually behaving that way. */
const PITY_POOL = ['REPEAT', 'LOOP', 'SLOW', 'ZERO', 'FGHT_MIRR', 'COEX_HUI', 'DECT_NULL'];
const PITY_SOFT_START = 3;   // ramp begins on 3rd completion
const PITY_HARD = 7;         // guaranteed by the 7th
const PITY_STEP = 0.12;      // +12% per run past the start

function pityDraw(alreadyUnlocked) {
  let done = 0;
  try {
    done = Number(localStorage.getItem('coexist_completions') || 0) + 1;
    localStorage.setItem('coexist_completions', String(done));
  } catch (_) { return null; }
  if (done < PITY_SOFT_START) return null;
  const p = Math.min((done - (PITY_SOFT_START - 1)) * PITY_STEP, 1);
  if (done < PITY_HARD && Math.random() >= p) return null;
  const pool = PITY_POOL.filter(c => !alreadyUnlocked.has(c));
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem('coexist_completions', '0'); } catch (_) {}
  return pick;
}

export async function checkHiddenTriggers(sessionId, userId, scores, behavior, answers) {
  const triggered = new Set();
  const totalDwell = behavior.total_dwell_ms || 0;

  // 行为触发
  if (totalDwell > 0 && totalDwell < 90000) triggered.add('FAST');
  if (totalDwell > 1500000) triggered.add('SLOW');
  if (behavior.skipped.includes('Q10')) triggered.add('SKIP');
  if (behavior.meta_triggered) triggered.add('META');
  if (behavior.loop_triggered) triggered.add('LOOP');
  if (behavior.null_triggered) triggered.add('NULL');

  // 重测
  if (scores.retake_no >= 3) triggered.add('REPEAT');

  // 五维分布
  const axes = ['DECT', 'MIRR', 'GHST', 'FGHT', 'PHIL'].map(k => scores[k]);
  const max = Math.max(...axes);
  const min = Math.min(...axes);
  const total = axes.reduce((a, b) => a + b, 0);

  if (max - min <= 1 && max > 3) triggered.add('MIRROR_NULL');
  if (total < 5) triggered.add('ZERO');
  if (max - min === 0 && max > 0) triggered.add('EVEN');

  // 组合触发
  if (scores.GHST > 8 && totalDwell < 120000) triggered.add('GHOST_JUE');
  if (scores.FGHT > 6 && scores.MIRR > 6) triggered.add('FGHT_MIRR');
  if (scores.COEX > 6 && behavior.switched_count > 8) triggered.add('COEX_HUI');
  if (scores.DECT > 8 && totalDwell < 180000) triggered.add('DECT_NULL');

  // 保底：这一轮什么都没触发时才可能发牌
  if (triggered.size === 0) {
    const owed = pityDraw(triggered);
    if (owed) triggered.add(owed);
  }

  const codes = Array.from(triggered);

  if (isConfigured && codes.length > 0) {
    for (const code of codes) {
      await supabase.from('hidden_triggers').insert({
        session_id: sessionId,
        trigger_code: code,
        trigger_score: 1
      }).then(() => {}, () => {});
    }
    await supabase.rpc('add_hidden_to_user', {
      p_user_id: userId,
      p_cards: codes
    }).then(() => {}, () => {});
  }

  return codes;
}
