-- ============================================
-- 共处 · Coexist 后端 schema v1
-- ============================================

-- 用户(指纹识别,无登录)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  fingerprint text unique not null,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  visit_count int default 1,
  cards_collected text[] default '{}',
  hidden_cards_unlocked text[] default '{}',
  meta jsonb default '{}'::jsonb
);

create index if not exists idx_users_fingerprint on users(fingerprint);

-- 测试 session
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  started_at timestamptz default now(),
  finished_at timestamptz,
  total_dwell_ms int,

  -- 五维分数
  score_dect numeric default 0,
  score_mirr numeric default 0,
  score_ghst numeric default 0,
  score_fght numeric default 0,
  score_phil numeric default 0,
  score_coex numeric default 0,

  -- 状态分数
  state_qi numeric default 0,
  state_yong numeric default 0,
  state_kun numeric default 0,
  state_chu numeric default 0,

  -- 行为指纹
  question_order jsonb,
  slot_machine_qs text[],
  skipped_questions text[] default '{}',
  switched_count int default 0,
  back_count int default 0,

  -- 结果
  main_card text,
  variant_card text,
  hidden_cards text[] default '{}',
  signature_hash text,
  rarity_pct numeric,

  -- 元数据
  device text,
  referrer text,
  retake_no int default 1
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_main_card on sessions(main_card);
create index if not exists idx_sessions_finished on sessions(finished_at);

-- 每题回答(支持多选)
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  question_id text not null,
  selected_options text[] default '{}',
  dwell_ms int,
  switch_count int default 0,
  scroll_depth numeric,
  ts_enter timestamptz,
  ts_first_click timestamptz,
  ts_submit timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_answers_session on answers(session_id);
create index if not exists idx_answers_question on answers(question_id);

-- 实时卡片统计
create table if not exists card_stats (
  card_id text primary key,
  card_name text,
  total_count int default 0,
  today_count int default 0,
  last_reset date default current_date,
  rarity_pct numeric default 0,
  updated_at timestamptz default now()
);

-- 隐藏卡触发记录
create table if not exists hidden_triggers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  trigger_code text not null,
  trigger_source text,
  trigger_score int default 1,
  created_at timestamptz default now()
);

create index if not exists idx_hidden_session on hidden_triggers(session_id);
create index if not exists idx_hidden_code on hidden_triggers(trigger_code);

-- ============================================
-- 函数
-- ============================================
create or replace function reset_daily_stats()
returns void as $$
begin
  update card_stats
  set today_count = 0, last_reset = current_date
  where last_reset < current_date;
end;
$$ language plpgsql;

create or replace function increment_card_count(card text)
returns void as $$
begin
  insert into card_stats (card_id, total_count, today_count)
  values (card, 1, 1)
  on conflict (card_id) do update
  set total_count = card_stats.total_count + 1,
      today_count = case
        when card_stats.last_reset < current_date then 1
        else card_stats.today_count + 1
      end,
      last_reset = current_date,
      updated_at = now();
end;
$$ language plpgsql;

create or replace function add_to_collection(p_user_id uuid, p_card text)
returns void as $$
begin
  update users
  set cards_collected = array_append(
    array_remove(cards_collected, p_card),
    p_card
  )
  where id = p_user_id;
end;
$$ language plpgsql;

create or replace function add_hidden_to_user(p_user_id uuid, p_cards text[])
returns void as $$
declare
  c text;
begin
  foreach c in array p_cards loop
    update users
    set hidden_cards_unlocked = array_append(
      array_remove(hidden_cards_unlocked, c),
      c
    )
    where id = p_user_id;
  end loop;
end;
$$ language plpgsql;

-- ============================================
-- RLS
-- ============================================
alter table users enable row level security;
alter table sessions enable row level security;
alter table answers enable row level security;
alter table card_stats enable row level security;
alter table hidden_triggers enable row level security;

drop policy if exists "stats_public_read" on card_stats;
create policy "stats_public_read" on card_stats for select using (true);

drop policy if exists "sessions_insert" on sessions;
create policy "sessions_insert" on sessions for insert with check (true);

drop policy if exists "sessions_select_own" on sessions;
create policy "sessions_select_own" on sessions for select using (true);

drop policy if exists "sessions_update_own" on sessions;
create policy "sessions_update_own" on sessions for update using (true);

drop policy if exists "answers_insert" on answers;
create policy "answers_insert" on answers for insert with check (true);

drop policy if exists "answers_select" on answers;
create policy "answers_select" on answers for select using (true);

drop policy if exists "users_insert" on users;
create policy "users_insert" on users for insert with check (true);

drop policy if exists "users_select_own" on users;
create policy "users_select_own" on users for select using (true);

drop policy if exists "users_update_own" on users;
create policy "users_update_own" on users for update using (true);

drop policy if exists "hidden_insert" on hidden_triggers;
create policy "hidden_insert" on hidden_triggers for insert with check (true);

-- ============================================
-- 初始化 21 主卡 + 14 隐藏卡 stats
-- ============================================
insert into card_stats (card_id, card_name) values
  ('DECT.起','博主信徒'),('DECT.用','侧写哥'),('DECT.困','私家侦探'),('DECT.出','戒断佬'),
  ('MIRR.起','嘴替本替'),('MIRR.用','顺毛精'),('MIRR.困','道歉机'),('MIRR.出','皱眉学家'),
  ('GHST.起','已读侠'),('GHST.用','装死哥'),('GHST.困','静音上瘾'),('GHST.出','不蹦迪了'),
  ('FGHT.起','嘴硬选手'),('FGHT.用','战斗待机'),('FGHT.困','应激怪'),('FGHT.出','持证打手'),
  ('PHIL.起','冥想小白'),('PHIL.用','疗愈嘴替'),('PHIL.困','创伤博主'),('PHIL.出','退群导师'),
  ('COEX','躺平大师'),
  ('META','测中测'),('NULL','半场退场'),('REPEAT','重测三次的人'),
  ('LOOP','又测了一遍'),('SKIP','跳过了第十题'),('FAST','90 秒做完'),
  ('SLOW','测了 25 分钟'),('MIRROR_NULL','五轴均分'),('ZERO','没有主轴'),
  ('GHOST_JUE','真消失'),('FGHT_MIRR','内战型'),('COEX_HUI','假躺平'),
  ('DECT_NULL','没在分析的侦探'),('EVEN','完美五等分')
on conflict (card_id) do nothing;
