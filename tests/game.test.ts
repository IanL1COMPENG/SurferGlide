import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  neutralInput,
  FIXED_DT,
  RUN_DURATION,
  rewardFor,
  sanitizeInput,
  trackObject,
} from '../src/core/game.ts';
import { buyOrEquip, completeRun, newProfile } from '../src/core/profile.ts';
import { BOARDS, RIDERS, rankFor } from '../src/core/catalog.ts';

test('a full deterministic run ends at 90 seconds and only awards actual pickups without input', () => {
  const a = createRun(),
    b = createRun();
  for (let i = 0; i < 5500; i++) {
    stepRun(a, neutralInput());
    stepRun(b, neutralInput());
  }
  assert.deepEqual(a, b);
  assert.equal(a.time, RUN_DURATION);
  assert.equal(a.finished, true);
  assert.ok(a.distance <= RUN_DURATION * 19 + 1);
  assert.equal(a.score, a.pickups * 100);
  assert.equal(a.cleanLandings, 0);
  const snapshot = structuredClone(a);
  stepRun(a, { ...neutralInput(), jump: true });
  assert.deepEqual(a, snapshot);
});

test('carving through the wake launches the rider and clean grabs bank combo points', () => {
  const s = createRun();
  for (let i = 0; i < 140 && !s.airborne; i++) stepRun(s, { ...neutralInput(), steer: 1 });
  assert.equal(s.airborne, true);
  assert.ok(s.vy > 0);
  assert.equal(s.launchBonus, true);
  while (s.airborne) stepRun(s, { ...neutralInput(), grab: true });
  assert.equal(s.cleanLandings, 1);
  assert.equal(s.wipeouts, 0);
  assert.equal(s.score, 350);
  assert.equal(s.combo, 1.5);
  assert.match(s.event.text, /Indy Grab/);
});

test('charged jump works away from a wake and a released rotation settles before touchdown', () => {
  const s = createRun();
  for (let i = 0; i < 65; i++) stepRun(s, { ...neutralInput(), jump: true });
  assert.ok(s.charge > 0.99);
  stepRun(s, neutralInput());
  assert.equal(s.airborne, true);
  for (let i = 0; i < 36; i++) stepRun(s, { ...neutralInput(), spin: true });
  while (s.airborne) stepRun(s, neutralInput());
  assert.equal(s.cleanLandings, 1);
  assert.equal(s.wipeouts, 0);
  assert.ok(s.score >= 250);
});

test('unsafe landings wipe out and reset the multiplier', () => {
  const s = createRun();
  s.airborne = true;
  s.y = 0.01;
  s.vy = -4;
  s.flip = Math.PI;
  s.combo = 4;
  stepRun(s, { ...neutralInput(), flip: true });
  assert.equal(s.wipeouts, 1);
  assert.equal(s.combo, 1);
  assert.ok(s.wipeout > 0);
  assert.equal(s.score, 0);
});

test('flow rings cannot be collected repeatedly and buoys can be jumped', () => {
  const s = createRun();
  const ring = trackObject(0, 41);
  s.distance = ring.distance - 1;
  s.x = ring.x;
  for (let i = 0; i < 10; i++) stepRun(s, neutralInput());
  assert.equal(s.pickups, 1);
  assert.equal(s.score, 100);
  const buoy = trackObject(3, 41);
  s.distance = buoy.distance - 1;
  s.x = buoy.x;
  s.y = 2;
  s.airborne = true;
  for (let i = 0; i < 8; i++) stepRun(s, neutralInput());
  assert.equal(s.wipeouts, 0);
});

test('credit rewards, purchases, and equip operations conserve currency', () => {
  const p = newProfile();
  p.credits = 1000;
  assert.equal(buyOrEquip(p, BOARDS[1], 'board'), 'bought');
  assert.equal(p.credits, 350);
  assert.equal(p.board, 'coral');
  assert.equal(buyOrEquip(p, BOARDS[1], 'board'), 'equipped');
  assert.equal(p.credits, 350);
  assert.equal(buyOrEquip(p, RIDERS[1], 'rider'), 'insufficient');
  assert.equal(p.credits, 350);
  assert.equal(p.rider, 'kai');
  assert.equal(rewardFor({ score: 4500, pickups: 4, cleanLandings: 5 }), 610);
});

test('only finished runs award rewards, and duplicate settlement is idempotent', () => {
  const p = newProfile();
  const s = createRun();
  s.score = 5000;
  s.cleanLandings = 5;
  assert.equal(completeRun(p, s, 'lagoon', 'round-one'), undefined);
  assert.equal(p.credits, 0);
  s.finished = true;
  const record = completeRun(p, s, 'lagoon', 'round-one');
  assert.equal(record?.credits, 600);
  assert.equal(p.xp, 5000);
  assert.equal(p.best, 5000);
  assert.equal(completeRun(p, s, 'lagoon', 'round-one'), undefined);
  assert.equal(p.credits, 600);
  assert.equal(p.runs.length, 1);
});

test('rank thresholds advance correctly and invalid input is neutralized', () => {
  assert.equal(rankFor(0).name, 'Beachcomber');
  assert.equal(rankFor(7000).name, 'Wave Rider');
  assert.equal(rankFor(999999).progress, 1);
  assert.equal(rankFor(999999).name, 'Glide Elite');
  assert.deepEqual(
    sanitizeInput({ steer: Infinity, jump: 'yes' as unknown as boolean }),
    neutralInput(),
  );
  assert.equal(sanitizeInput({ steer: 300 }).steer, 1);
  assert.deepEqual(sanitizeInput(null), neutralInput());
});

test('a carving bot completes a rewarding run within the arena', () => {
  const s = createRun();
  let direction = 1;
  for (let i = 0; i < RUN_DURATION / FIXED_DT + 5; i++) {
    if (s.x > 6) direction = -1;
    if (s.x < -6) direction = 1;
    stepRun(s, { ...neutralInput(), steer: direction, grab: true });
    assert.ok(Number.isFinite(s.x) && Math.abs(s.x) <= 10.5);
    assert.ok(s.combo >= 1 && s.combo <= 5);
  }
  assert.equal(s.finished, true);
  assert.ok(s.cleanLandings > 10);
  assert.ok(s.score > 5000);
});
