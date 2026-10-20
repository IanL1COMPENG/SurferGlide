import './style.css';
import { BOARDS, RIDERS, COURSES, RANKS, rankFor, type CourseId } from './core/catalog.ts';
import {
  createRun,
  stepRun,
  FIXED_DT,
  RUN_DURATION,
  SPEED,
  rewardFor,
  type RiderState,
  type RunRecord,
} from './core/game.ts';
import { loadProfile, saveProfile, buyOrEquip, completeRun } from './core/profile.ts';
import type { RoomSnapshot } from './core/protocol.ts';
import { OceanScene } from './scene.ts';
import { GameAudio } from './audio.ts';
import { Controls } from './input.ts';
import { Multiplayer } from './network.ts';

const paths: Record<string, string> = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external: '<path d="M7 17 17 7M7 7h10v10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings:
    '<path d="m10 3-.6 2.2-2 .9-2-.6L3.5 9l1.5 1.6v2.8L3.5 15.1l1.9 3.4 2-.6 2 .9.6 2.2h4l.6-2.2 2-.9 2 .6 1.9-3.4-1.5-1.7v-2.8L20.5 9l-1.9-3.5-2 .6-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l6 6m0-6-6 6"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  palm: '<path d="M11 22c3-7 3-11 2-16M13 6C7 1 2 3 2 7c4-2 7-1 11-1Zm0 0c2-6 7-6 9-3-4 0-6 1-9 3Zm0 0c6-2 10 2 9 6-2-4-5-5-9-6Zm0 0c-5 0-7 5-5 8 0-4 2-6 5-8Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  mountain: '<path d="m2 20 7-14 5 9 3-6 5 11H2Zm4-8 3 2 2-3M14 15l3 2 2-2"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0zm5 11v5m-4 2h8M7 5H3v3a5 5 0 0 0 5 5M17 5h4v3a5 5 0 0 1-5 5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
const wave =
  '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M4 31c8 4 12 1 18-8S36 10 44 14c-8-1-14 7-10 13 2 4 6 5 10 3C35 42 17 43 4 31Z" fill="currentColor"/><path d="m14 13 19-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
const esc = (text: unknown) =>
  String(text).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const number = (n: number) => Math.round(n).toLocaleString('en-US');
const app = document.querySelector<HTMLDivElement>('#app')!;
let profile = loadProfile();
let ocean: OceanScene;
try {
  ocean = new OceanScene(document.querySelector('#scene')!);
} catch (error) {
  app.innerHTML = `<main class="fatal"><h1>Your next wave is waiting.</h1><p>Surfer Glide needs WebGL to draw its ocean. Enable hardware acceleration in your browser, then reload this page.</p><button class="button" onclick="location.reload()">Try again</button></main>`;
  throw error;
}
const audio = new GameAudio();
const controls = new Controls();
const network = new Multiplayer();
type Screen =
  'home' | 'locker' | 'rankings' | 'how' | 'multiplayer' | 'lobby' | 'playing' | 'results';
let screen: Screen = 'home';
let courseId: CourseId = 'lagoon';
let lockerTab: 'board' | 'rider' = 'board';
let run: RiderState | null = null;
let runId = '';
let result: RunRecord | undefined;
let isMultiplayer = false;
let paused = false;
let countdownEnd = 0;
let accumulator = 0;
let toastTimer = 0;
let eventTimer = 0;
let lastEvent = 0;
let lastCount = -1;
let lastVolume = profile.settings.volume || 0.65;
let busy = false;
let currentRound = '';
let completedRound = '';
let lobbySignature = '';
let lastHud = 0;
let lastNetworkInput = 0;
let gamepadSeen = false;
const params = new URLSearchParams(location.search);
const inviteCode = (params.get('room') || '')
  .replace(/[^a-f0-9]/gi, '')
  .slice(0, 6)
  .toUpperCase();
if (inviteCode) screen = 'multiplayer';

app.innerHTML = `
  <header class="topbar">
    <button class="brand" data-action="home" aria-label="Surfer Glide home"><span class="brand-symbol" style="color:var(--lime)">${wave}</span><span class="brand-word">SURFER GLIDE<small>THE GOOD KIND OF DRIFT</small></span></button>
    <nav class="nav" aria-label="Main navigation"><button data-action="home">Play</button><button data-action="locker">Locker</button><button data-action="rankings">Rankings</button><button data-action="how">How to play</button></nav>
    <div class="top-actions"><div class="wallet" title="Credits earned by completing runs"><span class="coin">G</span><span id="wallet-value">0</span></div><button class="icon-button" data-action="settings" aria-label="Open settings">${icon('settings')}</button><button class="icon-button sound-toggle" data-action="mute" aria-label="Mute audio">${icon('sound')}</button></div>
  </header>
  <main id="screen"></main>
  <div id="hud">
    <div class="run-progress"><i id="run-progress"></i></div>
    <div class="hud-top"><div class="hud-score"><small>SESSION SCORE</small><strong id="score-value">0</strong><span class="multiplier" id="combo-value">1× FLOW MULTIPLIER</span></div><div class="hud-timer"><small>TIME LEFT</small><strong id="time-value">1:30</strong></div><div class="hud-buttons"><button class="icon-button" data-action="pause" aria-label="Pause or open match menu">${icon('pause')}</button><button class="icon-button sound-toggle" data-action="mute" aria-label="Mute audio">${icon('sound')}</button></div></div>
    <div class="trick-pop" id="trick-pop" role="status" aria-live="polite"></div>
    <div class="air-hint" id="air-hint"></div><div id="crew-scores"></div><div id="countdown"></div>
    <div class="hud-bottom"><div class="hud-meta"><div class="speed">${Math.round(SPEED * 3.6)}<small>km/h</small></div><span class="label" id="charge-label">CRUISE CONTROL</span><div class="charge-meter"><i id="charge-value"></i></div></div><div class="control-strip"><div><kbd>←</kbd><kbd>→</kbd><span>Carve</span></div><div><kbd>SPACE</kbd><span>Hold, release</span></div><div><kbd>X</kbd><span>Spin</span></div><div><kbd>Z</kbd><span>Grab</span></div><div><kbd>C</kbd><span>Flip</span></div></div><div class="hud-location"><small id="hud-course-label">THE ISLAND CLASSIC</small><strong id="hud-course">Palm Lagoon</strong></div></div>
    <div class="touch-controls" aria-label="Touch game controls"><div class="touch-group"><button data-control="left" aria-label="Carve left">${icon('left')}</button><button data-control="right" aria-label="Carve right">${icon('right')}</button></div><div class="touch-group"><button data-control="grab">GRAB</button><button data-control="spin">SPIN</button><button data-control="flip">FLIP</button><button class="jump" data-control="jump">HOLD<br>TO JUMP</button></div></div>
  </div>
  <footer class="footer"><span class="status"><i class="status-dot"></i> A little escape. A better high score.</span><span>KEYBOARD · TOUCH · GAMEPAD <button data-action="how" aria-label="View game controls">${icon('info').replace('<svg', '<svg style="width:12px;height:12px;vertical-align:middle;margin-left:5px"')}</button></span><span>MADE FOR THE FLOW &nbsp; ↗</span></footer>
  <div id="toast" role="status" aria-live="polite"></div><dialog class="modal" id="modal"></dialog>`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const panelHead = (label: string, title: string, subtitle: string) =>
  `<div class="panel-head"><div><div class="eyebrow">${label}</div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="home" aria-label="Back to the ocean">${icon('close')}</button></div>`;
function persist() {
  if (!saveProfile(profile))
    toast(
      'Your browser could not save progress. Check available storage or private-browsing settings.',
    );
  updateWallet();
}
function updateWallet() {
  $('#wallet-value').textContent = number(profile.credits);
}
function toast(message: string) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('show'), 4300);
}
function soundButtons() {
  document.querySelectorAll('.sound-toggle').forEach(b => {
    b.innerHTML = icon(profile.settings.volume === 0 ? 'mute' : 'sound');
    b.setAttribute('aria-label', profile.settings.volume === 0 ? 'Unmute audio' : 'Mute audio');
  });
}
function configure() {
  audio.configure(profile.settings.volume, profile.settings.music);
  ocean.configure(profile.settings.quality, profile.settings.reducedMotion);
  ocean.equip(profile.board, profile.rider);
  soundButtons();
}

function render() {
  app.classList.toggle('playing', screen === 'playing');
  document
    .querySelectorAll<HTMLElement>('.nav button')
    .forEach(button =>
      button.classList.toggle(
        'active',
        button.dataset.action === screen ||
          (['multiplayer', 'lobby', 'results'].includes(screen) &&
            button.dataset.action === 'home'),
      ),
    );
  controls.enabled = screen === 'playing' && !paused && countdownEnd <= performance.now();
  const course = COURSES.find(c => c.id === courseId)!;
  if (screen === 'playing') {
    $('#screen').innerHTML = '';
    return;
  }
  if (screen === 'home') {
    $('#screen').innerHTML =
      `<section class="home"><div class="eyebrow">GOOD WAVES. GREAT COMPANY.</div><h1>Chase the wake.<br><em>Find your flow.</em></h1><p class="intro">A board, a boat, and a whole lot of possibility.<br>Land big tricks. Make it your own. Ride together.</p><div class="hero-actions"><button class="button" data-action="ride">Let’s ride ${icon('arrow')}</button><button class="button secondary" data-action="multiplayer">Ride with friends ${icon('external')}</button></div><p class="course-label">PICK YOUR LITTLE PIECE OF PARADISE</p><div class="course-list">${COURSES.map((c, i) => `<button class="course-card ${c.id === courseId ? 'selected' : ''}" data-action="course" data-course="${c.id}" aria-pressed="${c.id === courseId}"><span class="course-number">0${i + 1} &nbsp; ${c.id === courseId ? '● SELECTED' : 'EXPLORE'}</span><span class="course-icon">${icon(c.icon)}</span><strong>${c.name}</strong></button>`).join('')}</div></section><div class="hero-stamp">LESS SCROLLING.<br>MORE SOUL.</div><div class="location-label"><small>${course.label}</small><strong>${course.name}</strong><span>${icon('pin')} 90 seconds of somewhere else</span></div>`;
  }
  if (screen === 'locker') {
    const items = lockerTab === 'board' ? BOARDS : RIDERS;
    $('#screen').innerHTML =
      `<div class="panel-wrap"><section class="panel">${panelHead('A LITTLE MORE YOU', 'Style comes with the ride.', 'Earn Glide credits on the water. Make every run your own. All gear is cosmetic.')}<div class="tab-row"><button data-action="boards" class="${lockerTab === 'board' ? 'active' : ''}">Wakeboards · ${BOARDS.length}</button><button data-action="riders" class="${lockerTab === 'rider' ? 'active' : ''}">Riders · ${RIDERS.length}</button></div><div class="item-grid">${items
        .map(item => {
          const owned = profile.owned.includes(item.id);
          const equipped = profile[lockerTab] === item.id;
          const affordable = profile.credits >= item.price;
          return `<article class="gear-card ${equipped ? 'equipped' : ''}" style="--item-color:${item.color};--item-accent:${item.accent}">${equipped ? `<span class="equipped-badge">${icon('check')} EQUIPPED</span>` : ''}<div class="gear-visual"><div class="${lockerTab === 'board' ? 'board-art' : 'rider-art'}"></div></div><span class="rarity ${item.rarity}">${item.rarity}</span><h3>${item.name}</h3><p>${item.subtitle}</p><button class="button ${equipped || (!affordable && !owned) ? 'secondary' : ''}" data-action="equip" data-item="${item.id}" ${equipped || (!affordable && !owned) ? 'disabled' : ''} title="${!affordable && !owned ? `Earn ${number(item.price - profile.credits)} more credits to unlock` : equipped ? 'Currently equipped' : ''}"><span>${equipped ? 'Ready for the water' : owned ? 'Equip' : 'Unlock'}</span><span>${owned ? icon(equipped ? 'check' : 'arrow') : `<span class="coin">G</span> ${number(item.price)}`}</span></button></article>`;
        })
        .join(
          '',
        )}</div><p class="help-footnote">A finished run turns every 10 points into 1 credit. Flow rings add 15 bonus credits each. Land 5 jumps for an extra 100.</p></section></div>`;
  }
  if (screen === 'rankings') {
    const rank = rankFor(profile.xp);
    const bestRuns = [...profile.runs].sort((a, b) => b.score - a.score).slice(0, 8);
    $('#screen').innerHTML =
      `<div class="panel-wrap"><section class="panel">${panelHead('THE LONG GAME', 'Every run takes you further.', 'Build your lifetime rank and keep a logbook of your best days on the water.')}<div class="rank-card"><div class="rank-emblem" style="--rank-color:${rank.color}">${icon('trophy')}</div><div class="rank-details"><p>YOUR CURRENT RANK · LEVEL ${rank.index + 1}</p><h3>${rank.name}</h3><div class="progress-track"><i style="width:${rank.progress * 100}%"></i></div><div class="rank-track"><span>${number(profile.xp)} lifetime XP</span><span>${rank.next ? `${number(rank.next.xp - profile.xp)} to ${rank.next.name}` : 'You’ve reached the summit.'}</span></div></div></div><div class="stat-grid"><div class="stat-card"><small>Personal best</small><strong>${number(profile.best)}</strong></div><div class="stat-card"><small>Recent runs</small><strong>${profile.runs.length}</strong></div><div class="stat-card"><small>Flow rings</small><strong>${number(profile.totalRings)}</strong></div><div class="stat-card"><small>Gear unlocked</small><strong>${profile.owned.length}<span class="muted" style="font-size:14px"> / ${BOARDS.length + RIDERS.length}</span></strong></div></div><p class="course-label">YOUR LOCAL LOGBOOK · BEST RECENT RUNS</p><div class="table-scroll"><table><thead><tr><th>Place</th><th>Location</th><th>Score</th><th>Best flow</th><th>Session</th></tr></thead><tbody>${bestRuns.length ? bestRuns.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${COURSES.find(c => c.id === r.course)?.name || 'Palm Lagoon'}</td><td class="score">${number(r.score)}</td><td>${r.combo}×</td><td>${r.multiplayer ? 'Crew' : 'Solo'}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">Your logbook starts with a single good ride. Let’s make it happen.</td></tr>'}</tbody></table></div><div class="rank-ladder">${RANKS.map(r => `<span class="rank-pill ${rank.name === r.name ? 'current' : ''}" title="${number(r.xp)} lifetime XP">${r.name}</span>`).join('')}</div><p class="help-footnote">Lifetime rank and cosmetics save in this browser. Crew scores are calculated live by the multiplayer server. Your logbook keeps the latest 40 runs.</p></section></div>`;
  }
  if (screen === 'how')
    $('#screen').innerHTML =
      `<div class="panel-wrap"><section class="panel">${panelHead('A QUICK DIP', 'Easy to start. So much to master.', 'You have 90 seconds. The boat keeps moving. You bring the style.')}<div class="how-grid"><article class="how-card"><span class="number">01</span><h3>Find your edge.</h3><p>Carve left and right. Cross a white wake line with speed to launch into the air. Or hold jump to charge, then release for a hop. Jump near the wake for extra height.</p><div class="keys"><kbd>←</kbd><kbd>→</kbd><span>Carve</span><kbd>SPACE</kbd><span>Jump</span></div></article><article class="how-card"><span class="number">02</span><h3>Add a little style.</h3><p>While airborne, hold Spin, Grab, or Flip. Combine them for bigger points. Release Spin and Flip before landing so the board can level out. Holding too long causes a wipeout.</p><div class="keys"><kbd>X</kbd><span>Spin</span><kbd>Z</kbd><span>Grab</span><kbd>C</kbd><span>Flip</span></div></article><article class="how-card"><span class="number">03</span><h3>Keep the good going.</h3><p>Clean landings build your flow multiplier, up to 5×. Collect gold rings for bonus points and credits. Jump over coral buoys. Finish your run to bank credits and lifetime XP.</p><div class="keys"><kbd>ESC</kbd><span>Pause solo</span></div></article></div><div class="hint-banner">${icon('info')}<span>Gamepad: left stick to carve · A to charge jump · X to spin · B to grab · Y to flip. Touch controls appear on mobile. No one gets a gear advantage: unlocks are all about your style.</span></div><div class="hero-actions" style="margin:24px 0 0"><button class="button" data-action="ride">Got it. Let’s ride ${icon('arrow')}</button><button class="button secondary" data-action="multiplayer">Bring a friend ${icon('people')}</button></div></section></div>`;
  if (screen === 'multiplayer')
    $('#screen').innerHTML =
      `<div class="panel-wrap"><section class="panel" style="max-width:850px">${panelHead('BETTER WITH A CREW', 'Good waves are for sharing.', 'Up to 6 riders. One course. Ninety seconds to leave your mark.')}<div class="name-field"><label class="field-label" for="player-name">YOUR RIDER NAME</label><input id="player-name" type="text" value="${esc(profile.name)}" maxlength="18" autocomplete="nickname" placeholder="What should your crew call you?" /></div><div class="multiplayer-grid"><div class="room-action"><h3>Be the captain.</h3><p>Create a private room and share its six-character code with your friends.</p><label class="field-label" for="room-course">YOUR PATCH OF PARADISE</label><select id="room-course">${COURSES.map(c => `<option value="${c.id}" ${c.id === courseId ? 'selected' : ''}>${c.name}</option>`).join('')}</select><button class="button" data-action="create-room" ${busy ? 'disabled' : ''}>${busy ? 'Connecting…' : 'Create a room'} ${icon('arrow')}</button></div><div class="room-action"><h3>Join the good times.</h3><p>Already have a crew? Enter their room code and meet them at the dock.</p><label class="field-label" for="room-code">SIX-CHARACTER ROOM CODE</label><input id="room-code" type="text" maxlength="6" spellcheck="false" autocomplete="off" value="${inviteCode}" placeholder="A1B2C3" /><button class="button secondary" data-action="join-room" ${busy ? 'disabled' : ''}>${busy ? 'Connecting…' : 'Join a room'} ${icon('people')}</button></div></div><p class="help-footnote">Friends must open this same server address. For internet play, deploy the included Node server to a host with WebSocket support. Room codes identify rooms on that server.</p></section></div>`;
  if (screen === 'lobby' && network.room) renderLobby(network.room);
  if (screen === 'results' && result && run) renderResults();
  updateWallet();
}

function renderLobby(room: RoomSnapshot) {
  const course = COURSES.find(c => c.id === room.course)!;
  const host = room.host === network.id;
  $('#screen').innerHTML =
    `<div class="panel-wrap"><section class="panel" style="max-width:760px">${panelHead('YOUR CREW IS FORMING', 'Meet you at the dock.', `${course.name} · 90-second score attack · ${room.players.length}/6 riders`)}<div class="lobby-copy"><p>Share the room code, or copy an invite link.<br>The captain starts once everyone is here.</p><div class="room-info"><p class="course-label">YOUR PRIVATE ROOM</p><div class="room-code-display">${room.code}</div><button class="text-button" data-action="copy-invite">Copy invite link ${icon('copy').replace('<svg', '<svg style="width:12px;height:12px;vertical-align:middle"')}</button></div></div><div class="crew-list">${room.players.map(p => `<div class="crew-player"><span class="avatar-dot" style="--avatar-color:${RIDERS.find(x => x.id === p.rider)?.color}">${esc(p.name[0].toUpperCase())}</span><span>${esc(p.name)}${p.id === network.id ? ' <span class="muted">(you)</span>' : ''}</span><small>${p.id === room.host ? 'CAPTAIN' : 'READY TO RIDE'}</small></div>`).join('')}${room.players.length === 1 ? '<div class="empty">The water’s ready. Just waiting on a friend.</div>' : ''}</div><div class="room-lobby-bottom"><button class="button secondary" data-action="leave-room">Leave room</button>${host ? `<button class="button" data-action="start-room" ${room.players.length < 2 ? 'disabled' : ''}>Start the session ${icon('arrow')}</button>` : '<p>Waiting for the captain to start…</p>'}</div></section></div>`;
}
function renderResults() {
  if (!result || !run) return;
  const rank = rankFor(profile.xp);
  const best = result.score >= profile.best && result.score > 0;
  const ranking = network.room
    ? [...network.room.players].sort((a, b) => b.state.score - a.state.score)
    : [];
  $('#screen').innerHTML =
    `<div class="results-wrap"><section class="panel results"><div class="eyebrow">THAT’S A GOOD DAY ON THE WATER</div><h2>${run.cleanLandings >= 5 ? 'You found your flow.' : 'One more wave?'}</h2><p>${COURSES.find(c => c.id === result!.course)!.name} · Session complete</p>${best ? '<div class="new-best">✦ NEW PERSONAL BEST</div>' : ''}<div class="results-score">${number(result.score)}</div><div class="results-score-label">SESSION POINTS</div><div class="result-stats"><div><small>CLEAN LANDINGS</small><strong>${run.cleanLandings}</strong></div><div><small>BEST MULTIPLIER</small><strong>${run.bestCombo}×</strong></div><div><small>FLOW RINGS</small><strong>${run.pickups}</strong></div></div><div class="reward-line"><span class="coin">G</span> +${number(result.credits)} Glide credits <span class="muted">banked</span></div><p>${rank.name} · +${number(result.score)} lifetime XP</p><div class="progress-track"><i style="width:${rank.progress * 100}%"></i></div><div class="rank-track"><span>${number(profile.xp)} XP</span><span>${rank.next?.name || 'Maximum rank'}</span></div>${isMultiplayer ? `<div class="match-results">${ranking.map((p, i) => `<div class="online-score ${p.id === network.id ? 'me' : ''}"><span>${i + 1}. ${esc(p.name)}${p.id === network.id ? ' (you)' : ''}</span><strong>${number(p.state.score)}</strong></div>`).join('')}</div>` : ''}<div class="hero-actions"><button class="button" data-action="${isMultiplayer ? 'back-lobby' : 'ride'}">${isMultiplayer ? 'Back to the crew' : 'Ride again'} ${icon('arrow')}</button><button class="button secondary" data-action="${isMultiplayer ? 'leave-room' : 'locker'}">${isMultiplayer ? 'Leave room' : 'Visit your locker'}</button>${!isMultiplayer ? '<button class="text-button" data-action="home">Back to shore</button>' : ''}</div></section></div>`;
}
function navigate(next: Screen) {
  if (network.room && next !== 'lobby' && next !== 'playing' && next !== 'results') {
    network.leave();
    isMultiplayer = false;
    ocean.clearRemote();
  }
  if (screen === 'playing') controls.clear();
  screen = next;
  if (next !== 'playing') {
    audio.setPlaying(false);
    run = next === 'results' ? run : null;
  }
  render();
}
function startSolo() {
  network.leave();
  ocean.clearRemote();
  isMultiplayer = false;
  run = createRun();
  runId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  result = undefined;
  lastEvent = 0;
  lastCount = -1;
  countdownEnd = performance.now() + 3300;
  accumulator = 0;
  paused = false;
  screen = 'playing';
  $('#trick-pop').classList.remove('visible');
  $('#crew-scores').innerHTML = '';
  audio.setPlaying(true);
  ocean.setCourse(courseId);
  render();
  updateHud();
}
function finishRun() {
  if (!run || result) return;
  result = completeRun(profile, run, courseId, runId, isMultiplayer);
  if (!result) return;
  persist();
  audio.play('finish');
  audio.setPlaying(false);
  controls.clear();
  controls.enabled = false;
  $('#countdown').innerHTML = '';
  screen = 'results';
  render();
}
function updateHud() {
  if (!run) return;
  $('#score-value').textContent = number(run.score);
  $('#combo-value').textContent = `${run.combo}× FLOW MULTIPLIER`;
  const remaining = Math.ceil(RUN_DURATION - run.time);
  $('#time-value').textContent =
    `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  $('.hud-timer').classList.toggle('urgent', remaining <= 15);
  $('#run-progress').style.width = `${(1 - run.time / RUN_DURATION) * 100}%`;
  $('#charge-value').style.width = `${run.charge * 100}%`;
  $('#charge-label').textContent =
    run.wipeout > 0
      ? 'BACK UP IN A SECOND'
      : run.airborne
        ? `${run.y.toFixed(1)} M · AIR TIME`
        : run.charge > 0
          ? 'CHARGING · RELEASE TO JUMP'
          : 'CRUISE CONTROL';
  $('#air-hint').textContent =
    run.wipeout > 0
      ? 'Every great rider takes a splash. You’re back in a moment.'
      : run.airborne
        ? 'X · SPIN     Z · GRAB     C · FLIP     —     Release to level out'
        : run.time < 12
          ? 'Carve across the white wake to launch. Try holding Z in the air.'
          : '';
  const course = COURSES.find(c => c.id === courseId)!;
  $('#hud-course').textContent = course.name;
  $('#hud-course-label').textContent = course.label;
  if (isMultiplayer && network.room) {
    $('#crew-scores').innerHTML = `<div class="online-table"><h4>YOUR CREW · LIVE</h4>${[
      ...network.room.players,
    ]
      .sort((a, b) => b.state.score - a.state.score)
      .map(
        (p, i) =>
          `<div class="online-score ${p.id === network.id ? 'me' : ''}"><span>${i + 1}. ${esc(p.name)}</span><strong>${number(p.state.score)}</strong></div>`,
      )
      .join('')}</div>`;
  }
  if (run.event.id !== lastEvent) {
    lastEvent = run.event.id;
    const event = run.event;
    audio.play(event.type);
    clearTimeout(eventTimer);
    if (event.type !== 'launch') {
      $('#trick-pop').className = `trick-pop visible ${event.type === 'wipeout' ? 'crash' : ''}`;
      $('#trick-pop').innerHTML =
        `<small>${event.type === 'wipeout' ? 'A LITTLE RESET' : event.type === 'pickup' ? 'NICE LINE' : 'CLEAN LANDING'}</small><strong>${event.points ? `+${number(event.points)}` : 'Shake it off.'}</strong><span>${esc(event.text)}</span>`;
      eventTimer = window.setTimeout(() => $('#trick-pop').classList.remove('visible'), 2000);
    }
  }
}

const modal = $('#modal') as HTMLDialogElement;
function openModal(kind: 'settings' | 'pause' | 'quit') {
  if (screen === 'playing' && !isMultiplayer) paused = true;
  controls.enabled = false;
  controls.clear();
  if (kind === 'settings')
    modal.innerHTML = `<div class="panel-head"><div><div class="eyebrow">YOUR KIND OF FLOW</div><h2>Make yourself at home.</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close settings">${icon('close')}</button></div><label class="setting"><span>Master volume<small>Ocean, music, and effects</small></span><input type="range" id="volume" min="0" max="100" value="${Math.round(profile.settings.volume * 100)}" /></label><label class="setting"><span>Island soundtrack<small>Original mellow electronic music</small></span><input type="checkbox" id="music" ${profile.settings.music ? 'checked' : ''} /></label><label class="setting"><span>Graphics quality<small>Choose low for a lighter ride</small></span><select id="quality"><option value="high" ${profile.settings.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${profile.settings.quality === 'low' ? 'selected' : ''}>Low</option></select></label><label class="setting"><span>Reduce camera motion<small>Keep things a little steadier</small></span><input type="checkbox" id="reduced-motion" ${profile.settings.reducedMotion ? 'checked' : ''} /></label><p class="help-footnote" style="margin-top:17px;font-size:10px">Your progress saves automatically in this browser.</p><div class="modal-actions"><button class="button secondary" data-action="fullscreen">Toggle fullscreen</button><button class="button" data-action="close-modal">All good ${icon('check')}</button></div>`;
  if (kind === 'pause')
    modal.innerHTML = `<div class="eyebrow">TAKE A BREATHER</div><h2>${isMultiplayer ? 'Your crew is still riding.' : 'The ocean can wait.'}</h2><p>${isMultiplayer ? 'Online sessions keep running while this menu is open. Return to keep your line.' : 'Your solo session is paused. Come back when you’re ready to catch the next wake.'}</p><div class="modal-actions"><button class="button secondary" data-action="quit">Back to shore</button><button class="button" data-action="close-modal">Keep riding ${icon('play')}</button></div><div style="margin-top:18px"><button class="text-button" data-action="settings">Audio &amp; graphics settings</button></div>`;
  if (kind === 'quit')
    modal.innerHTML = `<div class="eyebrow">HEADING IN?</div><h2>Call it a day?</h2><p>Credits and XP are banked at the end of a full run. Leaving now means this session’s points won’t be saved.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Keep riding</button><button class="button" data-action="confirm-quit">Back to shore ${icon('arrow')}</button></div>`;
  if (!modal.open) modal.showModal();
}
function closeModal() {
  modal.close();
  paused = false;
  accumulator = 0;
  controls.clear();
  controls.enabled = screen === 'playing' && performance.now() >= countdownEnd;
}
modal.addEventListener('cancel', event => {
  event.preventDefault();
  closeModal();
});
modal.addEventListener('click', event => {
  if (event.target === modal) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeModal();
  }
});
controls.onPause = () => {
  if (modal.open) closeModal();
  else if (screen === 'playing') openModal('pause');
  else if (screen !== 'home') navigate('home');
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (screen === 'playing' && !isMultiplayer && !modal.open) openModal('pause');
    audio.suspend();
  } else void audio.unlock();
});
window.addEventListener('blur', () => {
  if (screen === 'playing' && !isMultiplayer && !modal.open) openModal('pause');
});
window.addEventListener('gamepadconnected', () => {
  gamepadSeen = true;
  toast('Gamepad connected. Left stick to carve · A jump · X spin · B grab · Y flip.');
});

async function roomAction(join: boolean) {
  const name = $<HTMLInputElement>('#player-name').value.trim().slice(0, 18) || 'Wave Rider';
  const code = $<HTMLInputElement>('#room-code').value.trim().toUpperCase();
  const chosen = $<HTMLSelectElement>('#room-course').value as CourseId;
  if (join && !/^[A-F0-9]{6}$/.test(code)) {
    toast('Enter a six-character room code, using 0–9 and A–F.');
    return;
  }
  profile.name = name;
  persist();
  busy = true;
  document
    .querySelectorAll<HTMLButtonElement>('[data-action=create-room],[data-action=join-room]')
    .forEach(b => {
      b.disabled = true;
      b.textContent = 'Connecting…';
    });
  try {
    await network.connect();
    network.send(
      join
        ? { type: 'join', code, name, board: profile.board, rider: profile.rider }
        : { type: 'create', name, board: profile.board, rider: profile.rider, course: chosen },
    );
  } catch (error) {
    busy = false;
    toast((error as Error).message);
    render();
  }
}
network.onError = message => {
  busy = false;
  toast(message);
  if (screen === 'multiplayer') render();
};
network.onDisconnect = () => {
  busy = false;
  closeModal();
  controls.clear();
  isMultiplayer = false;
  ocean.clearRemote();
  run = null;
  navigate('multiplayer');
  toast('Connection lost. Rejoin your crew with their room code.');
};
network.onRoom = room => {
  busy = false;
  courseId = room.course;
  ocean.setCourse(courseId);
  if ((room.phase === 'countdown' || room.phase === 'playing') && currentRound !== room.roundId) {
    currentRound = room.roundId;
    completedRound = '';
    result = undefined;
    runId = `${room.roundId}.${network.id}`;
    isMultiplayer = true;
    screen = 'playing';
    lastEvent = 0;
    lastCount = -1;
    paused = false;
    countdownEnd = performance.now() + Math.max(0, room.startAt - (Date.now() + network.offset));
    $('#trick-pop').classList.remove('visible');
    closeModal();
    audio.setPlaying(true);
    render();
  }
  if (room.phase === 'lobby' || (room.phase === 'finished' && screen === 'multiplayer')) {
    const signature = room.code + room.host + room.players.map(p => p.id).join(',');
    if (signature !== lobbySignature || screen !== 'lobby') {
      lobbySignature = signature;
      screen = 'lobby';
      run = null;
      render();
    }
    return;
  }
  const me = room.players.find(p => p.id === network.id);
  if (
    me &&
    (room.phase === 'countdown' ||
      room.phase === 'playing' ||
      (room.phase === 'finished' &&
        completedRound !== room.roundId &&
        currentRound === room.roundId))
  ) {
    run = me.state;
    ocean.updateRemote(room.players.filter(p => p.id !== network.id));
    if (room.phase === 'finished' && completedRound !== room.roundId) {
      completedRound = room.roundId;
      closeModal();
      finishRun();
    }
  }
};

app.addEventListener(
  'pointerdown',
  () => {
    void audio.unlock();
  },
  { once: true },
);
app.addEventListener('click', async event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  void audio.unlock();
  if (action !== 'mute') audio.play('click');
  if (['home', 'locker', 'rankings', 'how', 'multiplayer'].includes(action || '')) {
    navigate(action as Screen);
    return;
  }
  if (action === 'course') {
    courseId = button.dataset.course as CourseId;
    ocean.setCourse(courseId);
    render();
  }
  if (action === 'ride') {
    startSolo();
  }
  if (action === 'boards' || action === 'riders') {
    lockerTab = action === 'boards' ? 'board' : 'rider';
    render();
  }
  if (action === 'equip') {
    const item = [...BOARDS, ...RIDERS].find(x => x.id === button.dataset.item)!;
    const status = buyOrEquip(profile, item, lockerTab);
    if (status === 'insufficient') {
      toast('A few more waves and this one is yours.');
      return;
    }
    persist();
    ocean.equip(profile.board, profile.rider);
    if (status === 'bought') audio.play('buy');
    toast(
      `${item.name} ${status === 'bought' ? 'unlocked and equipped' : 'equipped'}. Looking good.`,
    );
    render();
  }
  if (action === 'settings' || action === 'pause') openModal(action);
  if (action === 'close-modal') closeModal();
  if (action === 'quit') openModal('quit');
  if (action === 'confirm-quit') {
    closeModal();
    network.leave();
    isMultiplayer = false;
    ocean.clearRemote();
    navigate('home');
  }
  if (action === 'mute') {
    if (profile.settings.volume > 0) {
      lastVolume = profile.settings.volume;
      profile.settings.volume = 0;
    } else profile.settings.volume = lastVolume;
    audio.configure(profile.settings.volume, profile.settings.music);
    soundButtons();
    persist();
  }
  if (action === 'fullscreen') {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Fullscreen is unavailable in this browser view.');
    }
  }
  if (action === 'create-room' || action === 'join-room') await roomAction(action === 'join-room');
  if (action === 'start-room') network.send({ type: 'start' });
  if (action === 'leave-room') {
    network.leave();
    isMultiplayer = false;
    ocean.clearRemote();
    run = null;
    navigate('home');
  }
  if (action === 'back-lobby' && network.room) {
    screen = 'lobby';
    run = null;
    render();
  }
  if (action === 'copy-invite' && network.room) {
    const link = `${location.origin}/?room=${network.room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied. Share it with your crew.');
    } catch {
      toast(`Room code: ${network.room.code} · Open this server address on your friend’s device.`);
    }
  }
});
app.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'volume') {
    profile.settings.volume = Number(input.value) / 100;
    audio.configure(profile.settings.volume, profile.settings.music);
    soundButtons();
  }
});
app.addEventListener('change', event => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'music') profile.settings.music = input.checked;
  if (input.id === 'quality') profile.settings.quality = input.value === 'low' ? 'low' : 'high';
  if (input.id === 'reduced-motion') profile.settings.reducedMotion = input.checked;
  if (['music', 'quality', 'reduced-motion', 'volume'].includes(input.id)) {
    configure();
    persist();
  }
});
app.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.target as HTMLElement).id === 'room-code')
    void roomAction(true);
});

let lastTime = performance.now();
function frame(time: number) {
  const dt = Math.min(0.06, (time - lastTime) / 1000);
  lastTime = time;
  if (screen === 'playing' && run) {
    const count = countdownEnd - time;
    if (count > 0) {
      const value = Math.ceil(count / 1000);
      if (value !== lastCount) {
        lastCount = value;
        audio.play('count');
        $('#countdown').innerHTML =
          `<div class="countdown"><strong>${value > 3 ? 3 : value}</strong><small>FIND YOUR LINE</small></div>`;
      }
    } else {
      if (lastCount !== 0) {
        lastCount = 0;
        $('#countdown').innerHTML = '';
        controls.enabled = !modal.open;
      }
      const input = controls.read();
      if (isMultiplayer) {
        if (time - lastNetworkInput >= 35) {
          network.send({ type: 'input', input });
          lastNetworkInput = time;
        }
      } else if (!paused) {
        accumulator += dt;
        while (accumulator >= FIXED_DT) {
          stepRun(run, input, FIXED_DT, COURSES.find(c => c.id === courseId)!.seed);
          accumulator -= FIXED_DT;
        }
        if (run.finished) finishRun();
      }
      audio.motion(run.vx, run.airborne);
    }
    if (time - lastHud > 65) {
      updateHud();
      lastHud = time;
    }
  }
  ocean.update(
    dt,
    screen === 'playing' ? run : null,
    screen === 'playing' ? 'play' : screen === 'locker' ? 'shop' : 'menu',
  );
  requestAnimationFrame(frame);
}
configure();
ocean.setCourse(courseId);
render();
requestAnimationFrame(frame);

// Expose read-only diagnostics for automated playtests. No progress or score mutation hooks.
Object.defineProperty(window, '__SURFER_GLIDE__', {
  value: {
    get screen() {
      return screen;
    },
    get run() {
      return run ? structuredClone(run) : null;
    },
    get profile() {
      return structuredClone(profile);
    },
    get room() {
      return network.room ? structuredClone(network.room) : null;
    },
    get gamepad() {
      return gamepadSeen;
    },
    get ready() {
      return true;
    },
  },
});
