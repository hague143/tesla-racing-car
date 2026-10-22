import { CONFIG, clamp } from './config';
import { en, es, type TextKey } from './i18n';
import { cleanName, save } from './storage';
import { Leaderboard, type RankingFilter } from './leaderboard';
import type { GameState, Profile, Run, Settings, SimEvent } from './types';

export const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
interface Actions { play(): void; pause(): void; resume(): void; menu(): void; mute(): void; retry(): void; settings(): void; feedback(): void }
export class UI {
  state: GameState = 'BOOT';
  panel: string | null = null;
  private restoreFocus: HTMLElement | null = null;
  private rankGeneration = 0;
  private filter: RankingFilter = { period: 'all', metric: 'score', region: 'GLOBAL' };
  private noticeTime = 0;
  private result: { run: Run; newRecord: boolean; stored: boolean; status: TextKey } | null = null;
  constructor(public settings: Settings, public profile: Profile, private rankings: Leaderboard, private actions: Actions) {
    el('play-button').onclick = () => this.play();
    el('again-button').onclick = () => this.play();
    el('resume-button').onclick = () => actions.resume();
    el('pause-button').onclick = () => actions.pause();
    el('pause-menu-button').onclick = el('over-menu-button').onclick = () => actions.menu();
    el('brand-home').onclick = e => { e.preventDefault(); if (this.state === 'PLAYING') actions.pause(); else if (this.state !== 'MENU') actions.menu(); };
    el('retry-button').onclick = () => actions.retry();
    el('sound-button').onclick = () => actions.mute();
    el('edit-pilot').onclick = () => this.open('profile');
    document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => button.onclick = () => this.open(button.dataset.panel!));
    el('close-panel').onclick = () => this.close();
    el('panel-overlay').onclick = e => { if (e.target === el('panel-overlay')) this.close(); };
    el('controls-play').onclick = () => {
      this.settings.seenControls = true; this.persistSettings(); this.close();
      if (this.state === 'PAUSED') actions.resume(); else actions.play();
    };
    el<HTMLSelectElement>('language').onchange = e => {
      this.settings.language = (e.target as HTMLSelectElement).value === 'es' ? 'es' : 'en';
      this.persistSettings(); this.translate();
    };
    el<HTMLSelectElement>('quality').onchange = e => {
      this.settings.quality = (e.target as HTMLSelectElement).value as Settings['quality']; this.persistSettings();
    };
    el<HTMLInputElement>('volume').oninput = e => {
      this.settings.volume = clamp(Number((e.target as HTMLInputElement).value) / 100, 0, 1); this.persistSettings(); this.syncSettings();
    };
    for (const [id, key] of [['mute-setting', 'muted'], ['reduced-motion', 'reducedMotion'], ['camera-shake', 'shake']] as const) {
      el<HTMLInputElement>(id).onchange = e => { this.settings[key] = (e.target as HTMLInputElement).checked; this.persistSettings(); this.syncSettings(); };
    }
    el<HTMLFormElement>('profile-panel').onsubmit = e => {
      e.preventDefault(); this.profile.name = cleanName(el<HTMLInputElement>('player-name').value);
      this.profile.region = el<HTMLSelectElement>('player-region').value;
      save('nightshift.profile.v2', this.profile); this.syncProfile(); this.close();
    };
    for (const [id, property] of [['period-filter', 'period'], ['metric-filter', 'metric'], ['region-filter', 'region']] as const) {
      el(id).onclick = e => {
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
        if (property === 'region') {
          if (button.dataset.value === 'regional' && this.profile.region === 'GLOBAL') { this.open('profile'); return; }
          this.filter.region = button.dataset.value === 'regional' ? this.profile.region : 'GLOBAL';
        } else if (property === 'period') this.filter.period = button.dataset.value as RankingFilter['period'];
        else this.filter.metric = button.dataset.value as RankingFilter['metric'];
        for (const b of el(id).querySelectorAll('button')) { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }
        void this.loadRankings();
      };
    }
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const root = this.panel ? el('panel-overlay') : this.state === 'PAUSED' ? el('pause-overlay') : this.state === 'GAME_OVER' ? el('over-overlay') : null;
      if (!root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>('button, input, select, a[href]')].filter(e => !e.closest('[hidden]') && !(e as HTMLButtonElement).disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    });
    if (CONFIG.supportUrl) { el<HTMLAnchorElement>('support-link').href = CONFIG.supportUrl; el('support-link').hidden = false; }
    if (CONFIG.contactUrl) { el<HTMLAnchorElement>('contact-link').href = CONFIG.contactUrl; el('contact-link').hidden = false; }
    el('title-first').textContent = CONFIG.title[0]; el('title-second').textContent = CONFIG.title[1];
    document.title = CONFIG.title.join(' ') + ' — Arcade Driving';
    if (CONFIG.brand !== 'NIGHTSHIFT') document.querySelector('.brand>span')!.textContent = CONFIG.brand;
    if (CONFIG.logoUrl) {
      const logo = document.createElement('img'); logo.src = CONFIG.logoUrl; logo.alt = ''; logo.width = logo.height = 32;
      document.querySelector('.brand-mark')!.replaceWith(logo);
    }
    this.translate(); this.syncProfile(); this.syncSettings();
  }
  t(key: TextKey) { return (this.settings.language === 'es' ? es : en)[key]; }
  translate() {
    document.documentElement.lang = this.settings.language;
    document.querySelectorAll<HTMLElement>('[data-t]').forEach(e => { const key = e.dataset.t as TextKey; if (en[key]) e.textContent = this.t(key); });
    el<HTMLSelectElement>('language').value = this.settings.language;
    el('edit-pilot').setAttribute('aria-label', this.t('editPilot'));
    el('close-panel').setAttribute('aria-label', this.t('close'));
    el('pause-button').setAttribute('aria-label', this.t('pause'));
    if (this.panel) { this.setPanelTitle(); if (this.panel === 'ranking') void this.loadRankings(); if (['privacy', 'terms', 'about'].includes(this.panel)) this.updateInfo(); }
    if (this.result) this.drawResult();
    this.syncSettings();
  }
  persistSettings() { save('nightshift.settings.v2', this.settings); this.actions.settings(); }
  syncSettings() {
    el<HTMLSelectElement>('quality').value = this.settings.quality;
    el<HTMLInputElement>('volume').value = String(Math.round(this.settings.volume * 100));
    el('volume-value').textContent = Math.round(this.settings.volume * 100) + '%';
    el<HTMLInputElement>('mute-setting').checked = this.settings.muted;
    el<HTMLInputElement>('reduced-motion').checked = this.settings.reducedMotion;
    el<HTMLInputElement>('camera-shake').checked = this.settings.shake;
    el<HTMLInputElement>('camera-shake').disabled = this.settings.reducedMotion;
    el('sound-button').setAttribute('aria-pressed', String(!this.settings.muted));
    el('sound-button').setAttribute('aria-label', this.t('sound') + ' (M)');
    el('sound-button').querySelector('use')!.setAttribute('href', this.settings.muted ? '#i-muted' : '#i-sound');
  }
  syncProfile() {
    el('pilot-name').textContent = this.profile.name;
    document.querySelector('.avatar')!.textContent = this.profile.name.charAt(0).toUpperCase();
    el('menu-best').textContent = Math.floor(this.profile.bestScore).toLocaleString();
    el('menu-distance').replaceChildren(document.createTextNode((this.profile.bestDistance / 1000).toFixed(2)));
    const unit = document.createElement('small'); unit.textContent = ' KM'; el('menu-distance').append(unit);
  }
  setState(state: GameState) {
    this.state = state; document.body.dataset.state = state;
    el('loading-screen').hidden = state !== 'BOOT' && state !== 'LOADING';
    el('error-screen').hidden = state !== 'ERROR';
    el('topbar').hidden = ['BOOT', 'LOADING', 'ERROR'].includes(state);
    el('main-menu').hidden = el('footer').hidden = el('scene-caption').hidden = state !== 'MENU';
    el('hud').hidden = !['PLAYING', 'PAUSED', 'GAME_OVER'].includes(state);
    el('pause-overlay').hidden = state !== 'PAUSED'; el('over-overlay').hidden = state !== 'GAME_OVER';
    el('pause-button').hidden = state !== 'PLAYING';
    el('edit-pilot').hidden = state !== 'MENU';
    if (state === 'MENU') { this.close(); this.syncProfile(); el('play-button').focus({ preventScroll: true }); }
    if (state === 'PLAYING') { this.close(); (document.activeElement as HTMLElement)?.blur(); el('notice').textContent = ''; this.noticeTime = 0; }
    if (state === 'PAUSED') el('resume-button').focus();
    if (state === 'GAME_OVER') el('again-button').focus();
    if (state === 'ERROR') { this.close(); el('retry-button').focus(); }
  }
  play() {
    if (!this.settings.seenControls && this.state === 'MENU') this.open('controls');
    else { this.close(); this.actions.play(); }
  }
  open(panel: string) {
    if (!['MENU', 'PLAYING', 'PAUSED', 'GAME_OVER'].includes(this.state)) return;
    if (this.state === 'PLAYING') this.actions.pause();
    this.actions.feedback();
    if (!this.panel) this.restoreFocus = document.activeElement as HTMLElement;
    this.panel = panel; el('panel-overlay').hidden = false;
    for (const name of ['ranking', 'settings', 'controls', 'profile', 'info']) el(name + '-panel').hidden = name !== (['privacy', 'terms', 'about'].includes(panel) ? 'info' : panel);
    this.setPanelTitle();
    if (panel === 'ranking') void this.loadRankings();
    if (panel === 'profile') { el<HTMLInputElement>('player-name').value = this.profile.name; el<HTMLSelectElement>('player-region').value = this.profile.region; }
    if (['privacy', 'terms', 'about'].includes(panel)) this.updateInfo();
    el('close-panel').focus({ preventScroll: true });
  }
  close() {
    const wasOpen = this.panel !== null; this.panel = null; this.rankGeneration++;
    el('panel-overlay').hidden = true;
    if (wasOpen && this.restoreFocus?.isConnected && !this.restoreFocus.closest('[hidden]')) this.restoreFocus.focus({ preventScroll: true });
  }
  private setPanelTitle() {
    const key = this.panel === 'ranking' ? 'globalTop' : this.panel === 'profile' ? 'profile' : ['privacy', 'terms', 'about'].includes(this.panel || '') ? this.panel + 'Title' : this.panel;
    el('panel-title').textContent = this.t(key as TextKey);
  }
  private updateInfo() { el('info-body').textContent = this.t((this.panel + 'Body') as TextKey); }
  loading(progress: number, key: TextKey) {
    el('load-fill').style.width = progress + '%'; el('load-progress').setAttribute('aria-valuenow', String(progress)); el('load-detail').textContent = this.t(key);
  }
  error(kind: 'unsupported' | 'contextLost', detail?: string) {
    el('error-detail').textContent = this.t(kind) + (detail ? ' ' + detail : '');
  }
  hud(run: Run, dt: number) {
    el('score-value').textContent = run.score.toLocaleString(); el('distance-value').textContent = (run.distance / 1000).toFixed(2);
    el('speed-value').textContent = String(Math.round(run.speed * 3.6)); el('energy-value').textContent = Math.floor(run.energy) + '%';
    el('energy-fill').style.width = run.energy + '%'; el('energy-meter').setAttribute('aria-valuenow', String(Math.round(run.energy)));
    el('boost-state').textContent = this.t(run.boosting ? 'active' : run.boostLocked ? 'depleted' : 'charged');
    document.querySelector('.boost-hud')!.classList.toggle('active', run.boosting); document.querySelector('.boost-hud')!.classList.toggle('depleted', run.boostLocked);
    this.noticeTime -= dt; if (this.noticeTime <= 0) el('notice').textContent = '';
  }
  event(event: SimEvent) {
    const key = ({ jump: 'jumpCue', roll: 'rollCue', pickup: 'pickupCue', near: 'nearCue' } as const)[event as 'jump' | 'roll' | 'pickup' | 'near'];
    if (key) { el('notice').textContent = this.t(key); this.noticeTime = 1.2; }
  }
  gameOver(run: Run, newRecord: boolean, stored: boolean) {
    this.result = { run, newRecord, stored, status: this.rankings.configured ? 'submissionPending' : 'submissionOffline' }; this.drawResult();
  }
  submission(status: 'offline' | 'saved' | 'failed') {
    if (!this.result) return;
    this.result.status = status === 'saved' ? 'submissionSaved' : status === 'failed' ? 'submissionFailed' : 'submissionOffline'; this.drawResult();
  }
  private drawResult() {
    const result = this.result!;
    document.querySelector('.gameover-card')!.classList.toggle('new-record', result.newRecord);
    el('record-label').textContent = this.t(result.newRecord ? 'record' : 'over');
    el('final-score').textContent = result.run.score.toLocaleString(); el('final-distance').textContent = (result.run.distance / 1000).toFixed(2);
    el('final-best').textContent = this.profile.bestScore.toLocaleString();
    el('local-status').textContent = this.t(result.stored ? 'stored' : 'notStored'); el('submission-status').textContent = this.t(result.status);
  }
  private async loadRankings() {
    const generation = ++this.rankGeneration, root = el('ranking-content'); root.replaceChildren();
    const message = (title: TextKey, description?: TextKey) => {
      const area = document.createElement('div'); area.className = 'ranking-empty';
      const heading = document.createElement('strong'); heading.textContent = this.t(title); area.append(heading);
      if (description) { const p = document.createElement('p'); p.textContent = this.t(description); area.append(p); }
      root.replaceChildren(area);
    };
    if (!this.rankings.configured) return message('offline', 'offlineDetail');
    message('rankLoading');
    try {
      const entries = await this.rankings.list(this.filter);
      if (generation !== this.rankGeneration) return;
      if (!entries?.length) return message('emptyRank');
      const table = document.createElement('table'); table.className = 'ranking-table';
      const body = document.createElement('tbody'); table.append(body);
      for (const [index, entry] of entries.entries()) {
        const row = document.createElement('tr');
        for (const value of [String(index + 1).padStart(2, '0'), entry.name.slice(0, 20), this.filter.metric === 'score' ? Math.floor(entry.score).toLocaleString() : (entry.distance / 1000).toFixed(2) + ' KM']) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        const region = document.createElement('small'); region.textContent = entry.region; row.children[1].append(region); body.append(row);
      }
      root.replaceChildren(table);
    } catch { if (generation === this.rankGeneration) message('offline', 'rankingFailed'); }
  }
}
