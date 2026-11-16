// The simulation: one ship, its bolts, three kinds of enemy, their shots, pickups
// and particles. It knows nothing about the screen or the keyboard — the caller
// passes a move direction, whether to fire, and an aim angle each fixed step, and
// gets back a bitmask of what happened. The same step runs the live game and the
// staged screenshots, so a screenshot shows real play.

import {
  BOLT,
  CELL,
  COMBO,
  ENEMY,
  FIELD,
  HULL,
  ORB,
  POOL,
  SHIELD,
  SHIP,
  STEP,
  WAVE,
  WIN_WAVE,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_KILL = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_PICKUP = 32;
export const EVENT_REPAIR = 64;

const TAU = Math.PI * 2;

function makeStars(random, count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      size: random.range(0.6, 2.2),
      twinkle: random.range(0, TAU),
      layer: random.pick([0.2, 0.45, 0.8]),
    });
  }
  return stars;
}

function makeNebulae(random) {
  return [
    { x: random.range(150, 500), y: random.range(80, 300), r: random.range(220, 320), color: '#3b1d6e' },
    { x: random.range(800, 1150), y: random.range(350, 620), r: random.range(200, 300), color: '#0d3a5c' },
    { x: random.range(500, 850), y: random.range(450, 650), r: random.range(160, 240), color: '#571b4d' },
  ];
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    wave: 1,
    hull: HULL,
    shield: false,
    combo: 0,
    comboTimer: 0,
    cells: 0,
    kills: 0,
    shake: 0,
    flash: 0,
    banner: 0,
    bannerText: '',
    phase: 'fight',
    spawnLeft: 0,
    spawnTimer: 0,
    ship: { x: 0, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2, fireTimer: 0, invuln: 0 },
    bolts: [],
    orbs: [],
    enemies: [],
    pickups: [],
    particles: [],
    texts: [],
    stars: makeStars(random, 130),
    nebulae: makeNebulae(random),
  };

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= POOL.particles) return;
      const angle = random.angle();
      const power = random.range(0.3, 1) * speed;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        life: random.range(0.3, 0.8),
        maxLife: 0.8,
        size: random.range(1.5, 3.5),
        color,
      });
    }
  }

  function addText(x, y, text, color) {
    if (state.texts.length >= POOL.texts) state.texts.shift();
    state.texts.push({ x, y, text, life: 1.1, color });
  }

  function multiplier() {
    return Math.min(COMBO.max, Math.max(1, state.combo));
  }

  function waveCount(wave) {
    return WAVE.baseCount + (wave - 1) * WAVE.perWave;
  }

  function spawnInterval(wave) {
    return Math.max(WAVE.minInterval, WAVE.spawnInterval * Math.pow(WAVE.intervalScale, wave - 1));
  }

  function pickKind(wave) {
    const roll = random.next();
    if (wave >= ENEMY.weaver.firstWave && roll < 0.2) return 'weaver';
    if (wave >= ENEMY.seeker.firstWave && roll < 0.5) return 'seeker';
    return 'drifter';
  }

  function spawnEnemy() {
    const kind = pickKind(state.wave);
    const spec = ENEMY[kind];
    const edge = random.int(0, 3);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = random.range(0, FIELD.width);
      y = -40;
    } else if (edge === 1) {
      x = FIELD.width + 40;
      y = random.range(0, FIELD.height);
    } else if (edge === 2) {
      x = random.range(0, FIELD.width);
      y = FIELD.height + 40;
    } else {
      x = -40;
      y = random.range(0, FIELD.height);
    }
    const aim = Math.atan2(FIELD.height / 2 - y, FIELD.width / 2 - x);
    const speed = spec.speed * random.range(0.8, 1.25);
    const enemy = {
      kind,
      x,
      y,
      vx: Math.cos(aim) * speed,
      vy: Math.sin(aim) * speed,
      hp: spec.hp,
      radius: spec.radius * random.range(0.9, 1.15),
      angle: random.angle(),
      spin: random.range(-1.5, 1.5),
      fireTimer: random.range(1.2, 2.4),
      hitFlash: 0,
      seed: random.next() * 1000,
    };
    if (kind === 'drifter') {
      const vertices = [];
      const points = 9;
      for (let i = 0; i < points; i += 1) {
        vertices.push(random.range(0.75, 1.15));
      }
      enemy.vertices = vertices;
    }
    state.enemies.push(enemy);
  }

  function dropPickup(x, y) {
    const roll = random.next();
    if (roll < SHIELD.dropChance) {
      state.pickups.push({ kind: 'shield', x, y, vx: random.range(-30, 30), vy: random.range(-30, 30) });
    } else if (roll < 0.68) {
      state.pickups.push({ kind: 'cell', x, y, vx: random.range(-40, 40), vy: random.range(-40, 40) });
    }
  }

  function killEnemy(index) {
    const enemy = state.enemies[index];
    const spec = ENEMY[enemy.kind];
    state.enemies.splice(index, 1);
    state.kills += 1;
    if (state.comboTimer > 0) state.combo += 1;
    else state.combo = 1;
    state.comboTimer = COMBO.window;
    const gained = spec.score * multiplier();
    state.score += gained;
    addText(enemy.x, enemy.y, `+${gained}`, '#ffd94d');
    burst(enemy.x, enemy.y, spec === ENEMY.drifter ? '#b8a6ff' : spec === ENEMY.seeker ? '#ff7a5c' : '#ff5fd0', 18, 260);
    dropPickup(enemy.x, enemy.y);
  }

  function hurtShip() {
    if (state.ship.invuln > 0) return EVENT_NONE;
    if (state.shield) {
      state.shield = false;
      state.ship.invuln = SHIP.invulnerable;
      burst(state.ship.x, state.ship.y, '#7dffb0', 16, 220);
      addText(state.ship.x, state.ship.y - 30, 'SHIELD DOWN', '#7dffb0');
      return EVENT_HIT;
    }
    state.hull -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.ship.invuln = SHIP.invulnerable;
    state.shake = 14;
    state.flash = 0.5;
    burst(state.ship.x, state.ship.y, '#ff6b81', 26, 320);
    if (state.hull <= 0) return EVENT_HIT | EVENT_OVER;
    return EVENT_HIT;
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.wave = 1;
    state.hull = HULL;
    state.shield = false;
    state.combo = 0;
    state.comboTimer = 0;
    state.cells = 0;
    state.kills = 0;
    state.shake = 0;
    state.flash = 0;
    state.banner = 0;
    state.bannerText = '';
    state.phase = 'fight';
    state.spawnLeft = waveCount(1);
    state.spawnTimer = 0.5;
    state.ship.x = FIELD.width / 2;
    state.ship.y = FIELD.height / 2 + 80;
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.angle = -Math.PI / 2;
    state.ship.fireTimer = 0;
    state.ship.invuln = 0;
    state.bolts.length = 0;
    state.orbs.length = 0;
    state.enemies.length = 0;
    state.pickups.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
  }

  /**
   * Advance the world one fixed step. `move` is a normalised [x, y] direction,
   * `fire` whether the trigger is held, `aimAngle` the firing direction in
   * radians (null keeps the ship's heading). `demo` is the title screen's
   * attract mode: enemies drift, nothing can hurt the ship, no score is kept.
   */
  function step(dt, move, fire, aimAngle, demo) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.banner > 0) state.banner = Math.max(0, state.banner - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    const ship = state.ship;
    if (ship.invuln > 0) ship.invuln -= dt;
    if (ship.fireTimer > 0) ship.fireTimer -= dt;

    // The ship: thrust, drag, and a soft clamp to the field.
    ship.vx += move[0] * SHIP.accel * dt;
    ship.vy += move[1] * SHIP.accel * dt;
    const drag = Math.max(0, 1 - SHIP.drag * dt);
    ship.vx *= drag;
    ship.vy *= drag;
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > SHIP.maxSpeed) {
      ship.vx = (ship.vx / speed) * SHIP.maxSpeed;
      ship.vy = (ship.vy / speed) * SHIP.maxSpeed;
    }
    ship.x = Math.min(FIELD.width - SHIP.radius, Math.max(SHIP.radius, ship.x + ship.vx * dt));
    ship.y = Math.min(FIELD.height - SHIP.radius, Math.max(SHIP.radius, ship.y + ship.vy * dt));
    if (aimAngle !== null && aimAngle !== undefined) ship.angle = aimAngle;
    else if (speed > 40) ship.angle = Math.atan2(ship.vy, ship.vx);

    // Firing: a bolt every interval while the trigger is held.
    if (fire && !demo && ship.fireTimer <= 0) {
      ship.fireTimer = SHIP.fireInterval;
      state.bolts.push({
        x: ship.x + Math.cos(ship.angle) * (SHIP.radius + 6),
        y: ship.y + Math.sin(ship.angle) * (SHIP.radius + 6),
        vx: Math.cos(ship.angle) * SHIP.boltSpeed + ship.vx * 0.4,
        vy: Math.sin(ship.angle) * SHIP.boltSpeed + ship.vy * 0.4,
        life: BOLT.life,
      });
    }

    // Spawning: a wave keeps arriving until its quota is spent. In the title
    // screen's attract mode a slow trickle of drifters keeps the backdrop alive.
    if (demo) {
      if (state.enemies.length < 9) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy();
          state.spawnTimer = 0.7;
        }
      }
    } else if (state.phase === 'fight') {
      if (state.spawnLeft > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy();
          state.spawnLeft -= 1;
          state.spawnTimer = spawnInterval(state.wave);
        }
      } else if (state.enemies.length === 0) {
        state.phase = 'cleared';
        state.banner = 2.4;
        if (state.wave >= WIN_WAVE) {
          state.bannerText = 'SECTOR CLEARED';
          state.phase = 'won';
          events |= EVENT_WIN;
        } else {
          state.bannerText = `WAVE ${state.wave} CLEARED  +${WAVE.clearBonus}`;
          state.score += WAVE.clearBonus;
          events |= EVENT_WAVE_CLEAR;
        }
      }
    }

    // Wave banner: pause the action briefly, then the next wave arrives.
    if (state.phase === 'cleared' && state.banner <= 0) {
      state.wave += 1;
      state.spawnLeft = waveCount(state.wave);
      state.spawnTimer = 0.8;
      state.phase = 'fight';
    }

    // Bolts fly straight and die off-field or when their life runs out.
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = state.bolts[i];
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0 || bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) {
        state.bolts.splice(i, 1);
      }
    }

    // Enemies move, and seekers and weavers play their own game.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
      enemy.angle += enemy.spin * dt;
      if (enemy.kind === 'seeker' && !demo) {
        const dx = ship.x - enemy.x;
        const dy = ship.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        const spec = ENEMY.seeker;
        enemy.vx += (dx / dist) * spec.speed * 2.2 * dt;
        enemy.vy += (dy / dist) * spec.speed * 2.2 * dt;
        const espeed = Math.hypot(enemy.vx, enemy.vy);
        if (espeed > spec.speed * 1.4) {
          enemy.vx = (enemy.vx / espeed) * spec.speed * 1.4;
          enemy.vy = (enemy.vy / espeed) * spec.speed * 1.4;
        }
      } else if (enemy.kind === 'weaver' && !demo) {
        const dx = ship.x - enemy.x;
        const dy = ship.y - enemy.y;
        const dist = Math.hypot(dx, dy) || 1;
        const want = 280;
        const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
        enemy.vx += (dx / dist) * toward * ENEMY.weaver.speed * dt * 2;
        enemy.vy += (dy / dist) * toward * ENEMY.weaver.speed * dt * 2;
        const strafe = Math.sin(state.time * 1.3 + enemy.seed) * 60;
        enemy.vx += (-dy / dist) * strafe * dt;
        enemy.vy += (dx / dist) * strafe * dt;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && dist < 520) {
          enemy.fireTimer = 2.2;
          state.orbs.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx / dist) * ORB.speed,
            vy: (dy / dist) * ORB.speed,
            life: 4,
          });
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.x < -90 || enemy.x > FIELD.width + 90 || enemy.y < -90 || enemy.y > FIELD.height + 90) {
        state.enemies.splice(i, 1);
      }
    }

    // Enemy orbs fly on and fade.
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
      if (orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20) {
        state.orbs.splice(i, 1);
      }
    }

    // Pickups drift, and cells are pulled toward the ship when it is near.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      const dx = ship.x - pickup.x;
      const dy = ship.y - pickup.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (pickup.kind === 'cell' && dist < CELL.magnet) {
        pickup.vx += (dx / dist) * 900 * dt;
        pickup.vy += (dy / dist) * 900 * dt;
      }
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      pickup.vx *= 0.98;
      pickup.vy *= 0.98;
      const pickupRadius = pickup.kind === 'cell' ? CELL.radius : SHIELD.radius;
      if (dist < SHIP.radius + pickupRadius + 6) {
        state.pickups.splice(i, 1);
        if (pickup.kind === 'cell') {
          state.cells += 1;
          const gained = CELL.score * multiplier();
          state.score += gained;
          addText(pickup.x, pickup.y, `+${gained}`, '#ffd94d');
          burst(pickup.x, pickup.y, '#ffd94d', 6, 120);
          events |= EVENT_PICKUP;
          if (state.cells % CELL.repairEvery === 0 && state.hull < HULL) {
            state.hull += 1;
            addText(ship.x, ship.y - 34, 'HULL REPAIRED', '#7dffb0');
            events |= EVENT_REPAIR;
          }
        } else {
          state.shield = true;
          addText(pickup.x, pickup.y, 'SHIELD UP', '#7dffb0');
          burst(pickup.x, pickup.y, '#7dffb0', 10, 160);
          events |= EVENT_PICKUP;
        }
      }
    }

    // Bolts against enemies.
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = state.bolts[i];
      let consumed = false;
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        const dx = bolt.x - enemy.x;
        const dy = bolt.y - enemy.y;
        const reach = enemy.radius + SHIP.boltRadius;
        if (dx * dx + dy * dy < reach * reach) {
          consumed = true;
          enemy.hp -= BOLT.damage;
          enemy.hitFlash = 0.12;
          burst(bolt.x, bolt.y, '#8ef7ff', 4, 140);
          if (enemy.hp <= 0) {
            killEnemy(j);
            events |= EVENT_KILL;
          }
          break;
        }
      }
      if (consumed) state.bolts.splice(i, 1);
    }

    // Enemies and orbs against the ship.
    if (!demo) {
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = state.enemies[i];
        const dx = ship.x - enemy.x;
        const dy = ship.y - enemy.y;
        const reach = enemy.radius + SHIP.radius - 4;
        if (dx * dx + dy * dy < reach * reach) {
          const hurt = hurtShip();
          events |= hurt;
          if (hurt & EVENT_OVER) return events;
          state.enemies.splice(i, 1);
          burst(enemy.x, enemy.y, '#ff6b81', 14, 240);
          break;
        }
      }
      for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
        const orb = state.orbs[i];
        const dx = ship.x - orb.x;
        const dy = ship.y - orb.y;
        const reach = ORB.radius + SHIP.radius - 2;
        if (dx * dx + dy * dy < reach * reach) {
          state.orbs.splice(i, 1);
          const hurt = hurtShip();
          events |= hurt;
          if (hurt & EVENT_OVER) return events;
          break;
        }
      }
    }

    // Particles and floating texts age out.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const text = state.texts[i];
      text.y -= 34 * dt;
      text.life -= dt;
      if (text.life <= 0) state.texts.splice(i, 1);
    }

    return events;
  }

  reset();
  return { state, reset, step, multiplier };
}
