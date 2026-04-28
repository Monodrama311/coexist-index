// hidden-cards.js
import { supabase, isConfigured } from './supabase-client.js';

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
