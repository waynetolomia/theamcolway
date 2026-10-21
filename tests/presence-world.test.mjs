import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import * as THREE from '../public/game/vendor/three.module.min.js';
import { SeaWorld } from '../public/game/world.js';
import { CAMPUS, DORM, ATLANTIC } from '../public/game/campus.js';

// Exercise the real Three.js geometry, animation and raycaster without a GPU,
// browser, server or network. Only canvas painting and the renderer are stubbed.
const { window, document } = parseHTML('<html><body></body></html>');
globalThis.window = window;
globalThis.document = document;
globalThis.cancelAnimationFrame = () => {};
const paints = new WeakMap();
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!paints.has(this)) {
    const ctx = { calls: [], clearRect() {}, beginPath() {}, roundRect() {}, fill() {}, moveTo() {}, lineTo() {},
      fillText(text) { this.calls.push(text); } };
    paints.set(this, ctx);
  }
  return paints.get(this);
};

let passed = 0;
function test(name, work) { work(); passed++; console.log(`✓ ${name}`); }
const look = { name: 'Napat', gender: 'male', major: 'deck', skin: '#b97850', hairColor: '#292327',
  hairStyle: 'crop', outfit: 'cadet', body: 'regular', accessory: 'none', accent: '#198879' };
const movement = (x = 0, extra = {}) => ({ x, z: 0, yaw: 0, moving: false, running: false, ...extra });
function harness() {
  const world = Object.create(SeaWorld.prototype), scene = new THREE.Scene(), remote = new THREE.Group();
  scene.add(remote);
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  canvas.setPointerCapture = canvas.releasePointerCapture = () => {};
  Object.assign(world, { canvas, scene, mode: 'world', quality: 'high', paused: false,
    callbacks: {}, _resources: new Set(), _geometries: new Map(), _materials: new Map(),
    _remotePlayers: new Map(), _remotePool: [], _remoteGroup: remote,
    _position: new THREE.Vector3(0, 0, 0), _zone: 'campus', _zoneConfig: CAMPUS,
    _movementSpeed: 0, _time: 0, _lastMove: 0, _keys: new Set(), _touch: { x: 0, z: 0, run: false },
    _path: [], _cameraInput: 0, _cameraAngle: Math.PI / 6, _cameraTargetAngle: Math.PI / 6,
    _cameraLook: new THREE.Vector3(), _collision: [], _staff: [], _npcs: [], _stations: [],
    _canopies: [], _facades: [], _stationRings: [], _trainingGateModels: [], _listeners: [],
    _ray: new THREE.Raycaster(), _pointer: new THREE.Vector2(),
    _groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    renderer: { shadowMap: {}, setPixelRatio() {}, dispose() {} },
    creator: new THREE.Group(), destinationMarker: new THREE.Object3D(), nearArrow: new THREE.Object3D(),
    _resize() {}, _checkNear() {}, _updateCamera() {},
  });
  world.worldCamera = new THREE.PerspectiveCamera(43, 800 / 600, .1, 240);
  world.worldCamera.position.set(0, 7, 12); world.worldCamera.lookAt(0, 2, 0); world.worldCamera.updateMatrixWorld();
  world.creatorCamera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 50);
  world.camera = world.worldCamera;
  world._zones = Object.fromEntries(Object.entries({ campus: CAMPUS, dorm: DORM, atlantic: ATLANTIC }).map(([id, config]) => {
    const group = new THREE.Group(); scene.add(group);
    return [id, { group, config, stations: [], collision: [], npcs: [{ id: `${id}-npc` }], staff: [],
      stationRings: [], canopies: [], facades: [], nearArrow: new THREE.Object3D(), destinationMarker: new THREE.Object3D(), radar: null }];
  }));
  world.world = world._zones.campus.group;
  world._syncDisplayedCharacter = () => {};
  world.player = world._buildAvatar(look);
  scene.add(world.player);
  let now = 0;
  world._remoteNow = () => now;
  return { world, at(value) { now = value; world._time = value / 1000; },
    add(k = 'cadet-a', x = 0, appearance = look) {
      assert.equal(world.addRemotePlayer(k, appearance, 'Napat · DECK · Y1'), true);
      assert.equal(world.updateRemotePlayer(k, movement(x)), true);
      return world._remotePlayers.get(k);
    },
    draw(value = now) { now = value; world._time = value / 1000; world._updateRemotePlayers(); },
  };
}

test('Remote joins wait for positions and render only the nearest 30, or 15 on low quality', () => {
  const h = harness(), w = h.world;
  w.addRemotePlayer('waiting', look, 'Waiting · DECK · Y1');
  h.draw(); assert.equal(w._remoteGroup.children.length, 0);
  for (let i = 0; i < 40; i++) h.add(`cadet-${i}`, i * .8);
  h.draw();
  assert.equal(w._remoteGroup.children.length, 30);
  assert.ok(w._remotePlayers.get('cadet-0').actor);
  assert.equal(w._remotePlayers.get('cadet-39').actor, null);
  w.setQuality('low');
  assert.equal(w._remoteGroup.children.length, 15);
  assert.equal(w._remotePool.length, 0, 'Lower quality releases unused private materials immediately.');
  w._position.x = 32; h.draw();
  assert.ok(w._remotePlayers.get('cadet-39').actor);
  assert.equal(w._remotePlayers.get('cadet-0').actor, null);
  assert.equal(w._remoteGroup.children.length, 15);
  w.setQuality('high'); assert.equal(w._remoteGroup.children.length, 30);
  w.dispose();
});

test('Buffered positions trail by 120 ms and yaw crosses the short side of the circle', () => {
  const h = harness(), w = h.world;
  w.addRemotePlayer('cadet-a', look, 'Napat · DECK · Y1');
  w.updateRemotePlayer('cadet-a', movement(0, { yaw: 170 * Math.PI / 180, moving: true, t: 1000 }));
  h.at(125);
  w.updateRemotePlayer('cadet-a', movement(1, { yaw: -170 * Math.PI / 180, moving: true, t: 1125 }));
  h.draw(182.5);
  const player = w._remotePlayers.get('cadet-a');
  assert.ok(Math.abs(player.actor.avatar.position.x - .5) < 1e-9);
  assert.ok(Math.abs(Math.abs(player.actor.avatar.rotation.y) - Math.PI) < 1e-9);
  h.draw(245); assert.equal(player.actor.avatar.position.x, 1);
  h.draw(900); assert.equal(player.actor.avatar.position.x, 1, 'No extrapolation through walls when a snapshot is delayed.');
  assert.equal(w._interpolateRemotePlayer(player, 900).moving, false, 'A stale moving pose settles instead of walking forever.');
  w.dispose();
});

test('Invalid and stale remote states are ignored and coordinates obey the current zone', () => {
  const h = harness(), w = h.world;
  h.add(); const p = w._remotePlayers.get('cadet-a');
  assert.equal(w.updateRemotePlayer('cadet-a', movement(NaN)), false);
  assert.equal(w.updateRemotePlayer('missing', movement()), false);
  h.at(125);
  assert.equal(w.updateRemotePlayer('cadet-a', movement(1000, { z: -1000, t: 2 })), true);
  assert.equal(p.samples.at(-1).x, CAMPUS.bounds.maxX);
  assert.equal(p.samples.at(-1).z, CAMPUS.bounds.minZ);
  assert.equal(w.updateRemotePlayer('cadet-a', movement(0, { t: 1 })), false);
  assert.equal(w.updateRemotePlayer('cadet-a', movement(0, { t: 2 })), false);
  assert.equal(p.samples.at(-1).x, CAMPUS.bounds.maxX);
  w.dispose();
});

test('A cadet beginning to walk after a quiet interval still gets a normal interpolation window', () => {
  const h = harness(), w = h.world, p = h.add(); h.draw();
  h.at(10000); w.updateRemotePlayer('cadet-a', movement(.5, { moving: true }));
  h.draw(); assert.ok(p.actor.avatar.position.x < .03);
  h.draw(10060); assert.ok(p.actor.avatar.position.x > .2 && p.actor.avatar.position.x < .3);
  h.draw(10120); assert.equal(p.actor.avatar.position.x, .5);
  w.dispose();
});

test('Departures reuse avatar objects and look changes dispose private materials without touching shared geometry', () => {
  const h = harness(), w = h.world, p = h.add(); h.draw();
  const avatar = p.actor.avatar, material = avatar.userData.body.material, geometry = avatar.userData.body.geometry;
  let materialDisposed = 0, geometryDisposed = 0, localDisposed = 0;
  material.addEventListener('dispose', () => materialDisposed++);
  geometry.addEventListener('dispose', () => geometryDisposed++);
  w.player.userData.body.material.addEventListener('dispose', () => localDisposed++);
  w.showRemoteBubble('cadet-a', 'Hello, cadet!'); w.playRemoteGesture('cadet-a', 'wave');
  assert.equal(w.removeRemotePlayer('cadet-a'), true);
  assert.equal(w._remoteGroup.children.length, 0); assert.equal(w._remotePool.length, 1);
  assert.equal(w._remotePool[0].bubble.visible, false);
  assert.equal(materialDisposed, 0); assert.equal(geometryDisposed, 0);
  const same = h.add('cadet-b'); h.draw();
  assert.equal(same.actor.avatar, avatar); assert.equal(same.actor.avatar.userData.body.material, material);
  assert.equal(same.actor.bubble.visible, false);
  w.addRemotePlayer('cadet-b', { ...look, skin: '#98603e', outfit: 'coverall' }, 'Another · ENGINE · Y2');
  assert.equal(same.actor.avatar, avatar);
  assert.equal(materialDisposed, 1); assert.equal(geometryDisposed, 0); assert.equal(localDisposed, 0);
  const resourceCount = w._resources.size;
  for (let i = 0; i < 20; i++) {
    w.showRemoteBubble('cadet-b', i % 2 ? 'Roger.' : 'Well done!');
    w.addRemotePlayer('cadet-b', { ...look, skin: '#98603e', outfit: 'coverall' }, `Napat ${i} · DECK · Y1`);
  }
  assert.equal(w._resources.size, resourceCount, 'Labels and bubbles repaint their pooled canvas and texture.');
  w.dispose();
  assert.equal(geometryDisposed, 1); assert.equal(localDisposed, 1);
  assert.equal(w._remotePool.length, 0); assert.equal(w._remotePlayers.size, 0); assert.equal(w._resources.size, 0);
});

test('Speech is plain painted text for four seconds, and mute can clear both a bubble and a pose immediately', () => {
  const h = harness(), w = h.world, p = h.add(); h.draw();
  const text = '<img src=x onerror=alert(1)> · Roger.';
  w.showRemoteBubble('cadet-a', text);
  assert.equal(p.actor.bubble.userData.canvas.getContext('2d').calls.at(-1), text);
  assert.equal(document.querySelector('img'), null);
  h.draw(3999); assert.equal(p.actor.bubble.visible, true);
  h.draw(4000); assert.equal(p.actor.bubble.visible, false);
  w.showRemoteBubble('cadet-a', 'Stand by.'); w.showRemoteBubble('cadet-a', '');
  assert.equal(p.actor.bubble.visible, false);
  for (const id of ['wave', 'salute', 'thumbs-up', 'cheer']) assert.equal(w.playRemoteGesture('cadet-a', id), true);
  assert.equal(w.playRemoteGesture('cadet-a', 'invented'), false);
  w.playRemoteGesture('cadet-a', 'wave'); h.draw(4400);
  assert.notEqual(p.actor.avatar.userData.arms[0].rotation.z, -.09);
  w.cancelRemoteGesture('cadet-a');
  assert.equal(p.gesture, null); assert.equal(p.actor.avatar.userData.arms[0].rotation.z, -.09);
  assert.equal(w.playGesture('thumbs-up'), 'thumbs-up');
  assert.equal(w.playGesture('jump'), null, 'World mode accepts only the fixed online emotes.');
  h.at(4700); w._applyGesture(); assert.ok(w._gesture);
  h.at(7000); w._applyGesture(); assert.equal(w._gesture, null);
  w.dispose();
});

test('A remote tap opens its card while drags and right-button camera rotation keep their existing behavior', () => {
  const h = harness(), w = h.world, p = h.add(); h.draw();
  const selections = [], routes = [];
  w.callbacks.onRemoteSelect = key => selections.push(key);
  w._routeTo = (x, z) => routes.push({ x, z });
  w._bindEvents(); w.scene.updateMatrixWorld(true);
  const projected = new THREE.Vector3(0, 1.9, .2).project(w.camera);
  const x = (projected.x + 1) * 400, y = (1 - projected.y) * 300;
  const pointer = (type, clientX = x, clientY = y, button = 0) => {
    const event = new window.Event(type); Object.assign(event, { clientX, clientY, button, pointerId: 1, pointerType: 'touch' });
    w.canvas.dispatchEvent(event);
  };
  pointer('pointerdown'); pointer('pointerup');
  assert.deepEqual(selections, ['cadet-a']); assert.equal(routes.length, 0);
  assert.equal(p.actor.avatar.userData.remoteKey, 'cadet-a');
  pointer('pointerdown'); pointer('pointermove', x + 8); pointer('pointerup', x + 8);
  assert.equal(selections.length, 1); assert.equal(routes.length, 0);
  const angle = w._cameraTargetAngle;
  pointer('pointerdown', x, y, 2); pointer('pointermove', x + 20, y, 2); pointer('pointerup', x + 20, y, 2);
  assert.ok(Math.abs(w._cameraTargetAngle - angle + .16) < 1e-9);
  assert.equal(selections.length, 1);
  w.removeRemotePlayer('cadet-a'); pointer('pointerdown'); pointer('pointerup');
  assert.equal(selections.length, 1); assert.equal(routes.length, 1);
  w.dispose();
});

test('The lightweight movement hook reports movement and a final stop without changing saved positions or the old save cadence', () => {
  const h = harness(), w = h.world, presence = [], saves = [];
  w.callbacks.onPresenceMove = state => presence.push(state);
  w.callbacks.onMove = state => saves.push(state);
  w._position.set(-10, 0, 20); w.setInput(1, 0, false); h.at(1000);
  w._movePlayer(.016); w._emitPresenceMove();
  assert.ok(Math.abs(w._position.x - (-10 + Math.cos(Math.PI / 6) * 4.25 * .016)) < 1e-9);
  assert.equal(presence.at(-1).moving, true); assert.equal(presence.at(-1).running, false);
  assert.deepEqual(Object.keys(saves[0]).sort(), ['x', 'z']); assert.equal(saves.length, 1);
  h.at(1016); w._movePlayer(.016); w._emitPresenceMove();
  assert.equal(saves.length, 1, 'Presence never raises the account/browser-save callback frequency.');
  w.setInput(0, 0, false); h.at(1032); w._movePlayer(.016); w._emitPresenceMove();
  assert.equal(presence.at(-1).moving, false);
  const count = presence.length; h.at(1048); w._movePlayer(.016); w._emitPresenceMove();
  assert.equal(presence.length, count, 'No callback for an unchanged idle state.');
  w.setInput(1, 0, true); h.at(1064); w._movePlayer(.016); w._emitPresenceMove();
  assert.equal(presence.at(-1).running, true);
  w.setPaused(true); assert.equal(presence.at(-1).moving, false); assert.equal(presence.at(-1).running, false);
  w.dispose();
});

test('Zone transitions and creator mode clear remote cadets and bubbles while retaining each zone’s existing NPC data', () => {
  const h = harness(), w = h.world;
  h.add(); h.draw(); w.showRemoteBubble('cadet-a', 'Over and out.');
  const dormNpcs = w._zones.dorm.npcs;
  assert.equal(w.setZone('dorm'), true);
  assert.equal(w._remotePlayers.size, 0); assert.equal(w._remoteGroup.children.length, 0);
  assert.equal(w._npcs, dormNpcs); assert.deepEqual(w.getPosition(), DORM.spawn);
  const dorm = h.add('dorm-cadet'); h.draw();
  assert.equal(dorm.actor.avatar.userData.appearance.outfit, 'casual');
  assert.equal(look.outfit, 'cadet', 'Displaying a remote dorm look never changes its saved profile.');
  w.setMode('creator');
  assert.equal(w._remotePlayers.size, 0); assert.equal(w._remoteGroup.visible, false);
  assert.ok(w._remotePool.every(actor => !actor.bubble.visible));
  w.dispose();
});

console.log(`Presence world checks passed: ${passed}; real Three.js behavior without WebGL or network.`);
