// Everything on screen: the starfield, the ship and its enemies, the HUD, and
// the four screens (title, play, paused, game over, win). It only reads state —
// it never changes a rule — so the same draw call paints the live game and the
// staged screenshots.

import { FIELD, FONT, PALETTE, SHIP } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fieldTransform() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(width / FIELD.width, height / FIELD.height);
    const offsetX = (width - FIELD.width * scale) / 2;
    const offsetY = (height - FIELD.height * scale) / 2;
    return { scale, offsetX, offsetY };
  }

  function drawBackground(state) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const { scale, offsetX, offsetY } = fieldTransform();
    for (const nebula of state.nebulae) {
      const x = offsetX + nebula.x * scale;
      const y = offsetY + nebula.y * scale;
      const r = nebula.r * scale;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, nebula.color + '55');
      glow.addColorStop(1, nebula.color + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const star of state.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(state.time * 1.7 + star.twinkle);
      ctx.globalAlpha = twinkle * star.layer + 0.15;
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(offsetX + star.x * scale, offsetY + star.y * scale, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(state) {
    const ship = state.ship;
    const blink = ship.invuln > 0 && Math.floor(state.time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.globalAlpha = blink ? 0.35 : 1;
    const flame = 10 + Math.sin(state.time * 31) * 4;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-SHIP.radius * 0.8, 5);
    ctx.lineTo(-SHIP.radius * 0.8 - flame, 0);
    ctx.lineTo(-SHIP.radius * 0.8, -5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = PALETTE.ship;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.ship;
    ctx.beginPath();
    ctx.moveTo(SHIP.radius + 6, 0);
    ctx.lineTo(-SHIP.radius * 0.8, SHIP.radius * 0.75);
    ctx.lineTo(-SHIP.radius * 0.35, 0);
    ctx.lineTo(-SHIP.radius * 0.8, -SHIP.radius * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.shipCore;
    ctx.beginPath();
    ctx.arc(2, 0, 4.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (state.shield) {
      ctx.save();
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(state.time * 5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, SHIP.radius + 9, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      if (enemy.kind === 'drifter') {
        ctx.rotate(enemy.angle);
        ctx.shadowColor = PALETTE.drifter;
        ctx.shadowBlur = 12;
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : PALETTE.drifter;
        ctx.beginPath();
        const points = enemy.vertices.length;
        for (let i = 0; i < points; i += 1) {
          const angle = (i / points) * TAU;
          const r = enemy.radius * enemy.vertices[i];
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#241d4d';
        ctx.beginPath();
        ctx.arc(-enemy.radius * 0.25, -enemy.radius * 0.15, enemy.radius * 0.28, 0, TAU);
        ctx.arc(enemy.radius * 0.3, enemy.radius * 0.25, enemy.radius * 0.2, 0, TAU);
        ctx.fill();
      } else if (enemy.kind === 'seeker') {
        const aim = Math.atan2(state.ship.y - enemy.y, state.ship.x - enemy.x);
        ctx.rotate(aim);
        ctx.shadowColor = PALETTE.seeker;
        ctx.shadowBlur = 14;
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : PALETTE.seeker;
        ctx.beginPath();
        ctx.moveTo(enemy.radius + 5, 0);
        ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
        ctx.lineTo(-enemy.radius * 0.4, 0);
        ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2b0d08';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.32, 0, TAU);
        ctx.fill();
      } else {
        ctx.rotate(enemy.angle * 0.6);
        ctx.shadowColor = PALETTE.weaver;
        ctx.shadowBlur = 14;
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : PALETTE.weaver;
        ctx.beginPath();
        ctx.moveTo(0, -enemy.radius - 4);
        ctx.lineTo(enemy.radius, 0);
        ctx.lineTo(0, enemy.radius + 4);
        ctx.lineTo(-enemy.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        const pulse = 3 + Math.sin(state.time * 6 + enemy.seed) * 1.5;
        ctx.fillStyle = '#fff0fa';
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      if (pickup.kind === 'cell') {
        const bob = Math.sin(state.time * 4 + pickup.x) * 2;
        ctx.translate(0, bob);
        ctx.shadowColor = PALETTE.cell;
        ctx.shadowBlur = 14;
        ctx.fillStyle = PALETTE.cell;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#7a5b00';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TAU);
        ctx.fill();
      } else {
        ctx.rotate(state.time * 1.5);
        ctx.shadowColor = PALETTE.shield;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = PALETTE.shield;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, TAU);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.shield;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawShots(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bolt of state.bolts) {
      ctx.strokeStyle = PALETTE.bolt;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bolt.x - bolt.vx * 0.02, bolt.y - bolt.vy * 0.02);
      ctx.lineTo(bolt.x, bolt.y);
      ctx.stroke();
    }
    for (const orb of state.orbs) {
      ctx.shadowColor = PALETTE.orb;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.orb;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 7, 0, TAU);
      ctx.fill();
    }
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.save();
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    for (const text of state.texts) {
      ctx.globalAlpha = Math.min(1, text.life);
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, screen) {
    const width = window.innerWidth;
    const { scale, offsetX, offsetY } = fieldTransform();
    ctx.save();
    ctx.font = `700 ${Math.round(20 * scale + 4)}px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, offsetX + 18, offsetY + 14);
    ctx.font = `600 ${Math.round(13 * scale + 3)}px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST  ${Math.max(best, state.score).toLocaleString('en-US')}`, offsetX + 18, offsetY + 44);
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(20 * scale + 4)}px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`WAVE ${state.wave} / 10`, offsetX + FIELD.width * scale / 2, offsetY + 14);
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i += 1) {
      const x = offsetX + FIELD.width * scale - 18 - i * 30;
      const y = offsetY + 26;
      ctx.fillStyle = i < state.hull ? PALETTE.hull : PALETTE.hullEmpty;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.bezierCurveTo(x - 11, y - 3, x - 6, y - 12, x, y - 5);
      ctx.bezierCurveTo(x + 6, y - 12, x + 11, y - 3, x, y + 8);
      ctx.fill();
    }
    if (state.shield) {
      ctx.fillStyle = PALETTE.shield;
      ctx.font = `700 ${Math.round(13 * scale + 3)}px ${FONT}`;
      ctx.fillText('SHIELD', offsetX + FIELD.width * scale - 18, offsetY + 46);
    }
    if (state.combo > 1) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 ${Math.round(22 * scale + 4)}px ${FONT}`;
      ctx.fillText(`COMBO x${Math.min(5, state.combo)}`, offsetX + FIELD.width * scale / 2, offsetY + 46);
    }
    if (screen === SCREEN_PLAY) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 ${Math.round(12 * scale + 3)}px ${FONT}`;
      ctx.fillText('WASD / arrows to fly  ·  mouse to aim  ·  hold click or Space to fire  ·  P pause  ·  M mute', offsetX + FIELD.width * scale / 2, offsetY + FIELD.height * scale - 26);
    }
    ctx.restore();
  }

  function drawBanner(state) {
    if (state.banner <= 0 || !state.bannerText) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.banner);
    ctx.textAlign = 'center';
    ctx.font = `800 44px ${FONT}`;
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 24;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(state.bannerText, width / 2, height * 0.32);
    ctx.restore();
  }

  function drawPanel(width, height, lines) {
    const panelWidth = Math.min(620, width - 48);
    const panelHeight = 92 + lines.length * 34;
    const x = (width - panelWidth) / 2;
    const y = (height - panelHeight) / 2;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, panelWidth, panelHeight, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(95, 242, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    return { x, y, width: panelWidth, height: panelHeight };
  }

  function drawTitle(state, best) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 ${Math.round(Math.min(84, width * 0.075))}px ${FONT}`;
    ctx.shadowColor = PALETTE.ship;
    ctx.shadowBlur = 30;
    ctx.fillText('LUMEN DRIFT', width / 2, height * 0.2);
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(Math.min(22, width * 0.022))}px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Fly the last light-ship. Clear all ten waves and bring the sector home.', width / 2, height * 0.2 + 78);
    const panel = drawPanel(width, height, ['', '', '', '', '']);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 18px ${FONT}`;
    const lines = [
      'WASD or arrow keys — fly    ·    Mouse — aim    ·    Hold click or Space — fire',
      'Blast drifters, seekers and weavers. Grab cells to score and repair your hull.',
      'Chain kills for a combo up to x5. Clear wave 10 to win.  P pauses, M mutes.',
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, panel.y + 52 + i * 34);
    });
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(best > 0 ? `BEST  ${best.toLocaleString('en-US')}` : 'Press Space or click to launch', width / 2, panel.y + panel.height - 44);
    if (best > 0) {
      ctx.font = `600 16px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Press Space or click to launch', width / 2, panel.y + panel.height - 18);
    }
    ctx.restore();
  }

  function drawOver(state, best, won) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 7, 18, 0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(Math.min(64, width * 0.06))}px ${FONT}`;
    ctx.shadowColor = won ? PALETTE.gold : PALETTE.hull;
    ctx.shadowBlur = 26;
    ctx.fillStyle = won ? PALETTE.gold : '#ff8fa0';
    ctx.fillText(won ? 'SECTOR CLEARED' : 'GAME OVER', width / 2, height * 0.24);
    ctx.shadowBlur = 0;
    const panel = drawPanel(width, height, ['', '', '', '']);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, width / 2, panel.y + 56);
    ctx.font = `600 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best  ${Math.max(best, state.score).toLocaleString('en-US')}    ·    Wave ${state.wave}    ·    ${state.kills} ships destroyed`, width / 2, panel.y + 96);
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Press Space or click to fly again', width / 2, panel.y + panel.height - 46);
    ctx.restore();
  }

  function drawPaused() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 7, 18, 0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '800 52px ' + FONT;
    ctx.fillText('PAUSED', width / 2, height * 0.42);
    ctx.font = '600 18px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P, Space or click to keep flying', width / 2, height * 0.42 + 48);
    ctx.restore();
  }

  function draw(state, screen, best) {
    resize();
    drawBackground(state);
    const { scale, offsetX, offsetY } = fieldTransform();
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.translate(shakeX, shakeY);
    if (screen !== SCREEN_TITLE) {
      drawPickups(state);
      drawEnemies(state);
      drawShots(state);
      drawShip(state);
      drawTexts(state);
    } else {
      // The title keeps only the drifting rocks behind its panel; the ship
      // would sit underneath the panel and muddy the text.
      drawEnemies(state);
    }
    ctx.restore();
    if (screen !== SCREEN_TITLE) drawHud(state, best, screen);
    drawBanner(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_OVER) drawOver(state, best, false);
    else if (screen === SCREEN_WIN) drawOver(state, best, true);
    else if (screen === SCREEN_PAUSED) drawPaused();
    if (state.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.45, state.flash);
      ctx.fillStyle = '#ff2e4d';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.restore();
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(2,3,10,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  return { draw };
}
