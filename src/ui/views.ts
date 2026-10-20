import { BOARDS, RIDERS, COURSES, type CourseId } from '../core/catalog.ts';
import type { Profile } from '../core/profile.ts';
import { BOARD_EFFECTS } from '../graphics/assets.ts';

type Icon = (name: string) => string;
const num = (n: number) => n.toLocaleString('en-US');

export function homeView(courseId: CourseId, profile: Profile, icon: Icon) {
  const course = COURSES.find(c => c.id === courseId)!;
  const rider = RIDERS.find(r => r.id === profile.rider)!;
  const board = BOARDS.find(b => b.id === profile.board)!;
  return `<section class="home">
    <div class="eyebrow">☀ &nbsp; YOUR NEXT GREAT DAY STARTS HERE</div>
    <h1>Make some<br><em>waves!</em><span class="title-spark" aria-hidden="true">✦</span></h1>
    <p class="intro">Big air. Wild tricks. Ridiculously good times.<br>Grab your board and make a splash.</p>
    <div class="hero-actions"><button class="button" data-action="ride">Let’s ride! ${icon('arrow')}</button><button class="button secondary" data-action="multiplayer">Bring your crew ${icon('people')}</button></div>
    <div class="course-heading"><p class="course-label">PICK YOUR PLAYGROUND</p><span>3 islands. Endless possibilities.</span></div>
    <div class="course-list">${COURSES.map((c, i) => `<button class="course-card ${c.id === courseId ? 'selected' : ''}" data-action="course" data-course="${c.id}" aria-pressed="${c.id === courseId}"><span class="course-icon">${icon(c.icon)}</span><span class="course-number">0${i + 1} ${c.id === courseId ? '· LET’S GO!' : ''}</span><strong>${c.name}</strong>${c.id === courseId ? `<i class="course-check">${icon('check')}</i>` : ''}</button>`).join('')}</div>
  </section>
  <div class="hero-stamp" aria-hidden="true"><span>MORE SPLASH.</span><strong>LESS<br>ORDINARY.</strong><span>✦ GOOD VIBES ONLY ✦</span></div>
  <div class="rider-nameplate"><img src="/previews/rider-${rider.id}.png" alt=""/><div><small>YOUR RIDE, YOUR STYLE</small><strong>${rider.name} <span>+</span> ${board.name}</strong><button data-action="locker">Mix it up ${icon('arrow')}</button></div></div>
  <div class="location-label"><span class="location-pin">${icon(course.icon)}</span><div><small>YOU’RE HEADING TO</small><strong>${course.name}</strong><span>${course.difficulty} · 90-second session</span></div></div>`;
}

export function lockerView(profile: Profile, kind: 'board' | 'rider', icon: Icon) {
  const items = kind === 'board' ? BOARDS : RIDERS;
  return `<div class="panel-wrap"><section class="panel locker-panel">
    <div class="panel-head"><div><div class="eyebrow">✦ LOOK GOOD. GLIDE GREAT.</div><h2>A little more <em>you.</em></h2><p>Fresh boards. Big personalities. Every unlock comes with a little extra wow.</p></div><button class="icon-button" data-action="home" aria-label="Back to the ocean">${icon('close')}</button></div>
    <div class="shop-toolbar"><div class="tab-row"><button data-action="boards" class="${kind === 'board' ? 'active' : ''}">Wakeboards <span>${BOARDS.length}</span></button><button data-action="riders" class="${kind === 'rider' ? 'active' : ''}">Riders <span>${RIDERS.length}</span></button></div><p class="shop-fair-play">${icon('check')} All style. Same playing field.</p></div>
    <div class="item-grid">${items
      .map((item, i) => {
        const owned = profile.owned.includes(item.id),
          equipped = profile[kind] === item.id,
          affordable = profile.credits >= item.price;
        const effect = kind === 'board' ? BOARD_EFFECTS[item.id] : null;
        return `<article class="gear-card ${equipped ? 'equipped' : ''} rarity-${item.rarity.toLowerCase()}" style="--item-color:${item.color};--item-accent:${item.accent};--card-index:${i}">
        <div class="gear-topline"><span class="rarity ${item.rarity}">${item.rarity === 'Legendary' ? '✦ ' : item.rarity === 'Epic' ? '✧ ' : ''}${item.rarity}</span>${equipped ? `<span class="equipped-badge">${icon('check')} EQUIPPED</span>` : owned ? '<span class="owned-badge">IN YOUR LOCKER</span>' : ''}</div>
        <button class="gear-visual ${kind === 'rider' ? 'character-visual' : ''}" data-action="inspect" data-item="${item.id}" data-kind="${kind}" aria-label="Preview ${item.name} in 3D"><div class="preview-orbit" aria-hidden="true"></div><img src="/previews/${kind}-${item.id}.png" alt="${item.name} ${kind === 'board' ? 'wakeboard' : 'character'} model made in Blender" loading="lazy"/><span class="preview-pill">Drag &amp; spin in 3D ${icon('external')}</span></button>
        <h3>${item.name}</h3><p>${item.subtitle}</p>
        ${effect ? `<div class="effect-tag"><b>${effect.symbol}</b> ${effect.name} <span>TRAIL EFFECT</span></div>` : `<div class="effect-tag"><b>★</b> ${item.id === 'kai' ? 'The island original' : item.id === 'luna' ? 'Space-bun superstar' : item.id === 'reef' ? 'Laid-back wave chaser' : 'Sunshine energy'} <span>RIDER</span></div>`}
        <button class="button ${equipped ? 'equipped-button' : !affordable && !owned ? 'locked-button' : 'shop-buy'}" data-action="equip" data-item="${item.id}" data-kind="${kind}" ${equipped || (!affordable && !owned) ? 'disabled' : ''}><span>${equipped ? 'Ready to rip!' : owned ? 'Equip & go' : !affordable ? 'Keep riding to unlock' : 'Make it yours'}</span><span>${owned ? icon(equipped ? 'check' : 'arrow') : `<span class="coin">G</span> ${num(item.price)}`}</span></button>
      </article>`;
      })
      .join('')}</div>
    <div class="shop-rewards"><span class="coin">G</span><p><strong>Good rides = great gear.</strong> Finish sessions to bank credits. Collect rings and land five clean jumps for bonus rewards.</p><button class="text-button" data-action="ride">Earn some credits ${icon('arrow')}</button></div>
  </section></div>`;
}
