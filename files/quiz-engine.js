// quiz-engine.js
import { supabase, isConfigured } from './supabase-client.js';

export class QuizEngine {
  constructor(user, questionsData) {
    this.user = user;
    this.allQuestions = questionsData.questions;
    this.session = null;
    this.questions = [];
    this.currentIndex = 0;
    this.answers = [];
    this.startTime = null;

    this.scores = {
      DECT: 0, MIRR: 0, GHST: 0, FGHT: 0, PHIL: 0, COEX: 0,
      qi: 0, yong: 0, kun: 0, chu: 0
    };

    this.behavior = {
      switched_count: 0,
      back_count: 0,
      skipped: [],
      slot_machine_qs: [],
      meta_triggered: false,
      loop_triggered: false,
      null_triggered: false
    };
  }

  // 老虎机题:30% 出现率
  applySlotMachine() {
    return this.allQuestions.filter(q => {
      if (!q.is_slot_machine) return true;
      const hit = Math.random() < 0.3;
      if (hit) this.behavior.slot_machine_qs.push(q.id);
      return hit;
    });
  }

  async start() {
    this.questions = this.applySlotMachine();
    this.startTime = Date.now();

    if (!isConfigured) {
      this.session = { id: 'mock-session-' + Date.now() };
      return this.session;
    }

    const { data, error } = await supabase.from('sessions').insert({
      user_id: this.user.id,
      question_order: this.questions.map(q => q.id),
      slot_machine_qs: this.behavior.slot_machine_qs,
      device: this.detectDevice(),
      retake_no: this.user.visit_count || 1
    }).select().single();

    if (error) console.error(error);
    this.session = data || { id: 'fallback-' + Date.now() };
    return this.session;
  }

  getCurrent() {
    return this.questions[this.currentIndex];
  }

  isLast() {
    return this.currentIndex >= this.questions.length - 1;
  }

  progress() {
    return (this.currentIndex / this.questions.length) * 100;
  }

  async submit(selectedOptions, timing) {
    const q = this.getCurrent();

    // 评分
    selectedOptions.forEach(optId => {
      const opt = q.options.find(o => o.id === optId);
      if (!opt) return;

      // 标量评分
      if (opt.scoring) {
        Object.entries(opt.scoring).forEach(([key, val]) => {
          // "DECT.困" 形式
          const [axis, state] = key.split('.');
          if (this.scores[axis] !== undefined) this.scores[axis] += val;
          if (state) {
            const stateMap = { '起': 'qi', '用': 'yong', '困': 'kun', '出': 'chu' };
            const stateKey = stateMap[state];
            if (stateKey) this.scores[stateKey] += val;
          }
        });
      }

      // 触发器
      if (opt.trigger === 'META') this.behavior.meta_triggered = true;
      if (opt.trigger === 'LOOP') this.behavior.loop_triggered = true;
      if (opt.trigger === 'NULL') this.behavior.null_triggered = true;
    });

    // 记录答案
    this.answers.push({
      question_id: q.id,
      selected_options: selectedOptions,
      dwell_ms: timing.dwell_ms,
      switch_count: timing.switch_count
    });

    this.behavior.switched_count += timing.switch_count;

    // 写入 Supabase
    if (isConfigured && this.session.id !== 'mock-session-' + Date.now()) {
      await supabase.from('answers').insert({
        session_id: this.session.id,
        question_id: q.id,
        selected_options: selectedOptions,
        dwell_ms: timing.dwell_ms,
        switch_count: timing.switch_count,
        ts_submit: new Date().toISOString()
      });

      await supabase.from('sessions').update({
        score_dect: this.scores.DECT,
        score_mirr: this.scores.MIRR,
        score_ghst: this.scores.GHST,
        score_fght: this.scores.FGHT,
        score_phil: this.scores.PHIL,
        score_coex: this.scores.COEX,
        state_qi: this.scores.qi,
        state_yong: this.scores.yong,
        state_kun: this.scores.kun,
        state_chu: this.scores.chu,
        switched_count: this.behavior.switched_count
      }).eq('id', this.session.id);
    }

    this.currentIndex++;
  }

  skip() {
    const q = this.getCurrent();
    this.behavior.skipped.push(q.id);
    this.answers.push({
      question_id: q.id,
      selected_options: [],
      skipped: true
    });
    this.currentIndex++;
  }

  async finish() {
    const totalDwell = Date.now() - this.startTime;

    if (isConfigured) {
      await supabase.from('sessions').update({
        finished_at: new Date().toISOString(),
        total_dwell_ms: totalDwell,
        skipped_questions: this.behavior.skipped
      }).eq('id', this.session.id);
    }

    return {
      sessionId: this.session.id,
      scores: this.scores,
      behavior: { ...this.behavior, total_dwell_ms: totalDwell },
      answers: this.answers
    };
  }

  detectDevice() {
    return /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  }
}
