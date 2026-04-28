// result-engine.js
import { supabase, isConfigured } from './supabase-client.js';
import { checkHiddenTriggers } from './hidden-cards.js';

export async function generateResult(quizResult, user) {
  const { sessionId, scores, behavior, answers } = quizResult;

  // 1. 主轴
  const axes = {
    DECT: scores.DECT,
    MIRR: scores.MIRR,
    GHST: scores.GHST,
    FGHT: scores.FGHT,
    PHIL: scores.PHIL
  };
  const sortedAxes = Object.entries(axes).sort((a, b) => b[1] - a[1]);
  const mainAxis = sortedAxes[0][0];
  const totalScore = Object.values(axes).reduce((a, b) => a + b, 0);

  // 2. COEX 兜底
  const isCoex = scores.COEX > totalScore * 0.4 || (totalScore < 8 && scores.COEX > 2);

  // 3. 状态
  const states = {
    '起': scores.qi,
    '用': scores.yong,
    '困': scores.kun,
    '出': scores.chu
  };
  const state = Object.entries(states).sort((a, b) => b[1] - a[1])[0][0];

  const mainCard = isCoex ? 'COEX' : `${mainAxis}.${state}`;

  // 4. 副轴
  const subRatio = sortedAxes[0][1] > 0 ? sortedAxes[1][1] / sortedAxes[0][1] : 0;
  const variantCard = (subRatio > 0.6 && !isCoex)
    ? `${mainCard}×${sortedAxes[1][0]}.${state}`
    : null;

  // 5. 隐藏卡
  const hiddenCards = await checkHiddenTriggers(
    sessionId, user.id, scores, behavior, answers
  );

  // 6. 个性签名
  const signature = generateSignature(answers);

  // 7. 写回 + 计数
  let todayCount = 1;
  let totalCount = 1;
  let rarity = 0.1;

  if (isConfigured) {
    await supabase.from('sessions').update({
      main_card: mainCard,
      variant_card: variantCard,
      hidden_cards: hiddenCards,
      signature_hash: signature
    }).eq('id', sessionId);

    await supabase.rpc('increment_card_count', { card: mainCard });
    await supabase.rpc('add_to_collection', {
      p_user_id: user.id,
      p_card: mainCard
    });

    const { data: stat } = await supabase
      .from('card_stats')
      .select('*')
      .eq('card_id', mainCard)
      .single();

    if (stat) {
      todayCount = stat.today_count;
      totalCount = stat.total_count;
    }

    const { count: total } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .not('main_card', 'is', null);

    if (total) {
      rarity = ((totalCount / total) * 100).toFixed(1);
      await supabase.from('sessions')
        .update({ rarity_pct: parseFloat(rarity) })
        .eq('id', sessionId);
    }
  }

  return {
    mainCard,
    variantCard,
    hiddenCards,
    signature,
    rarity,
    todayCount,
    todayRank: todayCount,
    totalCount,
    scores
  };
}

function generateSignature(answers) {
  const combo = answers
    .filter(a => !a.skipped)
    .sort((a, b) => a.question_id.localeCompare(b.question_id))
    .map(a => `${a.question_id}:${(a.selected_options || []).sort().join(',')}`)
    .join('|');

  let hash = 0;
  for (let i = 0; i < combo.length; i++) {
    hash = ((hash << 5) - hash) + combo.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padEnd(6, '0');
}

// 实时数字文案
export function formatLiveStat(cardName, todayCount, todayRank) {
  if (todayCount === 0) {
    return `今天还没人测出${cardName}。你是第一个。`;
  }
  if (todayCount === 1) {
    return `今天你是第一个测出${cardName}的人。`;
  }
  return `今天 ${todayCount} 个人也是${cardName}。你是今天第 ${todayRank} 个。`;
}
