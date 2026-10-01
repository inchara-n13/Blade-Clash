import { Sword, getSword } from "./swords";

export type Mode = "ai" | "duel";

export interface FighterInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  duck: boolean;
  swap: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  glow: boolean;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
  size: number;
}

interface Status {
  burn: number;      // frames remaining
  slow: number;      // frames remaining
  stun: number;      // frames remaining
  burnTick: number;
}

export class Fighter {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  onGround = true;
  width = 34;
  height = 78;
  swordIds: string[];
  swordIndex = 0;
  swingTimer = 0;      // >0 = swinging (counts down)
  swingCooldown = 0;
  hitThisSwing = false;
  status: Status = { burn: 0, slow: 0, stun: 0, burnTick: 0 };
  color: string;
  isAI: boolean;
  hurtFlash = 0;
  name: string;
  aiTimer = 0;
  aiTarget = 0;
  ducking = false;
  swapCooldown = 0;
  airStrike = false;   // current swing is an air strike (slam)
  swapReady = true;    // for edge-detection on swap input

  constructor(x: number, swordIds: string | string[], facing: 1 | -1, color: string, isAI: boolean, name: string) {
    this.x = x;
    this.y = 0;
    this.facing = facing;
    this.swordIds = Array.isArray(swordIds) ? swordIds : [swordIds];
    this.hp = 100;
    this.maxHp = 100;
    this.color = color;
    this.isAI = isAI;
    this.name = name;
  }

  get sword(): Sword {
    return getSword(this.swordIds[this.swordIndex]);
  }

  get attacking() {
    return this.swingTimer > this.sword.swingSpeed * 0.35;
  }
}

const GRAVITY = 0.9;
const JUMP_V = -17;
const GROUND_MARGIN = 70;

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  dpr = 1;
  groundY = 0;

  p1: Fighter;
  p2: Fighter;
  particles: Particle[] = [];
  floats: FloatText[] = [];
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  freezeFrames = 0;

  mode: Mode;
  running = false;
  paused = false;
  gameOver = false;
  score = 0;
  wave = 1;
  difficulty = 2; // 1 = easy, 2 = normal, 3 = hard
  enemiesDefeated = 0;
  time = 0;
  bgOffset = 0;

  input1: FighterInput = { left: false, right: false, jump: false, attack: false, duck: false, swap: false };
  input2: FighterInput = { left: false, right: false, jump: false, attack: false, duck: false, swap: false };
  tutorial = false;

  onUpdate?: () => void;
  onGameOver?: () => void;
  onHit?: (heavy: boolean) => void;
  onSwing?: () => void;
  onKO?: () => void;
  onSwap?: () => void;

  private raf = 0;
  private lastTime = 0;
  private acc = 0;
  private readonly STEP = 1000 / 60;

  constructor(canvas: HTMLCanvasElement, mode: Mode, p1Swords: string | string[], p2Swords: string | string[], difficulty = 2) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.mode = mode;
    this.difficulty = difficulty;
    this.p1 = new Fighter(0, p1Swords, 1, "#60a5fa", false, "P1");
    this.p2 = new Fighter(0, p2Swords, -1, "#f87171", mode === "ai", mode === "ai" ? "BOT" : "P2");
    if (mode === "ai") {
      // Bot HP scales with difficulty
      const botHp = 90 + difficulty * 25; // easy 115, normal 140, hard 165
      this.p2.maxHp = botHp;
      this.p2.hp = botHp;
    }
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.groundY = this.h - GROUND_MARGIN;
    // reposition fighters on ground
    this.p1.y = this.groundY - this.p1.height;
    this.p2.y = this.groundY - this.p2.height;
  }

  start() {
    this.resize();
    this.p1.x = this.w * 0.28;
    this.p2.x = this.w * 0.72;
    this.p1.y = this.groundY - this.p1.height;
    this.p2.y = this.groundY - this.p2.height;
    this.running = true;
    this.paused = false;
    this.gameOver = false;
    this.score = 0;
    this.wave = 1;
    this.enemiesDefeated = 0;
    this.lastTime = performance.now();
    this.acc = 0;
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(v: boolean) {
    this.paused = v;
    if (!v && this.running) {
      this.lastTime = performance.now();
      this.acc = 0;
      this.loop(this.lastTime);
    }
  }

  private loop = (t: number) => {
    if (!this.running || this.paused) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = t - this.lastTime;
    this.lastTime = t;
    if (dt > 100) dt = 100;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= this.STEP && steps < 5) {
      this.step();
      this.acc -= this.STEP;
      steps++;
    }
    this.render();
  };

  private step() {
    this.time++;
    this.bgOffset += 0.3;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return; // hit-stop for juice
    }

    if (this.mode === "ai" && !this.p2.isAI) {
      // safety
    }
    if (this.p2.isAI) this.updateAI();

    this.updateFighter(this.p1, this.input1);
    this.updateFighter(this.p2, this.input2);

    // Face each other automatically when not moving toward wall
    this.autoFace(this.p1, this.p2);
    this.autoFace(this.p2, this.p1);

    this.resolveCombat(this.p1, this.p2);
    this.resolveCombat(this.p2, this.p1);

    this.updateStatus(this.p1);
    this.updateStatus(this.p2);

    this.updateParticles();
    this.updateFloats();

    if (this.shake > 0) {
      this.shake *= 0.86;
      if (this.shake < 0.4) this.shake = 0;
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shakeY = (Math.random() - 0.5) * this.shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Check KO
    if (this.p2.hp <= 0 && !this.gameOver) {
      this.handleKO(this.p2, this.p1);
    }
    if (this.p1.hp <= 0 && !this.gameOver) {
      this.handleKO(this.p1, this.p2);
    }

    this.onUpdate?.();
  }

  private autoFace(f: Fighter, opp: Fighter) {
    if (f.status.stun > 0) return;
    if (f.x < opp.x) f.facing = 1;
    else f.facing = -1;
  }

  private handleKO(loser: Fighter, winner: Fighter) {
    this.spawnBurst(loser.x, loser.y + loser.height / 2, loser.color, 40, 9);
    this.spawnBurst(loser.x, loser.y + loser.height / 2, "#fff", 20, 7);
    this.shake = 26;
    this.freezeFrames = 8;
    this.onKO?.();

    // Victory celebration burst around the winner
    if (this.mode === "ai" && winner === this.p1) {
      const colors = ["#fde047", "#4ade80", "#a5b4fc", "#f0abfc", "#38bdf8"];
      for (const c of colors) {
        this.spawnBurst(winner.x, winner.y + winner.height * 0.4, c, 14, 8);
      }
      this.pushFloat(winner.x, winner.y - 20, "WINNER!", "#fde047", 30);
    }

    if (this.mode === "ai") {
      if (winner === this.p1) {
        // Player defeated the bot -> WIN. Score = remaining HP + speed bonus.
        const timeBonus = Math.max(0, 60 - Math.floor(this.time / 60)) * 3;
        this.score = 100 + Math.max(0, Math.floor(this.p1.hp)) * 5 + timeBonus;
        this.playerWon = true;
        this.duelWinner = "VICTORY!";
        this.endGame("VICTORY!");
      } else {
        // Bot defeated the player -> LOSE.
        this.playerWon = false;
        this.score = 0;
        this.endGame("");
      }
    } else {
      // duel: game over, score is health of winner
      this.score = Math.max(0, Math.round(winner.hp));
      this.endGame(winner === this.p1 ? "P1 WINS" : "P2 WINS");
    }
  }

  duelWinner = "";
  playerWon = false;
  endGame(msg?: string) {
    this.gameOver = true;
    this.running = false;
    this.duelWinner = msg ?? "";
    cancelAnimationFrame(this.raf);
    this.render();
    this.onGameOver?.();
  }

  private updateFighter(f: Fighter, input: FighterInput) {
    // Weapon swap (edge-triggered) — allowed even while stunned briefly? keep it out of stun
    if (input.swap && f.swapReady && f.swapCooldown <= 0 && f.swordIds.length > 1 && f.status.stun <= 0) {
      f.swordIndex = (f.swordIndex + 1) % f.swordIds.length;
      f.swapCooldown = 220;
      f.swapReady = false;
      this.onSwap?.();
      this.spawnBurst(f.x, f.y + f.height * 0.4, f.sword.glow, 16, 5);
      this.pushFloat(f.x, f.y - 26, f.sword.emoji + " " + f.sword.name, f.sword.glow, 18);
    }
    if (!input.swap) f.swapReady = true;
    if (f.swapCooldown > 0) f.swapCooldown -= this.STEP;

    // Ducking only makes sense on ground and while not attacking
    f.ducking = input.duck && f.onGround && f.swingTimer <= 0 && f.status.stun <= 0;

    if (f.status.stun > 0) {
      f.vx *= 0.8;
    } else {
      const speedMult = (f.status.slow > 0 ? 0.45 : 1) * (f.ducking ? 0.35 : 1);
      const spd = 3.6 * f.sword.moveSpeed * speedMult;
      if (input.left) f.vx = -spd;
      else if (input.right) f.vx = spd;
      else f.vx *= 0.7;

      if (input.jump && f.onGround && !f.ducking) {
        f.vy = JUMP_V;
        f.onGround = false;
        this.spawnBurst(f.x, f.y + f.height, "#94a3b8", 6, 3);
      }

      // Attack
      if (input.attack && f.swingCooldown <= 0 && f.swingTimer <= 0 && !f.ducking) {
        const isAir = !f.onGround;
        f.swingTimer = f.sword.swingSpeed;
        f.swingCooldown = f.sword.swingSpeed + (isAir ? 40 : 90);
        f.hitThisSwing = false;
        f.airStrike = isAir;
        if (isAir) {
          // Air strike: dive downward for a slam
          f.vy = Math.max(f.vy, 9);
          f.vx += f.facing * 2;
        }
        this.onSwing?.();
        this.spawnSwingTrail(f);
      }
    }

    // physics
    f.vy += GRAVITY;
    f.x += f.vx * (this.STEP / 16.67);
    f.y += f.vy * (this.STEP / 16.67);

    if (f.y >= this.groundY - f.height) {
      f.y = this.groundY - f.height;
      f.vy = 0;
      if (!f.onGround) {
        if (f.airStrike && f.swingTimer > 0) {
          // Air strike slam shockwave on landing
          this.spawnBurst(f.x, f.y + f.height, f.sword.glow, 22, 8);
          this.spawnBurst(f.x, f.y + f.height, "#fff", 10, 6);
          this.shake = Math.min(24, this.shake + 12);
        } else {
          this.spawnBurst(f.x, f.y + f.height, "#64748b", 5, 3);
        }
      }
      f.onGround = true;
    }

    // walls
    const margin = 30;
    if (f.x < margin) f.x = margin;
    if (f.x > this.w - margin) f.x = this.w - margin;

    if (f.swingTimer > 0) {
      f.swingTimer -= this.STEP;
      if (f.swingTimer <= 0) f.airStrike = false;
    }
    if (f.swingCooldown > 0) f.swingCooldown -= this.STEP;
    if (f.hurtFlash > 0) f.hurtFlash--;
  }

  private resolveCombat(attacker: Fighter, target: Fighter) {
    if (!attacker.attacking || attacker.hitThisSwing) return;

    const reach = attacker.sword.reach;
    const bladeX = attacker.x + attacker.facing * (attacker.width / 2 + reach / 2);
    const bladeY = attacker.y + attacker.height * 0.4;
    const halfR = reach / 2 + 20;

    const dx = Math.abs(bladeX - target.x);
    const dy = Math.abs(bladeY - (target.y + target.height / 2));
    const facingRight = attacker.facing === 1 ? target.x > attacker.x : target.x < attacker.x;

    if (dx < halfR && dy < 60 && facingRight) {
      attacker.hitThisSwing = true;
      // Ducking dodges high/standing swings (but not air-strike slams)
      if (target.ducking && !attacker.airStrike) {
        this.pushFloat(target.x, target.y - 10, "DODGE!", "#7dd3fc", 20);
        this.spawnBurst(target.x, target.y + target.height * 0.5, "#7dd3fc", 8, 4);
        return;
      }
      this.applyHit(attacker, target);
    }
  }

  private applyHit(attacker: Fighter, target: Fighter) {
    const s = attacker.sword;
    let dmg = s.damage;
    let crit = false;
    if (Math.random() < 0.15) {
      dmg = Math.round(dmg * 1.8);
      crit = true;
    }
    // Air strike bonus damage
    if (attacker.airStrike) {
      dmg = Math.round(dmg * 1.5);
    }
    target.hp -= dmg;
    target.hurtFlash = 8;

    // knockback
    target.vx = attacker.facing * s.knockback;
    target.vy = -Math.min(6, s.knockback * 0.4);
    target.onGround = false;

    // Juice
    const heavy = s.special === "heavy" || crit;
    this.shake = Math.min(24, this.shake + (heavy ? 16 : 9));
    this.freezeFrames = heavy ? 6 : 3;
    this.onHit?.(heavy);

    const hx = (attacker.x + target.x) / 2;
    const hy = target.y + target.height * 0.4;

    // impact particles
    this.spawnBurst(hx, hy, "#ffffff", 10, 6);
    this.spawnBurst(hx, hy, s.glow, 16, 7);

    const label = (attacker.airStrike ? "AIR " : "") + (crit ? "CRIT " : "") + dmg;
    this.pushFloat(target.x, target.y + 6, label, crit || attacker.airStrike ? "#fde047" : "#ffffff", crit || attacker.airStrike ? 30 : 22);

    // Special effects
    switch (s.special) {
      case "fire":
        target.status.burn = 150;
        this.spawnBurst(hx, hy, "#fb923c", 12, 5);
        break;
      case "ice":
        target.status.slow = 140;
        this.spawnBurst(hx, hy, "#7dd3fc", 12, 4);
        break;
      case "lightning":
        if (Math.random() < 0.35) {
          target.status.stun = 45;
          this.pushFloat(target.x, target.y - 16, "STUN!", "#fde047", 22);
          this.shake += 8;
        }
        this.spawnBurst(hx, hy, "#fde047", 14, 8);
        break;
      case "vampire": {
        const heal = Math.round(dmg * 0.5);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        this.pushFloat(attacker.x, attacker.y, "+" + heal, "#4ade80", 20);
        this.spawnBurst(hx, hy, "#f87171", 12, 5);
        break;
      }
      case "heavy":
        this.spawnBurst(hx, hy, "#e2e8f0", 20, 9);
        break;
    }
  }

  private updateStatus(f: Fighter) {
    if (f.status.burn > 0) {
      f.status.burn--;
      f.status.burnTick++;
      if (f.status.burnTick >= 30) {
        f.status.burnTick = 0;
        f.hp -= 4;
        f.hurtFlash = 4;
        this.pushFloat(f.x, f.y, "4", "#fb923c", 16);
        this.spawnBurst(f.x, f.y + f.height * 0.5, "#fb923c", 6, 3);
      }
      // flame particles
      if (this.time % 4 === 0)
        this.spawnParticle(f.x + (Math.random() - 0.5) * 20, f.y + f.height * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * 1, -1.5, "#fb923c", 3, 20, true);
    }
    if (f.status.slow > 0) {
      f.status.slow--;
      if (this.time % 6 === 0)
        this.spawnParticle(f.x + (Math.random() - 0.5) * 24, f.y + Math.random() * f.height, 0, 0.5, "#7dd3fc", 2, 24, true);
    }
    if (f.status.stun > 0) f.status.stun--;
  }

  // ---------- AI ----------
  private updateAI() {
    const bot = this.p2;
    const player = this.p1;
    this.input2 = { left: false, right: false, jump: false, attack: false, duck: false, swap: false };
    if (bot.status.stun > 0) return;

    const dist = player.x - bot.x;
    const absDist = Math.abs(dist);
    const range = bot.sword.reach + 30;

    bot.aiTimer--;
    // difficulty scales with wave
    const reactChance = [0.42, 0.62, 0.82][this.difficulty - 1] ?? 0.62;

    if (absDist > range) {
      // approach
      if (dist > 0) this.input2.right = true;
      else this.input2.left = true;
      // occasional jump to close gap or dodge
      if (Math.random() < 0.006) this.input2.jump = true;
    } else {
      // in range -> attack sometimes, kite sometimes
      if (bot.aiTimer <= 0) {
        bot.aiTarget = Math.random();
        bot.aiTimer = 20 + Math.floor(Math.random() * 30);
      }
      if (bot.aiTarget < reactChance && bot.swingCooldown <= 0) {
        this.input2.attack = true;
      } else if (bot.aiTarget > 0.85) {
        // back off
        if (dist > 0) this.input2.left = true;
        else this.input2.right = true;
      }
      // Smart dodge: duck or jump when player is swinging nearby (scales with wave)
      if (player.attacking && bot.onGround) {
        const dodgeChance = [0.12, 0.28, 0.45][this.difficulty - 1] ?? 0.28;
        if (Math.random() < dodgeChance) {
          if (Math.random() < 0.55) this.input2.duck = true;
          else this.input2.jump = true;
        }
      }
    }
    // Occasionally swap weapon for variety (higher waves)
    if (bot.swordIds.length > 1 && bot.swapCooldown <= 0 && Math.random() < 0.004 * (this.difficulty + 1)) {
      this.input2.swap = true;
    }
  }

  // ---------- Particles ----------
  private spawnParticle(x: number, y: number, vx: number, vy: number, color: string, size: number, life: number, glow: boolean, gravity = 0.15) {
    if (this.particles.length > 400) return;
    this.particles.push({ x, y, vx, vy, color, size, life, maxLife: life, glow, gravity });
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * speed;
      this.spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 1, color, 2 + Math.random() * 3, 18 + Math.random() * 16, true);
    }
  }

  private spawnSwingTrail(f: Fighter) {
    const s = f.sword;
    const bx = f.x + f.facing * (f.width / 2 + s.reach * 0.5);
    const by = f.y + f.height * 0.4;
    for (let i = 0; i < 8; i++) {
      this.spawnParticle(bx + (Math.random() - 0.5) * s.reach, by + (Math.random() - 0.5) * 30, f.facing * (1 + Math.random() * 2), (Math.random() - 0.5) * 2, s.glow, 2 + Math.random() * 2, 12, true, 0.02);
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private pushFloat(x: number, y: number, text: string, color: string, size: number) {
    this.floats.push({ x, y, vy: -1.4, life: 50, text, color, size });
  }

  private updateFloats() {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.y += f.vy;
      f.vy *= 0.96;
      f.life--;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  // ---------- Render ----------
  private render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this.drawBackground(ctx);

    // draw fighters
    this.drawFighter(ctx, this.p2);
    this.drawFighter(ctx, this.p1);

    // particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // floats
    ctx.textAlign = "center";
    for (const f of this.floats) {
      ctx.globalAlpha = Math.min(1, f.life / 20);
      ctx.font = `900 ${f.size}px "Trebuchet MS", sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(f.text, f.x + 2, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, "#1a1030");
    g.addColorStop(0.5, "#2a1a4a");
    g.addColorStop(1, "#0f0a1e");
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, this.w + 80, this.h + 80);

    // moon
    ctx.save();
    ctx.shadowColor = "#fef9c3";
    ctx.shadowBlur = 60;
    ctx.fillStyle = "#fef9c3";
    ctx.beginPath();
    ctx.arc(this.w * 0.8, this.h * 0.22, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // distant pillars (parallax)
    ctx.fillStyle = "rgba(30,20,55,0.7)";
    const pillarW = 90;
    for (let i = -1; i < this.w / 160 + 2; i++) {
      const px = ((i * 160 - (this.bgOffset * 0.2) % 160) + 160) % (this.w + 320) - 160;
      ctx.fillRect(px, this.h * 0.35, pillarW, this.groundY - this.h * 0.35);
    }

    // ground
    const gg = ctx.createLinearGradient(0, this.groundY, 0, this.h);
    gg.addColorStop(0, "#3b2a1a");
    gg.addColorStop(1, "#1a1208");
    ctx.fillStyle = gg;
    ctx.fillRect(-40, this.groundY, this.w + 80, this.h - this.groundY + 40);
    // ground line glow
    ctx.strokeStyle = "rgba(167,139,250,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, this.groundY);
    ctx.lineTo(this.w + 40, this.groundY);
    ctx.stroke();
  }

  private drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
    ctx.save();
    ctx.translate(f.x, f.y);

    // shadow
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, this.groundY - f.y, f.width * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const flash = f.hurtFlash > 0 && f.hurtFlash % 2 === 0;
    const bodyColor = flash ? "#ffffff" : f.color;

    ctx.scale(f.facing, 1);

    // status aura
    if (f.status.burn > 0) {
      ctx.shadowColor = "#fb923c";
      ctx.shadowBlur = 22;
    } else if (f.status.slow > 0) {
      ctx.shadowColor = "#7dd3fc";
      ctx.shadowBlur = 18;
    } else if (f.status.stun > 0) {
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 18;
    }

    const baseBob = f.onGround ? Math.sin(this.time * 0.15 + (f.facing === 1 ? 0 : 3)) * (Math.abs(f.vx) > 0.5 ? 3 : 1) : 0;
    // Ducking lowers the upper body
    const duckOffset = f.ducking ? f.height * 0.24 : 0;
    const bob = baseBob + duckOffset;

    // legs (bent when ducking)
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    const legSpread = f.ducking ? 12 : Math.abs(f.vx) > 0.5 ? Math.sin(this.time * 0.3) * 8 : 4;
    const kneeY = f.ducking ? f.height * 0.78 : f.height * 0.6;
    ctx.beginPath();
    ctx.moveTo(-3, kneeY);
    ctx.lineTo(-6 - legSpread, f.height);
    ctx.moveTo(3, kneeY);
    ctx.lineTo(6 + legSpread, f.height);
    ctx.stroke();

    // body
    ctx.fillStyle = bodyColor;
    roundRect(ctx, -f.width / 2 + 4, f.height * 0.22 + bob, f.width - 8, f.height * 0.4, 8);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(0, f.height * 0.12 + bob, 13, 0, Math.PI * 2);
    ctx.fill();

    // eye
    ctx.fillStyle = flash ? "#000" : "#0a0a14";
    ctx.beginPath();
    ctx.arc(5, f.height * 0.1 + bob, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // arm + sword
    const swingProg = f.swingTimer > 0 ? 1 - f.swingTimer / f.sword.swingSpeed : 0;
    let swordAngle = -0.5;
    if (f.swingTimer > 0) {
      // swing arc from up to down
      swordAngle = -1.6 + swingProg * 2.6;
    } else {
      swordAngle = -0.4 + Math.sin(this.time * 0.08) * 0.05;
    }

    const shoulderX = 6;
    const shoulderY = f.height * 0.28 + bob;
    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(swordAngle);

    // arm
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    // sword drawing
    this.drawSword(ctx, f, 18);
    ctx.restore();

    ctx.restore();

    // HP is drawn by React overlay for players in AI mode; but draw floating bar over bot / duel
    this.drawNameBar(ctx, f);
  }

  private drawSword(ctx: CanvasRenderingContext2D, f: Fighter, startX: number) {
    const s = f.sword;
    const len = s.reach;
    // guard
    ctx.fillStyle = "#78350f";
    roundRect(ctx, startX - 3, -6, 10, 12, 2);
    ctx.fill();
    // blade
    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = f.swingTimer > 0 ? 24 : 12;
    const grad = ctx.createLinearGradient(startX, 0, startX + len, 0);
    grad.addColorStop(0, s.blade);
    grad.addColorStop(1, s.color);
    ctx.fillStyle = grad;
    if (s.special === "heavy") {
      // axe head
      ctx.beginPath();
      ctx.moveTo(startX + 6, -5);
      ctx.lineTo(startX + len * 0.7, -26);
      ctx.lineTo(startX + len, -6);
      ctx.lineTo(startX + len, 6);
      ctx.lineTo(startX + len * 0.7, 26);
      ctx.lineTo(startX + 6, 5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(startX + 6, -4);
      ctx.lineTo(startX + len - 8, -4);
      ctx.lineTo(startX + len, 0);
      ctx.lineTo(startX + len - 8, 4);
      ctx.lineTo(startX + 6, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // swing arc effect
    if (f.swingTimer > f.sword.swingSpeed * 0.4) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = s.glow;
      ctx.lineWidth = 6;
      ctx.shadowColor = s.glow;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, len, -1.2, 0.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawNameBar(ctx: CanvasRenderingContext2D, f: Fighter) {
    // small floating hp bar above head for both fighters
    const bw = 60;
    const bx = f.x - bw / 2;
    const by = f.y - 22;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, bx - 2, by - 2, bw + 4, 10, 3);
    ctx.fill();
    const pct = Math.max(0, f.hp / f.maxHp);
    ctx.fillStyle = f.isAI ? "#f87171" : "#60a5fa";
    roundRect(ctx, bx, by, bw * pct, 6, 3);
    ctx.fill();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
