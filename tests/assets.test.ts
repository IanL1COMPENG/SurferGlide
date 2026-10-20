import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARDS, RIDERS } from '../src/core/catalog.ts';
import { BOARD_EFFECTS } from '../src/graphics/assets.ts';

function model(name: string) {
  const bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'glTF version 2');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'complete binary file');
  assert.ok(bytes.length < 1_000_000, `${name} stays below the 1 MB model budget`);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

test('every board has a real Blender model, a transparent preview, and a distinct effect', () => {
  const names = new Set();
  for (const board of BOARDS) {
    const gltf = model(`board-${board.id}`);
    assert.ok(gltf.meshes.length > 0);
    assert.ok(gltf.asset.generator.includes('Blender'));
    assert.ok(BOARD_EFFECTS[board.id]);
    names.add(BOARD_EFFECTS[board.id].name);
    checkPng(`board-${board.id}`);
  }
  assert.equal(names.size, BOARDS.length);
});

test('all four Blender characters have weighted skeletons and the nine runtime animation clips', () => {
  const required = [
    'Air',
    'CarveLeft',
    'CarveRight',
    'Cruise',
    'IndyGrab',
    'Land',
    'Pop',
    'Victory',
    'Wipeout',
  ];
  for (const rider of RIDERS) {
    const gltf = model(`rider-${rider.id}`);
    assert.equal(gltf.skins.length, 1);
    assert.equal(gltf.skins[0].joints.length, 13);
    assert.deepEqual(gltf.animations.map((a: { name: string }) => a.name).sort(), required);
    assert.ok(
      gltf.meshes.every((mesh: { primitives: { attributes: Record<string, number> }[] }) =>
        mesh.primitives.every(
          p =>
            typeof p.attributes.JOINTS_0 === 'number' && typeof p.attributes.WEIGHTS_0 === 'number',
        ),
      ),
    );
    checkPng(`rider-${rider.id}`);
  }
});

function checkPng(name: string) {
  const bytes = readFileSync(new URL(`../public/previews/${name}.png`, import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.ok(bytes.readUInt32BE(16) >= 320);
  assert.ok(bytes.readUInt32BE(20) >= 320);
  assert.equal(bytes[25], 6, 'preview retains alpha transparency');
}
