// Bloco de Isaac - roguelike de salas inspirado em The Binding of Isaac.
// Visual Frutiger Aero em 2.5D. Você é um bloco de vidro. WASD move, setas atiram.
(function (global) {
  'use strict';

  // ---------- Constantes do mundo (lógica, vista de cima) ----------
  const W = 960, H = 600, HUD = 64, WALL = 40, TILE = 40;
  const IX0 = WALL, IY0 = WALL, IX1 = W - WALL, IY1 = H - WALL;
  const DOOR = 100;
  const P = global.BlockProgress; // progress.js: save, talentos, conquistas, recordes

  // ---------- Balanceamento ----------
  const PLAYER_DMG_BONUS = 1.30 * 1.30; // ataque do bloco: +30% e depois mais +30% (= +69%)
  const SHIELD_TIME = 10;          // escudo da tecla P dura 10 s
  const SHIELD_COOLDOWN = 20;      // e só pode ser usado de novo 20 s depois de ativado
  const PLAYER_MAX_HP = 8;         // 4 corações (cada ponto = meio coração)
  const PLAYER_SPEED_BONUS = 1.04; // velocidade do bloco +4%
  const ENEMY_HP_BONUS = 1.02;     // vida dos inimigos comuns +2% (não vale para os invocados por chefões)
  const BOSS_HP_MULT = 0.75;       // vida dos chefões -25%

  // ---------- Constantes da projeção 2.5D ----------
  const SCREEN_H = 600;     // altura do canvas
  const ROOM_Y0 = 118;      // y de tela da borda de trás da sala (no chão)
  const YSCALE = 0.74;      // achatamento vertical do chão
  const PERSP_BACK = 0.8;   // escala do fundo da sala (a frente é 1.0)
  const WALL_H = 56, FRONT_H = 20, DOOR_H = 46;
  const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';

  const DIRS = {
    up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
  };
  const DIR_KEYS = Object.keys(DIRS);
  const SHOOT_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  const ITEMS = [
    { id: 'dmg', name: 'Bloco de Chumbo', desc: 'Dano +1.5', color: '#ff5d7a',
      apply: p => { p.dmg += 1.5; } },
    { id: 'rate', name: 'Gatilho de Cristal', desc: 'Cadência de tiro +', color: '#3fc4ff',
      apply: p => { p.fireDelay = Math.max(0.12, p.fireDelay * 0.72); } },
    { id: 'speed', name: 'Rodinhas', desc: 'Velocidade +', color: '#6ee05a',
      apply: p => { p.speed += 45; } },
    { id: 'triple', name: 'Tiro Triplo', desc: 'Três bolhas por vez', color: '#ffc93c',
      apply: p => { p.triple = true; } },
    { id: 'heart', name: 'Coração de Vidro', desc: 'Vida máxima +1', color: '#ff8fc1',
      apply: p => { p.maxHp = Math.min(24, p.maxHp + 2); p.hp = Math.min(p.maxHp, p.hp + 2); } },
    { id: 'range', name: 'Lente Longa', desc: 'Alcance e velocidade do tiro +', color: '#a98bff',
      apply: p => { p.range += 0.3; p.shotSpeed += 90; } },
    // --- itens que mudam o jeito de jogar (inspirados no Isaac) ---
    { id: 'homing', name: 'Colher Entortada', desc: 'Bolhas teleguiadas', color: '#c77dff',
      apply: p => { p.homing = true; } },
    { id: 'pierce', name: 'Flecha de Cristal', desc: 'Bolhas atravessam inimigos', color: '#ff9ecf',
      apply: p => { p.pierce = true; } },
    { id: 'big', name: 'Bolhona', desc: 'Dano muito maior, bolhas gigantes e mais lentas', color: '#ff4f4f',
      apply: p => { p.dmg = p.dmg * 1.25 + 1.5; p.tearSize = 22; p.fireDelay *= 1.35; } },
    { id: 'quad', name: 'Olho Quádruplo', desc: 'Quatro bolhas por vez, mas atira mais devagar', color: '#ffa13c',
      apply: p => { p.quad = true; p.fireDelay *= 1.4; } },
    { id: 'bounce', name: 'Borracha Elástica', desc: 'Bolhas ricocheteiam em paredes, pedras e chefões', color: '#7dffb2',
      apply: p => { p.bounces = Math.min(5, Math.max(2, p.bounces + 1)); } },
    { id: 'spectral', name: 'Bolha Fantasma', desc: 'Bolhas atravessam pedras', color: '#e8f4ff',
      apply: p => { p.spectral = true; } },
    { id: 'freeze', name: 'Bolha Gelada', desc: 'Bolhas deixam os inimigos lentos', color: '#9be7ff',
      apply: p => { p.freeze = true; } },
    { id: 'cricket', name: 'Cabeça de Grilo', desc: 'Dano x1.5', color: '#8fd14f',
      apply: p => { p.dmg *= 1.5; } },
    { id: 'shield', name: 'Manto de Vidro', desc: 'Bloqueia o primeiro golpe de cada sala', color: '#ffffff',
      apply: p => { p.shield = true; p.shieldUp = true; } },
    { id: 'vampire', name: 'Amuleto Vampiro', desc: 'Cura meio coração a cada 8 abates', color: '#b0003a',
      apply: p => { p.vampire = true; } },
    { id: 'orbital', name: 'Cubinho Orbital', desc: 'Gira ao seu redor, bloqueia tiros e machuca', color: '#ffd84a',
      apply: p => { p.orbital = true; } },
    { id: 'buddy', name: 'Irmãozinho', desc: 'Um cubinho que atira junto com você', color: '#ff7ab8',
      apply: p => { p.buddy = true; } },
    { id: 'cake', name: 'Bolo de Morango', desc: 'Vida máxima +1 e cura tudo', color: '#ffb3c7',
      apply: p => { p.maxHp = Math.min(24, p.maxHp + 2); p.hp = p.maxHp; } },
    // --- powerups novos ---
    { id: 'cross', name: 'Tiro Cruzado', desc: 'Atira para os 4 lados ao mesmo tempo', color: '#ff6ad5',
      apply: p => { p.cross = true; } },
    { id: 'chain', name: 'Ricochete em Cadeia', desc: 'Bolhas saltam de inimigo em inimigo', color: '#5cf2e0',
      apply: p => { p.chain = Math.max(p.chain, 2); } },
    { id: 'explode', name: 'Bolha Explosiva', desc: 'Bolhas explodem ao acertar', color: '#ff8a3c',
      apply: p => { p.explode = true; } },
    { id: 'poison', name: 'Bolha Venenosa', desc: 'Envenena: dano contínuo por 3 s', color: '#9be33c',
      apply: p => { p.poison = true; } },
    { id: 'crit', name: 'Lente Crítica', desc: '+15% de chance de dano crítico (x2)', color: '#fff04a',
      apply: p => { p.crit += 0.15; } },
    { id: 'magnet', name: 'Ímã', desc: 'Puxa moedas, XP e corações', color: '#c9d3e6',
      apply: p => { p.magnet += 140; } },
  ];

  // Melhorias escolhidas ao subir de nível (até o nível 5 cada)
  const SKILL_MAX = 5;
  const SKILLS = [
    { id: 'dmg', name: 'Força', desc: 'Dano +12%', color: '#ff5d7a', apply: p => { p.dmg *= 1.12; } },
    { id: 'rate', name: 'Gatilho', desc: 'Cadência +10%', color: '#3fc4ff', apply: p => { p.fireDelay = Math.max(0.1, p.fireDelay * 0.9); } },
    { id: 'speed', name: 'Agilidade', desc: 'Velocidade +6%', color: '#6ee05a', apply: p => { p.speed *= 1.06; } },
    { id: 'hp', name: 'Vigor', desc: 'Vida máxima +1 coração', color: '#ff8fc1',
      apply: p => { p.maxHp = Math.min(24, p.maxHp + 2); p.hp = Math.min(p.maxHp, p.hp + 2); } },
    { id: 'range', name: 'Mira', desc: 'Alcance +15%', color: '#a98bff', apply: p => { p.range *= 1.15; p.shotSpeed += 30; } },
    { id: 'bounce', name: 'Ricochete', desc: '+1 ricochete por bolha', color: '#7dffb2', apply: p => { p.bounces = Math.min(5, p.bounces + 1); } },
    { id: 'crit', name: 'Precisão', desc: 'Crítico +5%', color: '#fff04a', apply: p => { p.crit += 0.05; } },
    { id: 'shield', name: 'Escudo Rápido', desc: 'Recarga do escudo -15%', color: '#bff3ff', apply: p => { p.shieldCdMult *= 0.85; } },
    { id: 'magnet', name: 'Magnetismo', desc: 'Atrai moedas e XP de longe', color: '#c9d3e6', apply: p => { p.magnet += 60; } },
  ];
  const xpNeed = level => 10 + 6 * (level - 1);

  // Padrões de pedras em tiles (22 x 13). Colunas 9-12 e linhas 5-7 ficam livres.
  const PATTERNS = [
    [],
    [[4, 2], [5, 2], [4, 3], [5, 3], [16, 2], [17, 2], [16, 3], [17, 3],
     [4, 9], [5, 9], [4, 10], [5, 10], [16, 9], [17, 9], [16, 10], [17, 10]],
    [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3],
     [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [14, 9], [15, 9], [16, 9], [17, 9], [18, 9]],
    [[6, 2], [15, 2], [6, 10], [15, 10], [3, 4], [18, 4], [3, 8], [18, 8]],
    [[3, 2], [7, 4], [14, 4], [18, 2], [3, 10], [7, 8], [14, 8], [18, 10]],
    [[1, 1], [2, 1], [1, 2], [20, 1], [19, 1], [20, 2], [1, 11], [2, 11], [1, 10], [20, 11], [19, 11], [20, 10]],
  ];

  const ENEMY_BASE = {
    fly: { size: 18, hp: 4, speed: 95 },
    orbiter: { size: 18, hp: 5, speed: 150 },
    grunt: { size: 26, hp: 10, speed: 70 },
    turret: { size: 28, hp: 12, speed: 0 },
    // monstros novos (um a cada andar)
    splitter: { size: 28, hp: 12, speed: 70 },   // Gosma: divide em 2 ao morrer
    slimelet: { size: 16, hp: 4, speed: 115 },   // mini-gosma
    charger: { size: 26, hp: 14, speed: 55 },    // Investida
    spinner: { size: 30, hp: 16, speed: 0 },     // Roda: anel de balas
    bomber: { size: 22, hp: 6, speed: 125 },     // Bomba
    ghost: { size: 24, hp: 10, speed: 80 },      // Fantasma
    shielder: { size: 28, hp: 18, speed: 55 },   // Escudeiro
    healer: { size: 22, hp: 10, speed: 95 },     // Curandeiro
    nest: { size: 34, hp: 30, speed: 0 },        // Ninho
    clone: { size: 40, hp: 25, speed: 95 },      // reflexo invocado pelo Espelho
  };
  // Nome e dica mostrados no primeiro encontro com cada monstro novo
  const ENEMY_INFO = {
    splitter: { name: 'Gosma', desc: 'Divide-se em duas quando morre' },
    charger: { name: 'Investida', desc: 'Pisca e avança em linha reta: saia da frente!' },
    spinner: { name: 'Roda', desc: 'Solta anéis de balas' },
    bomber: { name: 'Bomba', desc: 'Explode perto de você: acerte de longe' },
    ghost: { name: 'Fantasma', desc: 'Quando some, nenhum tiro acerta' },
    shielder: { name: 'Escudeiro', desc: 'Escudo na frente: use ricochete ou ataque pelo lado' },
    healer: { name: 'Curandeiro', desc: 'Cura os outros: derrube-o primeiro' },
    nest: { name: 'Ninho', desc: 'Solta moscas sem parar' },
  };
  // XP de cada abate (invocados não dão XP nem moedas, para não virar fazenda)
  const ENEMY_XP = {
    fly: 1, slimelet: 1, orbiter: 1, grunt: 2, turret: 2, splitter: 2, bomber: 2,
    charger: 3, spinner: 3, ghost: 3, healer: 3, shielder: 4, nest: 4, clone: 0, boss: 25,
  };

  const BOSSES = {
    gelatao: { name: 'Gelatão', sub: 'O Cubo de Gelatina', size: 84, hp: 260, speed: 0 },
    duque: { name: 'Duque das Bolhas', sub: 'Senhor do Enxame', size: 80, hp: 230, speed: 75 },
    prisma: { name: 'Prisma', sub: 'O Cristal Laser', size: 64, hp: 280, speed: 0 },
    colmeia: { name: 'Rainha Colmeia', sub: 'Mãe de todas as moscas', size: 78, hp: 300, speed: 90 },
    espelho: { name: 'Espelho', sub: 'Devolve o que recebe', size: 70, hp: 320, speed: 60 },
    hipercubo: { name: 'O Hipercubo', sub: 'O Big Boss', size: 92, hp: 600, speed: 0, final: true },
  };

  // Os 10 andares: bioma, nº de salas, vida dos inimigos, quem aparece (peso) e os chefões possíveis
  const EARLY = ['gelatao', 'duque', 'prisma'], MID = EARLY.concat('colmeia'), LATE = MID.concat('espelho');
  const FLOORS = [
    { biome: 'lagoa', rooms: 9, hp: 1.00, pool: { fly: 4, grunt: 4, turret: 2 }, bosses: ['gelatao', 'duque'] },
    { biome: 'lagoa', rooms: 10, hp: 1.20, pool: { fly: 3, grunt: 3, turret: 2, splitter: 3 }, bosses: EARLY },
    { biome: 'prado', rooms: 11, hp: 1.40, pool: { fly: 3, grunt: 2, turret: 2, splitter: 2, charger: 3 }, bosses: EARLY },
    { biome: 'prado', rooms: 12, hp: 1.65, pool: { fly: 2, grunt: 2, turret: 1, splitter: 2, charger: 2, spinner: 3 }, bosses: MID },
    { biome: 'ceu', rooms: 13, hp: 1.90, pool: { fly: 2, grunt: 1, turret: 1, splitter: 2, charger: 2, spinner: 2, bomber: 3 }, bosses: MID },
    { biome: 'ceu', rooms: 14, hp: 2.20, pool: { fly: 1, grunt: 1, turret: 1, splitter: 1, charger: 2, spinner: 2, bomber: 2, ghost: 3 }, bosses: LATE },
    { biome: 'cristal', rooms: 15, hp: 2.50, pool: { fly: 1, turret: 1, splitter: 1, charger: 2, spinner: 2, bomber: 2, ghost: 2, shielder: 3 }, bosses: LATE },
    { biome: 'cristal', rooms: 16, hp: 2.85, pool: { fly: 1, splitter: 1, charger: 2, spinner: 2, bomber: 2, ghost: 2, shielder: 2, healer: 2 }, bosses: LATE },
    { biome: 'nucleo', rooms: 17, hp: 3.20, pool: { splitter: 1, charger: 2, spinner: 2, bomber: 2, ghost: 2, shielder: 2, healer: 2, nest: 2 }, bosses: LATE },
    { biome: 'nucleo', rooms: 18, hp: 3.60, pool: { charger: 2, spinner: 2, bomber: 2, ghost: 2, shielder: 2, healer: 2, nest: 2, turret: 1 }, bosses: ['hipercubo'] },
  ];
  const MAX_FLOOR = FLOORS.length;
  const ELITE_FLOOR = 4, ELITE_CHANCE = 0.1;

  const BIOMES = [
    { id: 'lagoa', name: 'Lagoa de Vidro', tileA: [196, 242, 255], tileB: [130, 212, 246], grout: '#f2fdff',
      wallA: '#f6feff', wallB: '#5fbfe8', wallTop: '#9be86e', wallTopB: '#45ad35',
      rock: { top: '#f4fdff', front: '#6fc0e8', side: '#2f8fc4', alpha: 0.92 } },
    { id: 'prado', name: 'Prado Brilhante', tileA: [196, 246, 150], tileB: [126, 214, 96], grout: '#f4ffe8',
      wallA: '#fbfff2', wallB: '#6fcf5a', wallTop: '#c8f59a', wallTopB: '#4caf2f',
      rock: { top: '#ecfff6', front: '#8fe0b4', side: '#4fb67e', alpha: 0.95 } },
    { id: 'ceu', name: 'Céu Cromado', tileA: [230, 238, 255], tileB: [176, 198, 255], grout: '#ffffff',
      wallA: '#ffffff', wallB: '#8aa2f0', wallTop: '#ffffff', wallTopB: '#b5c6ff',
      rock: { top: '#ffffff', front: '#cdd6f2', side: '#93a3d4', alpha: 0.95 } },
    { id: 'cristal', name: 'Caverna de Cristal', tileA: [226, 210, 255], tileB: [176, 150, 240], grout: '#fbf6ff',
      wallA: '#fdf8ff', wallB: '#a68af0', wallTop: '#e8d9ff', wallTopB: '#9c7ae8',
      rock: { top: '#fbf4ff', front: '#c9b2ff', side: '#8a6ad8', alpha: 0.95 } },
    { id: 'nucleo', name: 'Núcleo Prismático', tileA: [255, 220, 236], tileB: [250, 168, 205], grout: '#fff6fb',
      wallA: '#fff8fc', wallB: '#f07ab0', wallTop: '#ffe0f0', wallTopB: '#e0559a',
      rock: { top: '#fff6fb', front: '#ffb8d8', side: '#d0659a', alpha: 0.95 } },
  ];

  // ---------- Utilidades ----------
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rk = (x, y) => x + ',' + y;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const TAU = Math.PI * 2;

  function overlap(a, b) {
    const r = (a.size + b.size) / 2;
    return Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
  }

  function hitsRock(room, x, y, h) {
    for (const r of room.rocks) {
      if (x + h > r.x && x - h < r.x + r.w && y + h > r.y && y - h < r.y + r.h) return r;
    }
    return null;
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    const cx = ax + dx * t, cy = ay + dy * t;
    return { d: Math.hypot(px - cx, py - cy), x: cx, y: cy };
  }

  function curRoom(s) { return s.rooms[rk(s.cur.x, s.cur.y)]; }
  function floorDef(s) { return FLOORS[clamp(s.floor, 1, MAX_FLOOR) - 1]; }
  function biome(s) { const id = floorDef(s).biome; return BIOMES.find(b => b.id === id); }

  // Projeção 2.5D: mundo (x, y no chão, z altura) -> tela
  function sc(y) { return PERSP_BACK + (1 - PERSP_BACK) * (y / H); }
  function proj(x, y, z) {
    const k = sc(y);
    return { x: W / 2 + (x - W / 2) * k, y: ROOM_Y0 + y * YSCALE - (z || 0) * k };
  }

  // ---------- Criação ----------
  function makePlayer() {
    return {
      x: W / 2, y: H / 2, size: 30, vx: 0, vy: 0, speed: 210 * PLAYER_SPEED_BONUS,
      hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, dmg: 3.5 * PLAYER_DMG_BONUS, fireDelay: 0.38, cd: 0, shotSpeed: 430, range: 0.85,
      inv: 0, triple: false, items: [], face: 'down',
      tearSize: 12, quad: false, homing: false, pierce: false, bounces: 0, spectral: false, freeze: false,
      shieldTime: 0, shieldCd: 0, shieldCdMult: 1,
      shield: false, shieldUp: false, vampire: false, vampKills: 0, orbital: false, buddy: false,
      cross: false, chain: 0, explode: false, poison: false, crit: 0, magnet: 0,
    };
  }

  function newRoom(x, y, type) {
    return {
      x, y, type, doors: {}, rocks: [], spawns: [], enemies: [], pickups: [],
      item: null, shop: null, trapdoor: null, visited: false, cleared: type === 'start',
    };
  }

  function makeEnemy(s, sp) {
    if (sp.type === 'boss') return makeBoss(s, sp);
    const b = ENEMY_BASE[sp.type];
    const m = floorDef(s).hp * (sp.summoned ? 1 : ENEMY_HP_BONUS) * (sp.elite ? 2 : 1);
    const xp = sp.summoned ? 0 : ENEMY_XP[sp.type] * (sp.elite ? 3 : 1);
    return {
      type: sp.type, x: sp.x, y: sp.y, z: 0, size: b.size * (sp.elite ? 1.15 : 1), hp: b.hp * m, maxHp: b.hp * m,
      speed: b.speed * (1 + 0.05 * (s.floor - 1)), t: s.rng() * 2, cd: 1 + s.rng(),
      flash: 0, kx: 0, ky: 0, vx: 0, vy: 0, air: false, ang: 0, launched: false, parent: null,
      elite: !!sp.elite, summoned: !!sp.summoned, xp, state: 'idle', timer: 0, poison: 0, poisonDps: 0,
    };
  }

  function makeBoss(s, sp) {
    const def = BOSSES[sp.kind];
    const m = (def.final ? 2.5 : 1 + 0.3 * (s.floor - 1)) * BOSS_HP_MULT;
    return {
      type: 'boss', kind: sp.kind, name: def.name, x: sp.x, y: sp.y, z: 0, size: def.size,
      hp: def.hp * m, maxHp: def.hp * m, speed: def.speed, t: 0, state: 'idle', timer: 1.2,
      flash: 0, kx: 0, ky: 0, vx: 0, vy: 0, air: false, shield: false, squash: 0, alpha: 1,
      spin: 0, phase: 1, cycle: 0, emit: 0, shots: 0, cang: 0, xp: ENEMY_XP.boss * (def.final ? 4 : 1),
      poison: 0, poisonDps: 0,
    };
  }

  function pickItemId(s) {
    const owned = new Set(s.player.items);
    let pool = ITEMS.filter(i => !owned.has(i.id));
    if (!pool.length) pool = ITEMS.filter(i => i.id !== 'triple');
    return pool[Math.floor(s.rng() * pool.length)].id;
  }

  // Sorteia o chefão do andar sem repetir os dois últimos
  function pickBoss(s) {
    const base = floorDef(s).bosses;
    let pool = base.filter(k => !s.usedBosses.slice(-2).includes(k));
    if (!pool.length) pool = base;
    const kind = pool[Math.floor(s.rng() * pool.length)];
    s.usedBosses.push(kind);
    return kind;
  }

  function pickEnemyType(s) {
    const pool = floorDef(s).pool;
    let total = 0;
    for (const k in pool) total += pool[k];
    let roll = s.rng() * total;
    for (const k in pool) { roll -= pool[k]; if (roll < 0) return k; }
    return 'fly';
  }

  // Preços da loja sobem a cada andar
  function shopPrices(floor) {
    return { item: 15 + 2 * (floor - 1), heart: 5 + floor, skill: 10 + 2 * floor };
  }

  function populate(s, room) {
    const rng = s.rng;
    if (room.type === 'start') return;
    if (room.type === 'item') {
      room.item = { x: W / 2, y: H / 2, size: 30, id: pickItemId(s), taken: false };
      room.cleared = true;
      return;
    }
    if (room.type === 'shop') {
      const pr = shopPrices(s.floor);
      room.shop = [
        { kind: 'item', id: pickItemId(s), price: pr.item, x: W / 2 - 200, y: H / 2, size: 30, sold: false },
        { kind: 'heart', price: pr.heart, x: W / 2, y: H / 2, size: 30, sold: false },
        { kind: 'skill', price: pr.skill, x: W / 2 + 200, y: H / 2, size: 30, sold: false },
      ];
      room.cleared = true;
      return;
    }
    if (room.type === 'boss') {
      room.bossKind = pickBoss(s);
      room.spawns.push({ type: 'boss', kind: room.bossKind, x: W / 2, y: H / 2 - 90 });
      return;
    }
    const pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)];
    room.rocks = pattern.map(([c, r]) => ({ x: IX0 + c * TILE, y: IY0 + r * TILE, w: TILE, h: TILE, c, r }));
    const taken = new Set(pattern.map(([c, r]) => c + ',' + r));
    const count = Math.min(9, 3 + Math.floor(s.floor / 2) + Math.floor(rng() * 3));
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 60; tries++) {
        const c = 4 + Math.floor(rng() * 14), r = 2 + Math.floor(rng() * 9);
        if (taken.has(c + ',' + r)) continue;
        taken.add(c + ',' + r);
        const type = pickEnemyType(s);
        const elite = s.floor >= ELITE_FLOOR && rng() < ELITE_CHANCE;
        room.spawns.push({ type, x: IX0 + c * TILE + TILE / 2, y: IY0 + r * TILE + TILE / 2, c, r, elite });
        break;
      }
    }
  }

  function generateFloor(s) {
    const rng = s.rng;
    const target = floorDef(s).rooms;
    const rooms = {};
    const list = [];
    const add = (x, y, type) => { const r = newRoom(x, y, type); rooms[rk(x, y)] = r; list.push(r); return r; };
    add(0, 0, 'start');
    let guard = 0;
    while (list.length < target && guard++ < 20000) {
      const base = list[Math.floor(rng() * list.length)];
      const d = DIRS[DIR_KEYS[Math.floor(rng() * 4)]];
      const nx = base.x + d.dx, ny = base.y + d.dy;
      if (rooms[rk(nx, ny)]) continue;
      let nb = 0;
      for (const k of DIR_KEYS) if (rooms[rk(nx + DIRS[k].dx, ny + DIRS[k].dy)]) nb++;
      if (nb > 1) continue; // mapa em árvore, com becos sem saída
      add(nx, ny, 'normal');
    }
    for (const r of list) {
      for (const k of DIR_KEYS) if (rooms[rk(r.x + DIRS[k].dx, r.y + DIRS[k].dy)]) r.doors[k] = true;
    }
    const dist = { [rk(0, 0)]: 0 };
    const queue = [rooms[rk(0, 0)]];
    while (queue.length) {
      const r = queue.shift();
      for (const k in r.doors) {
        const n = rooms[rk(r.x + DIRS[k].dx, r.y + DIRS[k].dy)];
        if (dist[rk(n.x, n.y)] === undefined) { dist[rk(n.x, n.y)] = dist[rk(r.x, r.y)] + 1; queue.push(n); }
      }
    }
    const others = list.filter(r => r.type !== 'start');
    const deadEnds = others.filter(r => Object.keys(r.doors).length === 1);
    const bossPool = (deadEnds.length ? deadEnds : others).slice()
      .sort((a, b) => dist[rk(b.x, b.y)] - dist[rk(a.x, a.y)]);
    const boss = bossPool[0];
    boss.type = 'boss';
    // sala de item e loja: de preferência em becos sem saída
    for (const type of ['item', 'shop']) {
      let pool = deadEnds.filter(r => r.type === 'normal');
      if (!pool.length) pool = others.filter(r => r.type === 'normal');
      pool[Math.floor(rng() * pool.length)].type = type;
    }

    for (const r of list) populate(s, r);
    s.rooms = rooms;
    s.cur = { x: 0, y: 0 };
    rooms[rk(0, 0)].visited = true;
  }

  const MENU_OPTIONS = ['Jogar', 'Talentos', 'Conquistas', 'Recordes', 'Controles'];
  const MENU_SCREENS = { Talentos: 'talents', Conquistas: 'achievements', Recordes: 'records', Controles: 'help' };

  // ---------- Progresso salvo (progress.js) ----------
  let SAVE = null;
  function getSave() { if (!SAVE) SAVE = P.load(); return SAVE; }
  function persist() { P.save(getSave()); }
  function setStorage(st) { P.setStorage(st); SAVE = null; } // os testes usam um armazenamento falso

  function floorMsg(s) {
    return { title: 'Andar ' + s.floor, sub: biome(s).name + ' · ' + s.floor + ' de ' + MAX_FLOOR, t: 2.5 };
  }

  // Bloco novo com os talentos comprados na conta
  function setupRun(s) {
    const tal = getSave().talents, p = s.player = makePlayer();
    if (tal.hp) { p.maxHp += 2 * tal.hp; p.hp = p.maxHp; }
    if (tal.dmg) p.dmg *= 1 + 0.05 * tal.dmg;
    if (tal.shield) p.shieldCdMult *= Math.pow(0.9, tal.shield);
    s.talent = { xp: 1 + 0.1 * (tal.xp || 0), coins: 1 + 0.15 * (tal.coins || 0) };
    if (tal.item) giveItem(s, pickItemId(s), true);
  }

  // opts.menu = true começa na tela de menu em vez de direto no jogo
  function createState(seed, opts) {
    if (seed === undefined) seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const menu = !!(opts && opts.menu);
    const s = {
      seed, rng: makeRng(seed), floor: 1, rooms: {}, cur: { x: 0, y: 0 }, usedBosses: [],
      player: null, tears: [], bullets: [], lasers: [], particles: [],
      keys: {}, lastArrow: null, status: menu ? 'menu' : 'playing', paused: false,
      menuIndex: 0, screen: null, talentIndex: 0, confirmReset: false, codeBuf: '', cheatNotice: 0, godMode: false,
      time: 0, grace: 0, shake: 0, kills: 0, msg: null,
      // progressão da partida
      level: 1, xp: 0, xpTotal: 0, pendingLevels: 0, levelUp: null, skills: {},
      coins: 0, coinsMax: 0, combo: 0, comboT: 0, bestCombo: 0,
      runTime: 0, floorStart: 0, splits: [], splitInfo: null,
      bossKills: 0, purchases: 0, floorHit: false, cleanFloors: 0, usedShield: false,
      runSaved: false, result: null, seen: {}, floaters: [], toasts: [], fx: [], achT: 0,
    };
    setupRun(s);
    generateFloor(s);
    if (!menu) s.msg = floorMsg(s);
    return s;
  }

  function restart(s, toMenu) {
    const fresh = createState(undefined, { menu: toMenu });
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, fresh);
  }

  function startGame(s) {
    s.status = 'playing';
    s.keys = {};
    s.lastArrow = null;
    s.screen = null;
    setupRun(s); // talentos comprados no menu já valem
    s.msg = floorMsg(s);
  }

  function chooseMenu(s, i) {
    s.menuIndex = i;
    const opt = MENU_OPTIONS[i];
    if (opt === 'Jogar') { startGame(s); return; }
    s.screen = MENU_SCREENS[opt];
    s.talentIndex = 0; s.confirmReset = false;
  }

  // Tela de talentos: linhas = talentos + "Apagar progresso"
  function talentAction(s, i) {
    s.talentIndex = i;
    if (i < P.TALENTS.length) {
      s.confirmReset = false;
      if (P.buyTalent(getSave(), P.TALENTS[i].id)) persist();
      return;
    }
    if (!s.confirmReset) { s.confirmReset = true; return; }
    SAVE = P.reset();
    s.confirmReset = false;
  }

  // Código secreto: digitar 1234 no menu deixa o bloco indestrutível
  const SECRET_CODE = '1234';
  const CHEAT_NOTICE_TIME = 3;

  function menuKey(s, code) {
    if (s.cheatNotice > 0) return; // aviso na tela: espera os 3 segundos
    const digit = /^(Digit|Numpad)([0-9])$/.exec(code);
    if (digit) {
      s.codeBuf = (s.codeBuf + digit[2]).slice(-SECRET_CODE.length);
      if (s.codeBuf === SECRET_CODE) {
        s.godMode = true;
        s.cheatNotice = CHEAT_NOTICE_TIME;
        s.screen = null;
      }
      return;
    }
    const enter = code === 'Enter' || code === 'NumpadEnter' || code === 'Space';
    const back = code === 'Escape' || code === 'Backspace';
    const up = code === 'ArrowUp' || code === 'KeyW', down = code === 'ArrowDown' || code === 'KeyS';
    if (s.screen === 'talents') {
      const n = P.TALENTS.length + 1;
      if (back) s.screen = null;
      else if (up || down) { s.talentIndex = (s.talentIndex + (up ? n - 1 : 1)) % n; s.confirmReset = false; }
      else if (enter) talentAction(s, s.talentIndex);
      return;
    }
    if (s.screen) { if (enter || back) s.screen = null; return; }
    const n = MENU_OPTIONS.length;
    if (up) s.menuIndex = (s.menuIndex + n - 1) % n;
    else if (down) s.menuIndex = (s.menuIndex + 1) % n;
    else if (enter) chooseMenu(s, s.menuIndex);
  }

  // ---------- Movimento e colisão ----------
  function clampX(s, e, isPlayer) {
    const room = curRoom(s), h = e.size / 2;
    const open = isPlayer && room.cleared;
    const lim = DOOR / 2 - h;
    const inDoorY = Math.abs(e.y - H / 2) <= lim + 0.001;
    if (e.x - h < IX0 && !(open && room.doors.left && inDoorY)) e.x = IX0 + h;
    if (e.x + h > IX1 && !(open && room.doors.right && inDoorY)) e.x = IX1 - h;
    if (e.y - h < IY0 || e.y + h > IY1) e.x = clamp(e.x, W / 2 - lim, W / 2 + lim);
  }

  function clampY(s, e, isPlayer) {
    const room = curRoom(s), h = e.size / 2;
    const open = isPlayer && room.cleared;
    const lim = DOOR / 2 - h;
    const inDoorX = Math.abs(e.x - W / 2) <= lim + 0.001;
    if (e.y - h < IY0 && !(open && room.doors.up && inDoorX)) e.y = IY0 + h;
    if (e.y + h > IY1 && !(open && room.doors.down && inDoorX)) e.y = IY1 - h;
    if (e.x - h < IX0 || e.x + h > IX1) e.y = clamp(e.y, H / 2 - lim, H / 2 + lim);
  }

  function moveEntity(s, e, dx, dy, isPlayer, ignoreRocks) {
    const room = curRoom(s), h = e.size / 2;
    e.x += dx;
    let r = ignoreRocks ? null : hitsRock(room, e.x, e.y, h);
    if (r && dx !== 0) e.x = dx > 0 ? r.x - h : r.x + r.w + h;
    clampX(s, e, isPlayer);
    e.y += dy;
    r = ignoreRocks ? null : hitsRock(room, e.x, e.y, h);
    if (r && dy !== 0) e.y = dy > 0 ? r.y - h : r.y + r.h + h;
    clampY(s, e, isPlayer);
  }

  function updatePlayer(s, dt) {
    const p = s.player, k = s.keys;
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    let my = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    const a = Math.min(1, dt * 12);
    p.vx += (mx * p.speed - p.vx) * a;
    p.vy += (my * p.speed - p.vy) * a;
    moveEntity(s, p, p.vx * dt, p.vy * dt, true);
  }

  function enterRoom(s, dir) {
    const cur = curRoom(s), d = DIRS[dir];
    const next = s.rooms[rk(cur.x + d.dx, cur.y + d.dy)];
    if (!next) return false;
    s.cur = { x: next.x, y: next.y };
    const p = s.player, h = p.size / 2, m = 12;
    if (dir === 'left') { p.x = IX1 - h - m; p.y = H / 2; }
    if (dir === 'right') { p.x = IX0 + h + m; p.y = H / 2; }
    if (dir === 'up') { p.y = IY1 - h - m; p.x = W / 2; }
    if (dir === 'down') { p.y = IY0 + h + m; p.x = W / 2; }
    s.tears = []; s.bullets = []; s.lasers = [];
    if (p.shield) p.shieldUp = true; // Manto de Vidro recarrega a cada sala
    if (s.buddy) { s.buddy.x = p.x; s.buddy.y = p.y; }
    if (!next.visited) {
      next.visited = true;
      next.enemies = next.spawns.map(sp => makeEnemy(s, sp));
      if (next.enemies.length === 0) next.cleared = true;
      for (const e of next.enemies) { // primeiro encontro com um monstro novo: mostra o nome e a dica
        const info = ENEMY_INFO[e.type];
        if (!info || s.seen[e.type]) continue;
        s.seen[e.type] = true;
        s.msg = { title: info.name, sub: info.desc, t: 2.6 };
      }
      if (next.type === 'boss') {
        const def = BOSSES[next.bossKind];
        s.msg = { title: def.name.toUpperCase(), sub: def.sub, t: 2.2 };
      }
    }
    s.grace = next.type === 'boss' && !next.cleared ? 1.0 : 0.6;
    return true;
  }

  function checkTransition(s) {
    const p = s.player, h = p.size / 2;
    if (p.x < IX0 - h) return enterRoom(s, 'left');
    if (p.x > IX1 + h) return enterRoom(s, 'right');
    if (p.y < IY0 - h) return enterRoom(s, 'up');
    if (p.y > IY1 + h) return enterRoom(s, 'down');
    return false;
  }

  // ---------- Tiros ----------
  function shootDir(s) {
    if (s.lastArrow && s.keys[s.lastArrow]) return SHOOT_KEYS[s.lastArrow];
    for (const c in SHOOT_KEYS) if (s.keys[c]) return SHOOT_KEYS[c];
    return null;
  }

  function updateShooting(s, dt) {
    const p = s.player;
    p.cd -= dt;
    const dir = shootDir(s);
    if (dir) p.face = dir;
    if (!dir || p.cd > 0) return;
    p.cd = p.fireDelay;
    const h = p.size / 2;
    const angles = p.quad ? [-0.3, -0.1, 0.1, 0.3] : p.triple ? [-0.2, 0, 0.2] : [0];
    // Tiro Cruzado: também atira para os outros 3 lados, com 60% do dano
    const dirs = p.cross ? [dir].concat(DIR_KEYS.filter(k => k !== dir)) : [dir];
    for (const dk of dirs) {
      const d = DIRS[dk], main = dk === dir;
      for (const a of angles) {
        const c = Math.cos(a), sn = Math.sin(a);
        const crit = p.crit > 0 && s.rng() < p.crit;
        s.tears.push({
          x: p.x + d.dx * h, y: p.y + d.dy * h,
          vx: (d.dx * c - d.dy * sn) * p.shotSpeed + p.vx * 0.25,
          vy: (d.dx * sn + d.dy * c) * p.shotSpeed + p.vy * 0.25,
          life: p.range, max: p.range, size: p.tearSize * (crit ? 1.3 : 1), dmg: p.dmg * (main ? 1 : 0.6) * (crit ? 2 : 1),
          homing: p.homing, spectral: p.spectral, freeze: p.freeze, crit,
          bounces: p.bounces, hit: p.pierce ? [] : null, chain: p.chain, explode: p.explode, poison: p.poison,
        });
      }
    }
  }

  function outOfRoom(o) { return o.x < IX0 || o.x > IX1 || o.y < IY0 || o.y > IY1; }

  function steerTear(t, room, dt) {
    let best = null, bd = 320;
    for (const e of room.enemies) {
      if (e.hp <= 0 || e.air) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    const sp = Math.hypot(t.vx, t.vy) || 1, a = Math.min(1, dt * 5);
    t.vx += ((best.x - t.x) / (bd || 1) * sp - t.vx) * a;
    t.vy += ((best.y - t.y) / (bd || 1) * sp - t.vy) * a;
    const n = Math.hypot(t.vx, t.vy) || 1;
    t.vx *= sp / n; t.vy *= sp / n;
  }

  function updateTears(s, dt) {
    const room = curRoom(s);
    const alive = [];
    for (const t of s.tears) {
      if (t.homing) steerTear(t, room, dt);
      const px = t.x, py = t.y;
      t.x += t.vx * dt; t.y += t.vy * dt; t.life -= dt;
      let dead = t.life <= 0;
      if (!dead && outOfRoom(t)) {
        if (t.bounces > 0) {
          t.bounces--;
          if (t.x < IX0 || t.x > IX1) { t.vx = -t.vx; t.x = clamp(t.x, IX0, IX1); }
          if (t.y < IY0 || t.y > IY1) { t.vy = -t.vy; t.y = clamp(t.y, IY0, IY1); }
        } else dead = true;
      }
      if (!dead && !t.spectral) {
        const r = hitsRock(room, t.x, t.y, t.size / 2);
        if (r) {
          if (t.bounces > 0) {
            t.bounces--;
            const h = t.size / 2;
            if (px + h <= r.x || px - h >= r.x + r.w) t.vx = -t.vx; else t.vy = -t.vy;
            t.x = px; t.y = py;
          } else dead = true;
        }
      }
      if (!dead) {
        for (const e of room.enemies) {
          if (e.hp <= 0 || e.air || e.phased || !overlap(t, e)) continue;
          if (t.skip === e || (t.hit && t.hit.includes(e))) continue; // já acertou este
          if (e.reflect) { // Espelho: devolve a bolha como tiro inimigo
            shootAng(s, t.x, t.y, aim(t, s.player), 260, { size: 12 });
            dead = true; break;
          }
          if (e.shield || blockedByShield(e, t)) { // escudo: a bolha estoura ou ricocheteia
            if (t.bounces > 0) { reflectOff(t, e); t.skip = e; } else dead = true;
            break;
          }
          hitEnemy(s, e, t.dmg, t);
          if (t.explode) explode(s, t.x, t.y, 64, t.dmg * 0.5, 0, e);
          if (t.hit) { t.hit.push(e); continue; }  // Flecha de Cristal: segue em frente
          if (t.chain > 0 && chainTear(t, room, e)) break; // salta para o próximo inimigo
          if (e.type === 'boss' && t.bounces > 0) { reflectOff(t, e); t.skip = e; break; } // ricocheteia no chefão
          dead = true;
          break;
        }
      }
      if (dead) burst(s, t.x, t.y, t.crit ? '#fff04a' : '#bff3ff', 4, 60); else alive.push(t);
    }
    s.tears = alive;
  }

  // Dano em inimigo: crítico, gelo, veneno, empurrão e número na tela
  function hitEnemy(s, e, dmg, t) {
    e.hp -= dmg; e.flash = 0.1;
    if (t && t.freeze) e.frozen = 2;
    if (t && t.poison) { e.poison = 3; e.poisonDps = Math.max(e.poisonDps, dmg * 0.4); }
    if (t && t.vx !== undefined && e.type !== 'boss' && e.type !== 'turret' && e.type !== 'spinner' && e.type !== 'nest') {
      e.kx += t.vx * 0.6; e.ky += t.vy * 0.6;
    }
    if (t && t.crit) floater(s, e.x, e.y, Math.round(dmg) + '!', '#ffb800', 18);
  }

  // Explosão em área: machuca inimigos (menos "skip") e, se dmgPlayer > 0, o jogador
  function explode(s, x, y, r, dmgEnemies, dmgPlayer, skip) {
    for (const e of curRoom(s).enemies) {
      if (e === skip || e.hp <= 0 || e.air || e.phased) continue;
      if (Math.hypot(e.x - x, e.y - y) < r + e.size / 2) hitEnemy(s, e, dmgEnemies);
    }
    const p = s.player;
    if (dmgPlayer > 0 && Math.hypot(p.x - x, p.y - y) < r + p.size / 2) damagePlayer(s, dmgPlayer, x, y);
    s.fx.push({ x, y, r, t: 0.35, max: 0.35, color: dmgPlayer > 0 ? '#ff6a3c' : '#ffb35c' });
    burst(s, x, y, '#ffb35c', 14, 200);
  }

  // Ricochete: espelha a velocidade na normal entre o inimigo e a bolha e tira a bolha de dentro dele
  function reflectOff(t, e) {
    let nx = t.x - e.x, ny = t.y - e.y;
    const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
    const dot = t.vx * nx + t.vy * ny;
    if (dot < 0) { t.vx -= 2 * dot * nx; t.vy -= 2 * dot * ny; }
    const r = (e.size + t.size) / 2 + 1;
    t.x = e.x + nx * r; t.y = e.y + ny * r;
    t.bounces--;
  }

  // Escudeiro: bloqueia bolhas que chegam pela frente (±60°)
  function blockedByShield(e, t) {
    if (e.type !== 'shielder') return false;
    const sp = Math.hypot(t.vx, t.vy) || 1;
    return (t.vx * Math.cos(e.ang) + t.vy * Math.sin(e.ang)) / sp < -0.5;
  }

  // Ricochete em Cadeia: vira a bolha para o inimigo vivo mais próximo
  function chainTear(t, room, from) {
    let best = null, bd = 280;
    for (const e of room.enemies) {
      if (e === from || e.hp <= 0 || e.air || e.phased) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return false;
    const sp = Math.hypot(t.vx, t.vy) || 400;
    t.vx = (best.x - t.x) / bd * sp; t.vy = (best.y - t.y) / bd * sp;
    t.chain--; t.skip = from; t.life = Math.max(t.life, 0.6);
    return true;
  }

  // Cubinho Orbital e Irmãozinho
  function updateFamiliars(s, dt) {
    const p = s.player, room = curRoom(s);
    if (p.orbital) {
      const a = s.time * 3.2;
      const o = s.orbital = { x: p.x + Math.cos(a) * 52, y: p.y + Math.sin(a) * 52, size: 18 };
      s.bullets = s.bullets.filter(b => {
        if (!overlap(b, o)) return true;
        burst(s, b.x, b.y, '#ffd84a', 4, 60);
        return false;
      });
      for (const e of room.enemies) {
        if (e.hp > 0 && !e.air && !e.shield && !e.phased && overlap(e, o)) { e.hp -= 30 * dt; e.flash = 0.05; }
      }
    } else s.orbital = null;
    if (p.buddy) {
      if (!s.buddy) s.buddy = { x: p.x, y: p.y, cd: 0, size: 18 };
      const b = s.buddy, a = Math.min(1, dt * 6);
      b.x += (p.x - 36 - b.x) * a; b.y += (p.y - 10 - b.y) * a;
      b.cd -= dt;
      const dir = shootDir(s);
      if (dir && b.cd <= 0) {
        b.cd = 0.5;
        const d = DIRS[dir];
        s.tears.push({ x: b.x, y: b.y, vx: d.dx * 400, vy: d.dy * 400, life: 0.8, max: 0.8, size: 10, dmg: 3.5,
          bounces: 0, hit: null, buddy: true });
      }
    } else s.buddy = null;
  }

  function shootAng(s, x, y, ang, speed, extra) {
    const b = { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, size: 12, life: 6, wait: 0, dmg: 1 };
    if (extra) Object.assign(b, extra);
    s.bullets.push(b);
    return b;
  }

  function ring(s, x, y, n, speed, off, extra) {
    for (let i = 0; i < n; i++) shootAng(s, x, y, (off || 0) + i * TAU / n, speed, extra);
  }

  function updateBullets(s, dt) {
    const room = curRoom(s), p = s.player;
    const alive = [];
    for (const b of s.bullets) {
      if (b.wait > 0) b.wait -= dt;
      else { b.x += b.vx * dt; b.y += b.vy * dt; }
      b.life -= dt;
      if (b.life <= 0 || outOfRoom(b) || hitsRock(room, b.x, b.y, b.size / 2)) {
        burst(s, b.x, b.y, '#ff7aa8', 3, 50);
        continue;
      }
      if (overlap(b, p)) { damagePlayer(s, b.dmg, b.x, b.y); continue; }
      alive.push(b);
    }
    s.bullets = alive;
  }

  function laserEnd(l) {
    const c = Math.cos(l.ang), sn = Math.sin(l.ang);
    let t = 3000;
    if (c > 1e-6) t = Math.min(t, (IX1 - l.ox) / c);
    if (c < -1e-6) t = Math.min(t, (IX0 - l.ox) / c);
    if (sn > 1e-6) t = Math.min(t, (IY1 - l.oy) / sn);
    if (sn < -1e-6) t = Math.min(t, (IY0 - l.oy) / sn);
    return { x: l.ox + c * t, y: l.oy + sn * t };
  }

  function updateLasers(s, dt) {
    const p = s.player;
    s.lasers = s.lasers.filter(l => {
      if (l.owner && l.follow) { l.ox = l.owner.x; l.oy = l.owner.y; }
      if (l.tele > 0) { l.tele -= dt; return true; }
      l.life -= dt;
      l.ang += (l.rot || 0) * dt;
      if (l.life <= 0) return false;
      const e = laserEnd(l);
      const hit = segDist(p.x, p.y, l.ox, l.oy, e.x, e.y);
      if (hit.d < l.width / 2 + p.size * 0.35) damagePlayer(s, 2, hit.x, hit.y);
      return true;
    });
  }

  // ---------- Inimigos ----------
  function damagePlayer(s, amount, fx, fy) {
    const p = s.player;
    if (s.godMode || p.shieldTime > 0 || p.inv > 0 || s.status !== 'playing') return false; // código secreto / escudo P
    if (p.shieldUp) { // Manto de Vidro absorve o golpe
      p.shieldUp = false; p.inv = 1.0;
      burst(s, p.x, p.y, '#ffffff', 16, 160);
      return false;
    }
    p.hp -= amount;
    s.floorHit = true; s.combo = 0; s.comboT = 0; // tomar dano quebra o combo
    p.inv = 1.0;
    const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy) || 1;
    p.vx = dx / d * 320; p.vy = dy / d * 320;
    s.shake = 0.25;
    burst(s, p.x, p.y, '#7fe3ff', 10, 140);
    if (p.hp <= 0) { p.hp = 0; s.status = 'dead'; }
    return true;
  }

  const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
  function toIdle(e, t) { e.state = 'idle'; e.timer = t; }

  // IA dos chefões. Cada um tem vários ataques e fica mais agressivo com pouca vida.
  const BOSS_AI = {
    // Inspirado no Monstro: pulinhos, cuspe em leque e o pulão que te persegue pela sombra.
    gelatao(s, e, dt, room, p) {
      const rage = e.hp < e.maxHp / 2;
      e.timer -= dt;
      e.squash *= Math.max(0, 1 - dt * 6);
      if (e.state === 'idle') {
        e.z = 0; e.air = false;
        if (e.timer > 0) return;
        const r = s.rng();
        if (r < 0.4) {
          e.state = 'hop'; e.dur = e.timer = 0.6;
          const a = aim(e, p), d = Math.min(180, Math.hypot(p.x - e.x, p.y - e.y));
          e.sx = e.x; e.sy = e.y; e.tx = e.x + Math.cos(a) * d; e.ty = e.y + Math.sin(a) * d;
        } else if (r < 0.72) { e.state = 'spit'; e.timer = 0.55; }
        else { e.state = 'jumpUp'; e.timer = 0.45; }
      } else if (e.state === 'hop') {
        const f = clamp(1 - e.timer / e.dur, 0, 1);
        e.x = e.sx + (e.tx - e.sx) * f; e.y = e.sy + (e.ty - e.sy) * f;
        clampX(s, e, false); clampY(s, e, false);
        e.z = Math.sin(Math.PI * f) * 50; e.air = e.z > 30;
        if (e.timer <= 0) {
          e.z = 0; e.air = false; e.squash = 1;
          if (rage || s.floor >= 2) ring(s, e.x, e.y, 8, 170, s.rng() * TAU);
          toIdle(e, rage ? 0.35 : 0.7);
        }
      } else if (e.state === 'spit') {
        e.squash = Math.max(e.squash, 1 - e.timer / 0.55);
        if (e.timer <= 0) {
          const a = aim(e, p), n = (rage ? 16 : 11) + 2 * (Math.min(4, s.floor) - 1);
          for (let i = 0; i < n; i++) {
            shootAng(s, e.x, e.y + 10, a + (s.rng() - 0.5) * 0.95, 140 + s.rng() * 180, { size: 10 + s.rng() * 6 });
          }
          e.squash = 0;
          toIdle(e, rage ? 0.5 : 0.85);
        }
      } else if (e.state === 'jumpUp') {
        const f = 1 - Math.max(0, e.timer) / 0.45;
        e.z = f * f * 700; e.air = e.z > 30;
        if (e.timer <= 0) { e.state = 'air'; e.timer = rage ? 1.0 : 1.3; }
      } else if (e.state === 'air') {
        e.z = 700; e.air = true;
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1, v = Math.min(d, 300 * dt);
        e.x += (p.x - e.x) / d * v; e.y += (p.y - e.y) / d * v;
        clampX(s, e, false); clampY(s, e, false);
        if (e.timer <= 0) { e.state = 'fall'; e.timer = 0.35; }
      } else if (e.state === 'fall') {
        const f = Math.max(0, e.timer) / 0.35;
        e.z = 700 * f * f; e.air = e.z > 30;
        if (e.timer <= 0) {
          e.z = 0; e.air = false; e.squash = 1; s.shake = 0.4;
          ring(s, e.x, e.y, 14 + 2 * Math.min(4, s.floor), 190, s.rng() * TAU);
          if (rage) ring(s, e.x, e.y, 10, 120, s.rng() * TAU);
          toIdle(e, rage ? 0.6 : 1.0);
        }
      }
    },

    // Inspirado no Duke of Flies: quica pela sala, cria bolhas em órbita e as lança em você.
    duque(s, e, dt, room) {
      const rage = e.hp < e.maxHp / 2;
      if (!e.vx && !e.vy) { e.vx = e.speed; e.vy = e.speed * 0.8; }
      const sp = rage ? 1.5 : 1, h = e.size / 2;
      e.x += e.vx * sp * dt; e.y += e.vy * sp * dt;
      if ((e.x - h < IX0 && e.vx < 0) || (e.x + h > IX1 && e.vx > 0)) e.vx *= -1;
      if ((e.y - h < IY0 && e.vy < 0) || (e.y + h > IY1 && e.vy > 0)) e.vy *= -1;
      clampX(s, e, false); clampY(s, e, false);
      e.z = 14 + Math.sin(e.t * 2) * 6;
      e.timer -= dt;
      if (e.timer > 0) return;
      const mine = room.enemies.filter(o => o.type === 'orbiter' && o.parent === e && !o.launched);
      const step = e.cycle++ % 3;
      if (step === 0) {
        const total = room.enemies.filter(o => o.type === 'orbiter').length;
        const n = Math.min(rage ? 5 : 3, 9 - total);
        for (let i = 0; i < n; i++) {
          const o = makeEnemy(s, { type: 'orbiter', x: e.x, y: e.y, summoned: true });
          o.parent = e; o.ang = i * TAU / n + e.t;
          room.enemies.push(o);
        }
        e.state = 'summon';
      } else if (step === 1 && mine.length) {
        mine.forEach(o => { o.launched = true; });
        e.state = 'release';
      } else {
        ring(s, e.x, e.y, rage ? 14 : 10, 170, e.t);
        if (rage) ring(s, e.x, e.y, 14, 110, e.t + 0.22);
        e.state = 'burst';
      }
      e.timer = rage ? 1.3 : 1.9;
    },

    // Chefão de laser: avisa com uma linha fina e depois dispara o raio. Se teleporta e faz espirais.
    prisma(s, e, dt, room, p) {
      const rage = e.hp < e.maxHp / 2;
      e.spin += dt * (rage ? 2.6 : 1.4);
      e.z = 22 + Math.sin(e.t * 3) * 6;
      e.timer -= dt;
      switch (e.state) {
        case 'idle': {
          e.alpha = 1; e.air = false;
          if (e.timer > 0) break;
          const seq = ['laser', 'spiral', 'tele', 'burst', 'laser', 'tele'];
          e.state = seq[e.cycle++ % seq.length];
          if (e.state === 'laser') {
            const n = rage ? 3 : 1, base = aim(e, p);
            for (let i = 0; i < n; i++) {
              s.lasers.push({ ox: e.x, oy: e.y, ang: base + (i - (n - 1) / 2) * 0.5, tele: 0.9, life: 0.8,
                width: 26, rot: rage ? (i - 1) * 0.5 : 0, owner: e });
            }
            e.timer = 1.8;
          } else if (e.state === 'spiral') { e.timer = 2.6; e.emit = 0; }
          else if (e.state === 'tele') { e.timer = 0.4; }
          else { e.timer = 1.1; e.emit = 0; e.shots = 0; }
          break;
        }
        case 'laser':
          if (e.timer <= 0) toIdle(e, rage ? 0.3 : 0.6);
          break;
        case 'spiral':
          e.emit -= dt;
          if (e.emit <= 0) {
            e.emit = rage ? 0.08 : 0.12;
            const arms = rage ? 5 : 4;
            for (let i = 0; i < arms; i++) shootAng(s, e.x, e.y, e.spin + i * TAU / arms, 150);
          }
          if (e.timer <= 0) toIdle(e, 0.6);
          break;
        case 'tele':
          e.alpha = Math.max(0, e.timer / 0.4); e.air = true;
          if (e.timer <= 0) {
            for (let i = 0; i < 30; i++) {
              const x = IX0 + 80 + s.rng() * (IX1 - IX0 - 160), y = IY0 + 80 + s.rng() * (IY1 - IY0 - 160);
              e.x = x; e.y = y;
              if (Math.hypot(x - p.x, y - p.y) > 240) break;
            }
            e.state = 'teleIn'; e.timer = 0.4;
          }
          break;
        case 'teleIn':
          e.alpha = 1 - Math.max(0, e.timer / 0.4); e.air = e.timer > 0.15;
          if (e.timer <= 0) { e.alpha = 1; e.air = false; toIdle(e, 0.3); }
          break;
        case 'burst':
          e.emit -= dt;
          if (e.emit <= 0 && e.shots < 3) {
            e.emit = 0.35; e.shots++;
            const a = aim(e, p), n = rage ? 7 : 5;
            for (let i = 0; i < n; i++) shootAng(s, e.x, e.y, a + (i - (n - 1) / 2) * 0.22, 230);
          }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
      }
    },

    // Big Boss em 4 fases: investidas, espirais, invocações e cruz de lasers giratória.
    hipercubo(s, e, dt, room, p) {
      const frac = e.hp / e.maxHp;
      const phase = frac > 0.75 ? 1 : frac > 0.5 ? 2 : frac > 0.25 ? 3 : 4;
      if (phase > e.phase) {
        e.phase = phase; e.state = 'shift'; e.timer = 1.2; e.shield = true; e.air = false; e.z = 0;
        s.bullets = []; s.lasers = []; s.shake = 0.5;
        s.msg = { title: phase === 4 ? 'FASE FINAL' : 'FASE ' + phase, sub: phase === 4 ? 'O Big Boss perdeu a paciência' : phase === 3 ? 'Fúria total' : 'O cubo se dobra...', t: 1.4 };
      }
      e.spin += dt * (1 + e.phase);
      e.timer -= dt;
      switch (e.state) {
        case 'shift':
          if (e.timer <= 0) { e.shield = false; toIdle(e, 0.3); }
          break;
        case 'idle': {
          e.z = 0;
          if (e.timer > 0) break;
          const seqs = {
            1: ['charge', 'stomp', 'charge', 'spiral'],
            2: ['charge', 'spiral', 'summon', 'charge', 'stomp'],
            3: ['cross', 'charge', 'stomp', 'charge', 'spiral'],
            4: ['cross', 'charge', 'spiral', 'summon', 'charge', 'stomp'],
          };
          const seq = seqs[e.phase];
          const next = seq[e.cycle++ % seq.length];
          if (next === 'charge') { e.state = 'chargeWind'; e.timer = e.phase >= 3 ? 0.45 : 0.7; e.cang = aim(e, p); }
          else if (next === 'stomp') { e.state = 'stomp'; e.timer = 0.6; }
          else if (next === 'spiral') { e.state = 'spiral'; e.timer = 2.8; e.emit = 0; }
          else if (next === 'summon') {
            e.state = 'summon'; e.timer = 0.6;
            if (room.enemies.filter(o => o.type === 'grunt').length < 3) {
              room.enemies.push(makeEnemy(s, { type: 'grunt', x: clamp(e.x - 80, IX0 + 20, IX1 - 20), y: e.y, summoned: true }));
              room.enemies.push(makeEnemy(s, { type: 'grunt', x: clamp(e.x + 80, IX0 + 20, IX1 - 20), y: e.y, summoned: true }));
            }
          } else { e.state = 'crossMove'; e.timer = 0.6; e.sx = e.x; e.sy = e.y; }
          break;
        }
        case 'chargeWind':
          if (e.timer <= 0) { e.state = 'charging'; e.timer = 1.6; e.emit = 0; }
          break;
        case 'charging': {
          const sp = 520 + 60 * e.phase, ox = e.x, oy = e.y;
          moveEntity(s, e, Math.cos(e.cang) * sp * dt, Math.sin(e.cang) * sp * dt, false);
          e.emit -= dt;
          if (e.emit <= 0) {
            e.emit = 0.07;
            if (e.phase === 1) shootAng(s, e.x, e.y, 0, 0, { life: 1.0 });
            else {
              shootAng(s, e.x, e.y, e.cang + Math.PI / 2, 90, { wait: 0.35 });
              shootAng(s, e.x, e.y, e.cang - Math.PI / 2, 90, { wait: 0.35 });
            }
          }
          if (Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.5 || e.timer <= 0) {
            ring(s, e.x, e.y, 10 + 4 * e.phase, 200, s.rng() * TAU);
            s.shake = 0.35;
            toIdle(e, e.phase >= 3 ? 0.35 : 0.7);
          }
          break;
        }
        case 'stomp': {
          const f = 1 - Math.max(0, e.timer) / 0.6;
          e.z = Math.sin(Math.PI * f) * 60; e.air = e.z > 30;
          if (e.timer <= 0) {
            e.z = 0; e.air = false; s.shake = 0.3;
            ring(s, e.x, e.y, 18, 180, e.spin);
            if (e.phase >= 2) ring(s, e.x, e.y, 18, 120, e.spin + 0.17);
            if (e.phase >= 3) ring(s, e.x, e.y, 12, 250, e.spin + 0.3);
            toIdle(e, 0.6);
          }
          break;
        }
        case 'spiral':
          e.emit -= dt;
          if (e.emit <= 0) {
            e.emit = 0.09;
            const arms = e.phase + 1;
            for (let i = 0; i < arms; i++) {
              shootAng(s, e.x, e.y, e.spin + i * TAU / arms, 160);
              if (e.phase >= 3) shootAng(s, e.x, e.y, -e.spin + i * TAU / arms, 130);
            }
          }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
        case 'summon':
          if (e.timer <= 0) toIdle(e, 0.4);
          break;
        case 'crossMove': {
          const f = 1 - Math.max(0, e.timer) / 0.6;
          e.x = e.sx + (W / 2 - e.sx) * f; e.y = e.sy + (H / 2 - e.sy) * f;
          if (e.timer <= 0) {
            const a0 = s.rng() * Math.PI;
            for (let i = 0; i < 4; i++) {
              s.lasers.push({ ox: e.x, oy: e.y, ang: a0 + i * Math.PI / 2, tele: 1.0, life: 3.6,
                width: 24, rot: e.phase === 4 ? 0.8 : 0.55, owner: e, follow: true });
            }
            e.state = 'cross'; e.timer = 4.6; e.emit = 1.2;
          }
          break;
        }
        case 'cross':
          e.emit -= dt;
          if (e.emit <= 0) { e.emit = 1.1; ring(s, e.x, e.y, 12, 150, e.spin); }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
      }
    },

    // Rainha Colmeia: invoca moscas, solta anéis de balas e dá investidas
    colmeia(s, e, dt, room, p) {
      const rage = e.hp < e.maxHp / 2;
      e.timer -= dt;
      e.z = 16 + Math.sin(e.t * 4) * 5;
      switch (e.state) {
        case 'idle': {
          moveEntity(s, e, Math.cos(e.t * 0.7) * e.speed * dt, Math.sin(e.t * 1.3) * e.speed * 0.6 * dt, false, true);
          if (e.timer > 0) break;
          const seq = ['summon', 'ring', 'charge', 'ring', 'charge'];
          const next = seq[e.cycle++ % seq.length];
          if (next === 'summon') {
            const n = Math.min(rage ? 5 : 3, 8 - room.enemies.filter(o => o.type === 'fly').length);
            for (let i = 0; i < n; i++) {
              room.enemies.push(makeEnemy(s, { type: 'fly', x: e.x + Math.cos(i * TAU / n) * 50, y: e.y + Math.sin(i * TAU / n) * 50, summoned: true }));
            }
            e.state = 'summon'; e.timer = 0.7;
          } else if (next === 'ring') { e.state = 'ring'; e.timer = 1.2; e.emit = 0; e.shots = 0; }
          else { e.state = 'chargeWind'; e.timer = 0.7; e.cang = aim(e, p); }
          break;
        }
        case 'summon':
          if (e.timer <= 0) toIdle(e, 0.6);
          break;
        case 'ring':
          e.emit -= dt;
          if (e.emit <= 0 && e.shots < (rage ? 3 : 2)) { e.emit = 0.4; e.shots++; ring(s, e.x, e.y, rage ? 14 : 10, 160, e.shots * 0.25 + e.t); }
          if (e.timer <= 0) toIdle(e, 0.6);
          break;
        case 'chargeWind':
          if (e.timer <= 0) { e.state = 'charging'; e.timer = 1.2; }
          break;
        case 'charging': {
          const sp = rage ? 520 : 440, ox = e.x, oy = e.y;
          moveEntity(s, e, Math.cos(e.cang) * sp * dt, Math.sin(e.cang) * sp * dt, false, true);
          if (Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.5 || e.timer <= 0) {
            ring(s, e.x, e.y, 8, 180, s.rng() * TAU); s.shake = 0.25;
            toIdle(e, rage ? 0.5 : 0.9);
          }
          break;
        }
      }
    },

    // Espelho: fase de reflexo (bolhas voltam como tiros), cria reflexos e se teleporta
    espelho(s, e, dt, room, p) {
      const rage = e.hp < e.maxHp / 2;
      e.timer -= dt; e.spin += dt * 1.2;
      switch (e.state) {
        case 'idle': {
          e.reflect = false; e.alpha = 1; e.air = false;
          const a = aim(e, p) + Math.PI / 2; // anda de lado, em volta do jogador
          moveEntity(s, e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt, false, true);
          if (e.timer > 0) break;
          const seq = ['fan', 'mirror', 'clone', 'fan', 'mirror', 'tele'];
          e.state = seq[e.cycle++ % seq.length];
          if (e.state === 'fan') { e.timer = 1.2; e.emit = 0; e.shots = 0; }
          else if (e.state === 'mirror') { e.timer = rage ? 3.0 : 2.4; e.reflect = true; e.emit = 0.6; }
          else if (e.state === 'clone') {
            e.timer = 0.6;
            if (room.enemies.filter(o => o.type === 'clone').length < (rage ? 3 : 2)) {
              for (const side of [-1, 1]) {
                room.enemies.push(makeEnemy(s, { type: 'clone', x: clamp(e.x + side * 90, IX0 + 30, IX1 - 30), y: e.y, summoned: true }));
              }
            }
          } else e.timer = 0.4;
          break;
        }
        case 'fan':
          e.emit -= dt;
          if (e.emit <= 0 && e.shots < 3) {
            e.emit = 0.35; e.shots++;
            const a = aim(e, p), n = rage ? 7 : 5;
            for (let i = 0; i < n; i++) shootAng(s, e.x, e.y, a + (i - (n - 1) / 2) * 0.2, 220);
          }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
        case 'mirror':
          e.emit -= dt;
          if (e.emit <= 0) { e.emit = 0.8; ring(s, e.x, e.y, 8, 120, e.spin); }
          if (e.timer <= 0) { e.reflect = false; toIdle(e, 0.5); }
          break;
        case 'clone':
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
        case 'tele':
          e.alpha = Math.max(0, e.timer / 0.4); e.air = true;
          if (e.timer <= 0) {
            for (let i = 0; i < 30; i++) {
              e.x = IX0 + 80 + s.rng() * (IX1 - IX0 - 160); e.y = IY0 + 80 + s.rng() * (IY1 - IY0 - 160);
              if (Math.hypot(e.x - p.x, e.y - p.y) > 240) break;
            }
            e.state = 'teleIn'; e.timer = 0.4;
          }
          break;
        case 'teleIn':
          e.alpha = 1 - Math.max(0, e.timer / 0.4); e.air = e.timer > 0.15;
          if (e.timer <= 0) { e.alpha = 1; e.air = false; toIdle(e, 0.3); }
          break;
      }
    },
  };

  function updateEnemies(s, dt) {
    const room = curRoom(s), p = s.player;
    for (const e of room.enemies.slice()) {
      e.flash = Math.max(0, e.flash - dt);
      e.t += dt;
      if (s.grace > 0 || e.hp <= 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const edt = e.frozen > 0 ? dt * 0.4 : dt; // Bolha Gelada: inimigo lento
      if (e.frozen > 0) e.frozen -= dt;
      if (e.poison > 0) { // Bolha Venenosa: dano contínuo
        e.poison -= dt; e.hp -= e.poisonDps * dt;
        if (Math.random() < dt * 6) burst(s, e.x, e.y, '#9be33c', 1, 40);
      }
      if (ENEMY_AI[e.type]) {
        ENEMY_AI[e.type](s, e, edt, room, p, ux, uy, dist);
      } else if (e.type === 'boss') {
        BOSS_AI[e.kind](s, e, edt, room, p);
      } else if (e.type === 'fly') {
        const wob = Math.sin(e.t * 6) * 45;
        moveEntity(s, e, (ux * e.speed - uy * wob + e.kx) * edt, (uy * e.speed + ux * wob + e.ky) * edt, false, true);
      } else if (e.type === 'orbiter') {
        const par = e.parent;
        if (!e.launched && (!par || par.hp <= 0 || !room.enemies.includes(par))) e.launched = true;
        if (!e.launched) {
          e.ang += 2.4 * edt;
          const r = par.size / 2 + 34;
          e.x = par.x + Math.cos(e.ang) * r; e.y = par.y + Math.sin(e.ang) * r;
          clampX(s, e, false); clampY(s, e, false);
        } else {
          const a = Math.min(1, edt * 2.5);
          e.vx += (ux * e.speed - e.vx) * a; e.vy += (uy * e.speed - e.vy) * a;
          moveEntity(s, e, (e.vx + e.kx) * edt, (e.vy + e.ky) * edt, false, true);
        }
      } else if (e.type === 'grunt') {
        moveEntity(s, e, (ux * e.speed + e.kx) * edt, (uy * e.speed + e.ky) * edt, false);
      } else if (e.type === 'turret') {
        e.cd -= edt;
        if (e.cd <= 0) { e.cd = Math.max(0.9, 1.8 - 0.1 * (s.floor - 1)); shootAng(s, e.x, e.y, Math.atan2(uy, ux), 210); }
      }
      const decay = Math.max(0, 1 - dt * 8);
      e.kx *= decay; e.ky *= decay;
      if (e.hp > 0 && !e.air && !e.phased && overlap(e, p)) damagePlayer(s, e.type === 'boss' ? 2 : 1, e.x, e.y);
    }
  }

  // IA dos monstros novos (um a cada andar)
  const ENEMY_AI = {
    // Gosma: anda aos pulinhos; ao morrer vira 2 mini-gosmas (em cleanupEnemies)
    splitter(s, e, dt, room, p, ux, uy) {
      const hop = 0.3 + 0.7 * Math.abs(Math.sin(e.t * 4));
      moveEntity(s, e, (ux * e.speed * hop + e.kx) * dt, (uy * e.speed * hop + e.ky) * dt, false);
    },
    slimelet(s, e, dt, room, p, ux, uy) {
      moveEntity(s, e, (ux * e.speed + e.kx) * dt, (uy * e.speed + e.ky) * dt, false);
    },
    // Investida: mira, pisca e dispara em linha reta; bater numa pedra deixa tonto
    charger(s, e, dt, room, p, ux, uy, dist) {
      e.timer -= dt;
      if (e.state === 'idle') {
        moveEntity(s, e, (ux * e.speed + e.kx) * dt, (uy * e.speed + e.ky) * dt, false);
        e.cd -= dt;
        if (e.cd <= 0 && dist < 380) { e.state = 'chargeWind'; e.timer = 0.6; e.cang = Math.atan2(uy, ux); }
      } else if (e.state === 'chargeWind') {
        if (e.timer <= 0) { e.state = 'charging'; e.timer = 0.9; }
      } else if (e.state === 'charging') {
        const sp = 430, ox = e.x, oy = e.y;
        moveEntity(s, e, Math.cos(e.cang) * sp * dt, Math.sin(e.cang) * sp * dt, false);
        const stuck = Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.5;
        if (stuck) { e.state = 'stun'; e.timer = 1.1; s.shake = Math.max(s.shake, 0.12); burst(s, e.x, e.y, '#ffffff', 8, 120); }
        else if (e.timer <= 0) { e.state = 'idle'; e.cd = 1.4; }
      } else if (e.state === 'stun' && e.timer <= 0) { e.state = 'idle'; e.cd = 1.2; }
    },
    // Roda: torre que gira e solta um anel de 8 balas
    spinner(s, e, dt) {
      e.ang += dt * 1.5;
      e.cd -= dt;
      if (e.cd <= 0) { e.cd = Math.max(1.6, 2.6 - 0.1 * (s.floor - 4)); ring(s, e.x, e.y, 8, 150, e.ang); }
    },
    // Bomba: corre até você, acende o pavio e explode (morta de longe, explode lá mesmo)
    bomber(s, e, dt, room, p, ux, uy, dist) {
      if (e.state === 'fuse') {
        e.timer -= dt;
        if (e.timer <= 0) e.hp = 0; // a explosão acontece em cleanupEnemies
        return;
      }
      moveEntity(s, e, (ux * e.speed + e.kx) * dt, (uy * e.speed + e.ky) * dt, false);
      if (dist < 70) { e.state = 'fuse'; e.timer = 0.6; }
    },
    // Fantasma: atravessa pedras e some de tempos em tempos (invisível = intocável)
    ghost(s, e, dt, room, p, ux, uy) {
      const cyc = e.t % 3.4;
      e.phased = cyc > 2.2;
      e.alpha = e.phased ? 0.18 : cyc < 0.3 ? 0.18 + cyc / 0.3 * 0.82 : 1;
      const wob = Math.sin(e.t * 3) * 30;
      moveEntity(s, e, (ux * e.speed - uy * wob + e.kx) * dt, (uy * e.speed + ux * wob + e.ky) * dt, false, true);
    },
    // Escudeiro: vira devagar para você; o escudo da frente bloqueia bolhas
    shielder(s, e, dt, room, p, ux, uy) {
      const want = Math.atan2(uy, ux);
      let da = want - e.ang;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      e.ang += clamp(da, -1.6 * dt, 1.6 * dt);
      moveEntity(s, e, (ux * e.speed + e.kx) * dt, (uy * e.speed + e.ky) * dt, false);
    },
    // Curandeiro: foge de você e cura quem está perto
    healer(s, e, dt, room, p, ux, uy, dist) {
      const away = dist < 240 ? -1 : 0.3, wob = Math.sin(e.t * 2) * 60;
      moveEntity(s, e, (ux * e.speed * away - uy * wob + e.kx) * dt, (uy * e.speed * away + ux * wob + e.ky) * dt, false);
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = 1.6;
        for (const o of room.enemies) {
          if (o === e || o.hp <= 0 || o.type === 'boss' || Math.hypot(o.x - e.x, o.y - e.y) > 170) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15);
          burst(s, o.x, o.y, '#5cf28a', 5, 80);
        }
        s.fx.push({ x: e.x, y: e.y, r: 170, t: 0.4, max: 0.4, color: '#5cf28a' });
      }
    },
    // Ninho: parado, solta moscas de tempos em tempos
    nest(s, e, dt, room) {
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = 3.5;
        if (room.enemies.filter(o => o.type === 'fly').length < 6) {
          room.enemies.push(makeEnemy(s, { type: 'fly', x: e.x, y: e.y + e.size / 2 + 6, summoned: true }));
          burst(s, e.x, e.y, '#ffb32b', 6, 90);
        }
      }
    },
    // Reflexo do Espelho: corre atrás de você
    clone(s, e, dt, room, p, ux, uy) {
      moveEntity(s, e, (ux * e.speed + e.kx) * dt, (uy * e.speed + e.ky) * dt, false);
    },
  };

  function cleanupEnemies(s) {
    const room = curRoom(s);
    const alive = [];
    const spawned = [];
    let bossDied = false;
    for (const e of room.enemies) {
      if (e.hp > 0) { alive.push(e); continue; }
      s.kills++;
      const p = s.player;
      if (p.vampire && ++p.vampKills % 8 === 0 && p.hp < p.maxHp) {
        p.hp++;
        burst(s, p.x, p.y, '#ff4f6d', 10, 100);
      }
      burst(s, e.x, e.y, enemyColor(e), e.type === 'boss' ? 50 : 12, e.type === 'boss' ? 300 : 150);
      addCombo(s);
      dropRewards(s, room, e);
      if (e.type === 'splitter') { // Gosma vira 2 mini-gosmas
        for (const side of [-1, 1]) {
          const m = makeEnemy(s, { type: 'slimelet', x: e.x + side * 14, y: e.y, summoned: true });
          m.xp = 1; m.kx = side * 160;
          spawned.push(m);
        }
      }
      if (e.type === 'bomber') explode(s, e.x, e.y, 80, 12, 1, e); // explode onde estiver
      if (e.type === 'boss') { bossDied = true; s.bossKills++; }
      else if (s.rng() < 0.1) room.pickups.push({ type: 'heart', x: e.x, y: e.y, size: 20 });
    }
    room.enemies = alive.concat(spawned); // quem morreu na explosão é contado no próximo quadro
    if (bossDied) {
      // derrotar o chefão destrói os lacaios e limpa os tiros
      for (const e of room.enemies) burst(s, e.x, e.y, enemyColor(e), 10, 120);
      room.enemies = [];
      s.bullets = []; s.lasers = [];
      s.shake = 0.6;
    }
  }

  // Orbes de XP e moedas (invocados não dão nada)
  function dropRewards(s, room, e) {
    if (e.xp > 0) {
      const n = Math.min(6, Math.ceil(e.xp / 3)), each = e.xp / n;
      for (let i = 0; i < n; i++) {
        const a = s.rng() * TAU, v = 60 + s.rng() * 120;
        room.pickups.push({ type: 'xp', x: e.x, y: e.y, size: 12, value: each, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0 });
      }
    }
    if (e.summoned && e.type !== 'boss') return;
    let coins = e.type === 'boss' ? 8 : e.elite ? 3 : s.rng() < 0.35 ? 1 : 0;
    if (coins && s.talent.coins > 1 && s.rng() < s.talent.coins - 1) coins++;
    for (let i = 0; i < coins; i++) {
      const a = s.rng() * TAU, v = 40 + s.rng() * 100;
      room.pickups.push({ type: 'coin', x: e.x, y: e.y, size: 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0 });
    }
  }

  // Combo: abates em sequência rápida multiplicam o XP (até 2x)
  const COMBO_TIME = 2.5;
  function addCombo(s) {
    s.combo = s.comboT > 0 ? s.combo + 1 : 1;
    s.comboT = COMBO_TIME;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
  }
  const comboMult = s => 1 + 0.1 * Math.min(10, Math.max(0, s.combo - 1));

  function gainXp(s, amount) {
    const v = amount * comboMult(s) * s.talent.xp;
    s.xp += v; s.xpTotal += v;
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      s.pendingLevels++;
    }
  }

  // ---------- Subir de nível: 3 cartas de melhoria ----------
  function openLevelUp(s) {
    const pool = SKILLS.filter(k => (s.skills[k.id] || 0) < SKILL_MAX);
    const cards = [];
    while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(s.rng() * pool.length), 1)[0].id);
    s.levelUp = { cards, index: 0 };
    burst(s, s.player.x, s.player.y, '#fff04a', 30, 220);
  }

  function chooseCard(s, i) {
    const lu = s.levelUp;
    if (!lu) return;
    const p = s.player;
    if (lu.cards.length) {
      const sk = SKILLS.find(k => k.id === lu.cards[clamp(i, 0, lu.cards.length - 1)]);
      sk.apply(p);
      s.skills[sk.id] = (s.skills[sk.id] || 0) + 1;
      floater(s, p.x, p.y - 30, sk.name + ' ' + s.skills[sk.id], sk.color, 18);
    } else p.hp = Math.min(p.maxHp, p.hp + 2); // tudo no máximo: cura
    s.levelUp = null;
    s.pendingLevels = Math.max(0, s.pendingLevels - 1);
    p.inv = Math.max(p.inv, 0.8); // um respiro depois de escolher
    s.keys = {}; s.lastArrow = null;
  }

  function checkRoomClear(s) {
    const room = curRoom(s);
    if (room.cleared || room.enemies.length) return;
    room.cleared = true;
    if (room.type === 'boss') {
      room.pickups.push({ type: 'heart', x: W / 2 - 150, y: H / 2, size: 20 });
      room.item = { x: W / 2 + 150, y: H / 2, size: 30, id: pickItemId(s), taken: false };
      if (s.floor >= MAX_FLOOR) {
        endFloor(s);
        s.status = 'won';
      } else {
        room.trapdoor = { x: W / 2, y: H / 2, size: 54, armed: false };
        s.msg = { title: 'Chefão derrotado!', sub: 'Pegue o prêmio e pule no portal', t: 3 };
      }
    } else if (s.rng() < 0.25) {
      room.pickups.push({ type: 'heart', x: W / 2, y: H / 2, size: 20 });
    }
  }

  // Fecha o andar: parcial do cronômetro e "andar sem dano"
  function endFloor(s) {
    const split = s.runTime - s.floorStart, best = getSave().records.bestSplits[s.floor - 1];
    s.splits.push(split);
    s.floorStart = s.runTime;
    s.splitInfo = { floor: s.floor, time: split, delta: best == null ? null : split - best, t: 4 };
    if (!s.floorHit) s.cleanFloors++;
    s.floorHit = false;
  }

  function nextFloor(s) {
    endFloor(s);
    s.floor++;
    generateFloor(s);
    const p = s.player;
    p.x = W / 2; p.y = H / 2; p.vx = 0; p.vy = 0;
    s.tears = []; s.bullets = []; s.lasers = [];
    s.msg = floorMsg(s);
  }

  function giveItem(s, id, silent) {
    const def = ITEMS.find(i => i.id === id), p = s.player;
    def.apply(p);
    p.items.push(def.id);
    if (silent) return;
    s.msg = { title: def.name, sub: def.desc, t: 3 };
    burst(s, p.x, p.y, def.color, 24, 170);
  }

  // Loja: andar até o pedestal com moedas suficientes compra
  function buy(s, slot) {
    const p = s.player;
    if (slot.kind === 'heart' && p.hp >= p.maxHp) return;
    s.coins -= slot.price;
    slot.sold = true;
    s.purchases++;
    if (slot.kind === 'item') giveItem(s, slot.id);
    else if (slot.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 2); s.msg = { title: 'Coração', sub: 'Meio... não, um coração inteiro!', t: 2 }; }
    else { s.pendingLevels++; s.msg = { title: 'Carta de melhoria', sub: 'Escolha uma habilidade', t: 2 }; }
    burst(s, slot.x, slot.y, '#ffd84a', 24, 170);
  }

  function updatePickups(s, dt) {
    const room = curRoom(s), p = s.player;
    room.pickups = room.pickups.filter(pk => {
      if (pk.type === 'xp' || pk.type === 'coin') {
        pk.t += dt;
        pk.x += pk.vx * dt; pk.y += pk.vy * dt;
        pk.vx *= Math.max(0, 1 - dt * 5); pk.vy *= Math.max(0, 1 - dt * 5);
        const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
        // XP voa sozinho até o jogador; moedas só com o ímã (ou encostando)
        const pull = pk.type === 'xp' ? pk.t > 0.35 : d < 40 + p.magnet;
        if (pull) {
          const v = Math.min(d, (pk.type === 'xp' ? 420 : 320) * dt + pk.t * 6);
          pk.x += (p.x - pk.x) / d * v; pk.y += (p.y - pk.y) / d * v;
        }
        pk.x = clamp(pk.x, IX0 + 8, IX1 - 8); pk.y = clamp(pk.y, IY0 + 8, IY1 - 8);
        if (!overlap(pk, p)) return true;
        if (pk.type === 'xp') gainXp(s, pk.value);
        else { s.coins++; s.coinsMax = Math.max(s.coinsMax, s.coins); floater(s, p.x, p.y - 26, '+1', '#ffc400', 14); }
        return false;
      }
      if (pk.type === 'heart' && p.magnet > 0 && p.hp < p.maxHp) {
        const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
        if (d < p.magnet) { pk.x += (p.x - pk.x) / d * 200 * dt; pk.y += (p.y - pk.y) / d * 200 * dt; }
      }
      if (pk.type === 'heart' && overlap(pk, p) && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 2);
        burst(s, pk.x, pk.y, '#ff6f9f', 8, 90);
        return false;
      }
      return true;
    });
    const it = room.item;
    if (it && !it.taken && overlap(it, p)) {
      giveItem(s, it.id);
      it.taken = true;
    }
    if (room.shop) {
      for (const slot of room.shop) if (!slot.sold && s.coins >= slot.price && overlap(slot, p)) buy(s, slot);
    }
    const td = room.trapdoor;
    if (td) {
      if (!overlap(td, p)) td.armed = true;
      else if (td.armed && Math.hypot(td.x - p.x, td.y - p.y) < 20) nextFloor(s);
    }
  }

  // Números e textos que sobem e somem (dano crítico, moedas, melhorias)
  function floater(s, x, y, text, color, size) {
    s.floaters.push({ x, y, text, color, size: size || 14, t: 1, max: 1 });
  }

  // ---------- Fim de partida, recordes e conquistas ----------
  function runSnapshot(s) {
    const st = getSave().stats;
    return {
      floor: s.floor, kills: s.kills, level: s.level, bestCombo: s.bestCombo, time: s.runTime, won: s.status === 'won',
      coinsMax: s.coinsMax, items: s.player.items.length, cleanFloors: s.cleanFloors, usedShield: s.usedShield,
      bossKills: s.bossKills, purchases: s.purchases, xp: s.xpTotal, splits: s.splits,
      totalKills: st.kills + s.kills, totalBossKills: st.bossKills + s.bossKills, totalPurchases: st.purchases + s.purchases,
    };
  }

  // O modo indestrutível (código 1234) não conta para conquistas, recordes nem XP de conta
  function checkAchievements(s) {
    if (s.godMode) return;
    const fresh = P.unlock(getSave(), runSnapshot(s));
    if (!fresh.length) return;
    for (const a of fresh) s.toasts.push({ title: a.name, sub: a.desc, t: 4 });
    persist();
  }

  function finishRun(s) {
    if (s.runSaved) return;
    s.runSaved = true;
    const before = P.accountLevel(getSave().accountXp).level;
    if (s.godMode) { s.result = { records: [], xp: 0, levelUp: false }; return; }
    checkAchievements(s);
    const records = P.recordRun(getSave(), runSnapshot(s));
    persist();
    s.result = { records, xp: Math.floor(s.xpTotal), levelUp: P.accountLevel(getSave().accountXp).level > before };
  }

  // ---------- Partículas ----------
  function burst(s, x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
      s.particles.push({ x, y, z: 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 60 + Math.random() * 120,
        life: 0.5, max: 0.5, color, size: 3 + Math.random() * 4 });
    }
  }

  function updateParticles(s, dt) {
    for (const q of s.particles) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt);
      q.vz -= 500 * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt;
    }
    s.particles = s.particles.filter(q => q.life > 0);
  }

  // Textos flutuantes, avisos de conquista, ondas de explosão e o parcial do andar
  function updateEffects(s, dt) {
    for (const f of s.floaters) { f.t -= dt; f.y -= 40 * dt; }
    s.floaters = s.floaters.filter(f => f.t > 0);
    for (const f of s.fx) f.t -= dt;
    s.fx = s.fx.filter(f => f.t > 0);
    if (s.toasts.length) { s.toasts[0].t -= dt; if (s.toasts[0].t <= 0) s.toasts.shift(); }
    if (s.splitInfo) { s.splitInfo.t -= dt; if (s.splitInfo.t <= 0) s.splitInfo = null; }
  }

  // ---------- Loop principal ----------
  function update(s, dt) {
    dt = Math.min(dt, 0.05);
    s.time += dt;
    updateParticles(s, dt);
    updateEffects(s, dt);
    if (s.msg) { s.msg.t -= dt; if (s.msg.t <= 0) s.msg = null; }
    if (s.status === 'menu' && s.cheatNotice > 0) {
      s.cheatNotice -= dt;
      if (s.cheatNotice <= 0) { s.cheatNotice = 0; startGame(s); }
      return;
    }
    if (s.status !== 'playing') { if (s.status !== 'menu') finishRun(s); return; }
    if (s.paused) return;
    s.runTime += dt; // cronômetro de speedrun: para na pausa, mas corre na escolha de cartas
    if (s.levelUp) return;
    if (s.pendingLevels > 0) { openLevelUp(s); return; }
    s.grace = Math.max(0, s.grace - dt);
    s.shake = Math.max(0, s.shake - dt);
    s.player.inv = Math.max(0, s.player.inv - dt);
    s.player.shieldTime = Math.max(0, s.player.shieldTime - dt);
    s.player.shieldCd = Math.max(0, s.player.shieldCd - dt);
    s.comboT = Math.max(0, s.comboT - dt);
    if (s.comboT === 0) s.combo = 0;
    updatePlayer(s, dt);
    if (checkTransition(s)) return;
    updateShooting(s, dt);
    updateTears(s, dt);
    updateEnemies(s, dt);
    updateBullets(s, dt);
    updateLasers(s, dt);
    updateFamiliars(s, dt);
    cleanupEnemies(s);
    checkRoomClear(s);
    updatePickups(s, dt);
    s.achT -= dt;
    if (s.achT <= 0) { s.achT = 0.5; checkAchievements(s); }
    if (s.status !== 'playing') finishRun(s);
  }

  // ---------- Entrada ----------
  // Escudo da tecla P: 10 s sem tomar dano; recarrega 20 s depois de ativado (menos com melhorias)
  function activateShield(s) {
    const p = s.player;
    if (p.shieldTime > 0 || p.shieldCd > 0) return false;
    p.shieldTime = SHIELD_TIME;
    p.shieldCd = SHIELD_COOLDOWN * p.shieldCdMult;
    s.usedShield = true;
    burst(s, p.x, p.y, '#bff3ff', 24, 180);
    return true;
  }

  // A música fica mais pesada durante a luta contra um chefão
  function musicIntensity(s) {
    if (s.status !== 'playing') return 0;
    return curRoom(s).enemies.some(e => e.type === 'boss' && e.hp > 0) ? 1 : 0;
  }

  // Cartas de nível: 1/2/3 escolhem direto; ← → (ou A D) e Enter também
  function levelUpKey(s, code) {
    const lu = s.levelUp, n = Math.max(1, lu.cards.length);
    const digit = /^(Digit|Numpad)([1-3])$/.exec(code);
    if (digit) { if (+digit[2] <= n) chooseCard(s, +digit[2] - 1); return; }
    if (code === 'ArrowLeft' || code === 'KeyA') lu.index = (lu.index + n - 1) % n;
    else if (code === 'ArrowRight' || code === 'KeyD') lu.index = (lu.index + 1) % n;
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') chooseCard(s, lu.index);
  }

  function setKey(s, code, down) {
    if (s.status === 'menu') { if (down) menuKey(s, code); return; } // no menu as teclas não controlam o bloco
    if (down && code === 'KeyR' && s.status !== 'playing') { restart(s); return; }
    if (down && code === 'Escape' && s.status !== 'playing') { restart(s, true); return; }
    if (s.levelUp && !s.paused) { if (down) levelUpKey(s, code); else s.keys[code] = false; return; }
    if (down && code === 'Escape' && s.status === 'playing') s.paused = !s.paused;
    if (down && code === 'KeyP' && s.status === 'playing' && !s.paused) activateShield(s);
    s.keys[code] = down;
    if (down && SHOOT_KEYS[code]) s.lastArrow = code;
  }

  function bindInput(s, target) {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    target.addEventListener('keydown', e => {
      if (block.has(e.code) && e.preventDefault) e.preventDefault();
      if (e.repeat) return;
      setKey(s, e.code, true);
    });
    target.addEventListener('keyup', e => setKey(s, e.code, false));
    target.addEventListener('blur', () => { s.keys = {}; });
  }

  // ---------- Controles de toque (celular) ----------
  // Metade esquerda: analógico de movimento (vira WASD). Metade direita: analógico de tiro (vira setas).
  // Botões de escudo, pausa e música. No PC nada muda: o teclado continua igual.
  const STICK_R = 64, STICK_DEAD = 16;
  const TOUCH_BTNS = [
    { id: 'shield', x: W - 92, y: SCREEN_H - 108, r: 46 },
    { id: 'pause', x: W - 42, y: HUD + 36, r: 26 },
    { id: 'music', x: W - 100, y: HUD + 36, r: 26 },
  ];
  let touchMode = false; // true em aparelhos de toque: troca os textos de ajuda

  function createTouch() { return { move: null, aim: null, held: new Set() }; }

  function hitButton(x, y) {
    return TOUCH_BTNS.find(b => Math.hypot(x - b.x, y - b.y) <= b.r + 8);
  }

  function pressKey(s, code) { setKey(s, code, true); setKey(s, code, false); }

  // Teclas que cada analógico segura agora (movimento: 8 direções; tiro: 4)
  function stickCodes(t) {
    const held = new Set();
    const m = t.move;
    if (m) {
      const dx = m.x - m.ox, dy = m.y - m.oy, len = Math.hypot(dx, dy);
      if (len > STICK_DEAD) {
        const c = 0.38; // ~67°: fora disso a diagonal também conta
        if (dx > len * c) held.add('KeyD');
        if (dx < -len * c) held.add('KeyA');
        if (dy > len * c) held.add('KeyS');
        if (dy < -len * c) held.add('KeyW');
      }
    }
    const a = t.aim;
    if (a) {
      const dx = a.x - a.ox, dy = a.y - a.oy;
      if (Math.hypot(dx, dy) > STICK_DEAD) {
        held.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
      }
    }
    return held;
  }

  // Aplica os analógicos em s.keys (chamado a cada quadro).
  // Só solta as teclas que o próprio toque apertou: as do teclado ficam como estão.
  function syncTouch(s, t) {
    if (s.status !== 'playing' || s.levelUp) { t.move = t.aim = null; t.held = new Set(); return; }
    const held = stickCodes(t);
    for (const code of t.held) if (!held.has(code)) setKey(s, code, false);
    for (const code of held) if (!s.keys[code]) setKey(s, code, true);
    t.held = held;
  }

  // x, y em coordenadas do jogo (0..W, 0..SCREEN_H)
  function touchDown(s, t, id, x, y) {
    const inRect = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (s.status === 'menu') {
      if (s.cheatNotice > 0) return;
      if (s.screen === 'talents') {
        for (let i = 0; i <= P.TALENTS.length; i++) if (inRect(talentRowRect(i))) { talentAction(s, i); return; }
        if (inRect(BACK_RECT) || !inRect(PANEL_RECT)) s.screen = null;
        return;
      }
      if (s.screen) { s.screen = null; return; } // outras telas: toque volta
      MENU_OPTIONS.forEach((_, i) => { if (inRect(menuOptionRect(i))) chooseMenu(s, i); });
      return;
    }
    if (s.status !== 'playing') { pressKey(s, 'KeyR'); return; } // perdeu/venceu: toque recomeça
    if (s.levelUp && !s.paused) {
      s.levelUp.cards.forEach((_, i) => { if (s.levelUp && inRect(levelCardRect(i))) chooseCard(s, i); });
      return;
    }
    const btn = hitButton(x, y);
    if (btn && btn.id === 'music') { if (activeMusic) activeMusic.toggleMute(); return; }
    if (s.paused || (btn && btn.id === 'pause')) { pressKey(s, 'Escape'); return; }
    if (btn) { pressKey(s, 'KeyP'); return; }
    const stick = { id, ox: x, oy: y, x, y };
    if (x < W / 2) { if (!t.move) t.move = stick; } else if (!t.aim) t.aim = stick;
  }

  function touchMove(t, id, x, y) {
    for (const st of [t.move, t.aim]) {
      if (!st || st.id !== id) continue;
      st.x = x; st.y = y;
      // o centro acompanha o dedo se ele passar do limite, para mudar de direção rápido
      const dx = x - st.ox, dy = y - st.oy, len = Math.hypot(dx, dy);
      if (len > STICK_R) { st.ox = x - dx / len * STICK_R; st.oy = y - dy / len * STICK_R; }
    }
  }

  function touchUp(t, id) {
    if (t.move && t.move.id === id) t.move = null;
    if (t.aim && t.aim.id === id) t.aim = null;
  }

  function bindTouch(s, t, canvas, target) {
    const toGame = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * SCREEN_H / r.height };
    };
    target.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      touchMode = true;
      if (activeMusic) activeMusic.start(); // o navegador só libera o áudio depois de um gesto
      const p = toGame(e);
      touchDown(s, t, e.pointerId, p.x, p.y);
    });
    target.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch') return;
      const p = toGame(e);
      touchMove(t, e.pointerId, p.x, p.y);
    });
    const up = e => { if (e.pointerType === 'touch') touchUp(t, e.pointerId); };
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('contextmenu', e => e.preventDefault()); // toque longo não abre menu
  }

  // =====================================================================
  // ---------- Texturas procedurais (Frutiger Aero) ----------
  // =====================================================================
  let TEX = null;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  const rgb = (c, a) => a === undefined
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return rgb([r, g, b]);
  }

  function softBlob(g, x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function texSky() {
    const c = makeCanvas(W, SCREEN_H), g = c.getContext('2d'), rng = makeRng(7);
    const gr = g.createLinearGradient(0, 0, 0, SCREEN_H);
    gr.addColorStop(0, '#1b7fd4'); gr.addColorStop(0.45, '#62c3f3');
    gr.addColorStop(0.8, '#c4efff'); gr.addColorStop(1, '#e9fcff');
    g.fillStyle = gr; g.fillRect(0, 0, W, SCREEN_H);
    g.save(); g.translate(110, 30);
    for (let i = 0; i < 10; i++) {
      g.rotate(0.3 + rng() * 0.2);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(1100, -50); g.lineTo(1100, 50); g.closePath(); g.fill();
    }
    g.restore();
    softBlob(g, 110, 30, 260, 'rgba(255,255,235,0.85)');
    softBlob(g, 110, 30, 60, 'rgba(255,255,255,1)');
    for (let i = 0; i < 16; i++) {
      const cx = rng() * W, cy = 60 + rng() * SCREEN_H * 0.85, r = 26 + rng() * 50;
      for (let j = 0; j < 5; j++) {
        softBlob(g, cx + (j - 2) * r * 0.6, cy + Math.sin(j * 1.7) * r * 0.18, r * (0.6 + rng() * 0.5), 'rgba(255,255,255,0.75)');
      }
    }
    // relva brilhante na parte de baixo
    const gg = g.createLinearGradient(0, SCREEN_H - 50, 0, SCREEN_H);
    gg.addColorStop(0, 'rgba(120,220,90,0)'); gg.addColorStop(1, 'rgba(90,200,70,0.7)');
    g.fillStyle = gg; g.fillRect(0, SCREEN_H - 50, W, 50);
    return c;
  }

  function texFloor(b, seed) {
    const fw = IX1 - IX0, fh = IY1 - IY0;
    const c = makeCanvas(fw, fh), g = c.getContext('2d'), rng = makeRng(seed);
    for (let cx = 0; cx < fw / TILE; cx++) {
      for (let cy = 0; cy < fh / TILE; cy++) {
        const x = cx * TILE, y = cy * TILE, v = 0.93 + rng() * 0.12, alt = (cx + cy) % 2 ? 0.95 : 1;
        const A = b.tileA.map(q => Math.min(255, q * v)), B = b.tileB.map(q => Math.min(255, q * v * alt));
        const gr = g.createLinearGradient(x, y, x + TILE, y + TILE);
        gr.addColorStop(0, rgb(A)); gr.addColorStop(1, rgb(B));
        g.fillStyle = gr; g.fillRect(x, y, TILE, TILE);
        const sh = g.createLinearGradient(x, y, x, y + TILE * 0.55);
        sh.addColorStop(0, 'rgba(255,255,255,0.5)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sh; g.fillRect(x + 2, y + 2, TILE - 4, TILE * 0.5);
        g.strokeStyle = b.grout; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      }
    }
    if (b.id === 'lagoa') {
      for (let i = 0; i < 80; i++) {
        g.strokeStyle = 'rgba(255,255,255,' + (0.15 + rng() * 0.2) + ')';
        g.lineWidth = 1 + rng() * 2;
        let x = rng() * fw, y = rng() * fh;
        g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
          const nx = x + (rng() - 0.5) * 70, ny = y + (rng() - 0.5) * 40;
          g.quadraticCurveTo((x + nx) / 2 + (rng() - 0.5) * 30, (y + ny) / 2 + (rng() - 0.5) * 30, nx, ny);
          x = nx; y = ny;
        }
        g.stroke();
      }
    } else if (b.id === 'prado') {
      for (let i = 0; i < 320; i++) {
        const x = rng() * fw, y = rng() * fh;
        g.strokeStyle = rng() < 0.55 ? 'rgba(40,140,30,0.45)' : 'rgba(255,255,255,0.4)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 6, y - 6 - rng() * 8); g.stroke();
      }
      const petals = ['#ffffff', '#fff27a', '#ffb3d9'];
      for (let i = 0; i < 45; i++) {
        const x = rng() * fw, y = rng() * fh;
        g.fillStyle = petals[i % 3];
        for (let j = 0; j < 5; j++) {
          g.beginPath(); g.arc(x + Math.cos(j * 1.26) * 3, y + Math.sin(j * 1.26) * 3, 2.4, 0, TAU); g.fill();
        }
        g.fillStyle = '#ffb52e'; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
      }
    } else if (b.id === 'cristal') {
      // lascas de cristal espalhadas
      for (let i = 0; i < 60; i++) {
        const x = rng() * fw, y = rng() * fh, r = 4 + rng() * 9, a = rng() * TAU;
        g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(150,110,240,0.35)';
        g.beginPath();
        for (let j = 0; j < 4; j++) {
          const rr = j % 2 ? r * 0.4 : r;
          g.lineTo(x + Math.cos(a + j * Math.PI / 2) * rr, y + Math.sin(a + j * Math.PI / 2) * rr);
        }
        g.closePath(); g.fill();
      }
    } else if (b.id === 'nucleo') {
      // faixas de arco-íris do prisma
      const cols = ['rgba(255,120,160,0.22)', 'rgba(255,210,90,0.22)', 'rgba(120,230,160,0.22)', 'rgba(110,180,255,0.22)'];
      for (let i = 0; i < 26; i++) {
        const x = rng() * fw, y = rng() * fh, len = 40 + rng() * 80;
        g.lineWidth = 5; g.lineCap = 'round';
        cols.forEach((c, j) => {
          g.strokeStyle = c;
          g.beginPath(); g.moveTo(x + j * 5, y); g.lineTo(x + j * 5 + len * 0.5, y + len * 0.3); g.stroke();
        });
      }
      for (let i = 0; i < 10; i++) softBlob(g, rng() * fw, rng() * fh, 30 + rng() * 50, 'rgba(255,255,255,0.4)');
    } else {
      for (let i = 0; i < 14; i++) softBlob(g, rng() * fw, rng() * fh, 40 + rng() * 60, 'rgba(255,255,255,0.45)');
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 45; i++) {
        const x = rng() * fw, y = rng() * fh, r = 2 + rng() * 3;
        g.beginPath();
        g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.4, y - r * 0.4); g.lineTo(x + r * 2, y);
        g.lineTo(x + r * 0.4, y + r * 0.4); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.4, y + r * 0.4);
        g.lineTo(x - r * 2, y); g.lineTo(x - r * 0.4, y - r * 0.4); g.closePath(); g.fill();
      }
    }
    return c;
  }

  function texWall(b) {
    const w = IX1 - IX0, c = makeCanvas(w, WALL_H), g = c.getContext('2d'), rng = makeRng(99);
    const gr = g.createLinearGradient(0, 0, 0, WALL_H);
    gr.addColorStop(0, b.wallA); gr.addColorStop(1, b.wallB);
    g.fillStyle = gr; g.fillRect(0, 0, w, WALL_H);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 80) g.strokeRect(x + 3, 6, 74, WALL_H - 10);
    const sh = g.createLinearGradient(0, 0, 0, WALL_H * 0.5);
    sh.addColorStop(0, 'rgba(255,255,255,0.75)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, w, WALL_H * 0.5);
    for (let i = 0; i < 40; i++) {
      const x = rng() * w, y = 8 + rng() * (WALL_H - 14), r = 1.2 + rng() * 2.6;
      g.fillStyle = 'rgba(30,90,140,0.25)'; g.beginPath(); g.arc(x + 0.8, y + 1, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.fillStyle = b.wallTop; g.fillRect(0, 0, w, 4);
    return c;
  }

  function texBubble(size) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2;
    const gr = g.createRadialGradient(r, r, r * 0.2, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(0.75, 'rgba(170,230,255,0.28)');
    gr.addColorStop(1, 'rgba(110,195,255,0.75)');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r - 1, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, size * 0.03); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.ellipse(r * 0.65, r * 0.55, r * 0.3, r * 0.16, -0.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.arc(r * 1.45, r * 1.4, r * 0.08, 0, TAU); g.fill();
    return c;
  }

  function texOrb(size, light, mid, dark) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2;
    const gr = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.05, r, r, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, light);
    gr.addColorStop(0.7, mid); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r - 0.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.ellipse(r, r * 0.45, r * 0.55, r * 0.26, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, size * 0.05);
    g.beginPath(); g.arc(r, r, r * 0.8, 0.4, Math.PI - 0.4); g.stroke();
    return c;
  }

  function heartPath(g, x, y, size) {
    const s = size / 2;
    g.beginPath();
    g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.45);
    g.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    g.closePath();
  }

  function texHeart(size, light, dark) {
    const c = makeCanvas(size, size), g = c.getContext('2d');
    heartPath(g, size / 2, size / 2 + 1, size * 0.9);
    const gr = g.createLinearGradient(0, 0, 0, size);
    gr.addColorStop(0, light); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(size * 0.36, size * 0.3, size * 0.2, size * 0.12, -0.5, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5;
    heartPath(g, size / 2, size / 2 + 1, size * 0.9); g.stroke();
    return c;
  }

  function buildTextures() {
    if (TEX) return TEX;
    const t = {
      sky: texSky(),
      bubble: texBubble(64),
      tear: texOrb(32, '#c9f6ff', '#4fd0ff', '#0a78c8'),
      bullet: texOrb(32, '#ffd0e0', '#ff4f8b', '#a3004a'),
      fly: texOrb(32, '#fff3c4', '#ffb32b', '#c06a00'),
      orbiter: texOrb(32, '#f3dcff', '#b678ff', '#6a2fc0'),
      turret: texOrb(32, '#dcfbff', '#29c6d6', '#0a6f8a'),
      duke: texOrb(64, '#f1e4ff', '#a78bfa', '#5b3fb5'),
      queen: texOrb(64, '#fff6cc', '#ffc23a', '#c06a00'),
      spinner: texOrb(32, '#ffe0f6', '#ff5fc8', '#a0207a'),
      bomber: texOrb(32, '#ffd9cc', '#ff5a3c', '#7a1a10'),
      healer: texOrb(32, '#e0ffe8', '#3fdc7a', '#14783c'),
      coin: texOrb(24, '#fff8c8', '#ffcc2e', '#b07800'),
      xp: texOrb(16, '#eafff4', '#5cf2b4', '#109a6a'),
      heart: texHeart(32, '#ff9fbf', '#e8004f'),
      heartEmpty: texHeart(32, 'rgba(255,255,255,0.55)', 'rgba(110,150,190,0.55)'),
    };
    BIOMES.forEach((b, i) => {
      t['floor_' + b.id] = texFloor(b, 100 + i);
      t['wall_' + b.id] = texWall(b);
    });
    TEX = t;
    return t;
  }

  // =====================================================================
  // ---------- Desenho 2.5D ----------
  // =====================================================================
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  const lerpPt = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

  function vGrad(ctx, y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }

  // Cubo brilhante com topo, frente e a lateral voltada para o centro da tela.
  function drawCube(ctx, x, y, z, sz, ht, col, alpha, wide) {
    const hx = (wide || sz) / 2, hy = sz / 2;
    const x0 = x - hx, x1 = x + hx, y0 = y - hy, y1 = y + hy, zt = z + ht;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    const sx = x < W / 2 ? x1 : x0;
    poly(ctx, [proj(sx, y0, z), proj(sx, y1, z), proj(sx, y1, zt), proj(sx, y0, zt)], col.side);
    const f = [proj(x0, y1, z), proj(x1, y1, z), proj(x1, y1, zt), proj(x0, y1, zt)];
    poly(ctx, f, vGrad(ctx, f[3].y, f[0].y, col.front, col.side));
    const mid = (f[3].y + f[0].y) / 2;
    poly(ctx, [f[3], f[2], { x: f[2].x, y: mid }, { x: f[3].x, y: mid }], 'rgba(255,255,255,0.3)');
    const top = [proj(x0, y0, zt), proj(x1, y0, zt), proj(x1, y1, zt), proj(x0, y1, zt)];
    const tg = ctx.createLinearGradient(top[0].x, top[0].y, top[2].x, top[2].y);
    tg.addColorStop(0, col.top); tg.addColorStop(1, col.front);
    poly(ctx, top, tg);
    poly(ctx, [top[0], lerpPt(top[0], top[1], 0.55), lerpPt(top[3], top[2], 0.2), top[3]], 'rgba(255,255,255,0.35)');
    poly(ctx, top, null, 'rgba(255,255,255,0.85)', 1.2);
    ctx.beginPath(); ctx.moveTo(f[3].x, f[3].y); ctx.lineTo(f[2].x, f[2].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    return { front: f, top };
  }

  function drawSprite(ctx, img, x, y, z, r, alpha) {
    const p = proj(x, y, z + r), k = sc(y);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(img, p.x - r * k, p.y - r * k, r * 2 * k, r * 2 * k);
    ctx.globalAlpha = 1;
    return { x: p.x, y: p.y, r: r * k };
  }

  function drawShadow(ctx, x, y, r, alpha) {
    const p = proj(x, y, 0), k = sc(y);
    ctx.fillStyle = 'rgba(10,60,110,' + (alpha === undefined ? 0.25 : alpha) + ')';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * k, r * k * YSCALE * 0.75, 0, 0, TAU); ctx.fill();
  }

  function faceEyes(ctx, f, dir, scale, pupil) {
    const cx = (f[0].x + f[1].x) / 2, cy = (f[0].y + f[3].y) / 2 - 1;
    const fw = f[1].x - f[0].x, er = fw * 0.11 * (scale || 1);
    for (const side of [-1, 1]) {
      const ex = cx + side * fw * 0.2;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, cy, er, er * 1.25, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pupil || '#0b3556';
      ctx.beginPath(); ctx.arc(ex + dir.x * er * 0.45, cy + dir.y * er * 0.5, er * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + dir.x * er * 0.45 - er * 0.2, cy + dir.y * er * 0.5 - er * 0.25, er * 0.2, 0, TAU); ctx.fill();
    }
  }

  function drawFloor(ctx, s) {
    const T = buildTextures(), tex = T['floor_' + biome(s).id], step = 4;
    for (let y = IY0; y < IY1; y += step) {
      const k = sc(y + step / 2), a = proj(IX0, y, 0), b = proj(IX0, y + step, 0);
      ctx.drawImage(tex, 0, y - IY0, tex.width, step, W / 2 + (IX0 - W / 2) * k, a.y, (IX1 - IX0) * k, b.y - a.y + 0.8);
    }
  }

  function doorColor(s, room, dir) {
    const n = s.rooms[rk(room.x + DIRS[dir].dx, room.y + DIRS[dir].dy)];
    return n.type === 'boss' ? '#ff4f6d' : n.type === 'item' ? '#ffcf3a' : n.type === 'shop' ? '#4fd67a' : '#ffffff';
  }

  function drawDoorQuad(ctx, q, color, open, t) {
    poly(ctx, q, null, color, 7);
    poly(ctx, q, null, 'rgba(255,255,255,0.9)', 2);
    if (open) {
      poly(ctx, q, vGrad(ctx, q[3].y, q[0].y, '#0d4f7c', '#3fc4ff'));
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
      poly(ctx, [lerpPt(q[0], q[1], 0.3), lerpPt(q[0], q[1], 0.7), lerpPt(q[3], q[2], 0.7), lerpPt(q[3], q[2], 0.3)], '#ffffff');
      ctx.globalAlpha = 1;
    } else {
      poly(ctx, q, vGrad(ctx, q[3].y, q[0].y, 'rgba(240,252,255,0.95)', 'rgba(150,215,245,0.95)'));
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const a = lerpPt(q[0], q[1], i / 4), b = lerpPt(q[3], q[2], i / 4);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  function drawWalls(ctx, s, room) {
    const T = buildTextures(), b = biome(s), wtex = T['wall_' + b.id];
    const topFill = (pts) => {
      poly(ctx, pts, vGrad(ctx, pts[0].y, pts[2].y, b.wallTop, b.wallTopB));
      poly(ctx, pts, null, 'rgba(255,255,255,0.8)', 1);
    };
    // tampo da parede de trás
    topFill([proj(0, 0, WALL_H), proj(W, 0, WALL_H), proj(W, IY0, WALL_H), proj(0, IY0, WALL_H)]);
    // face da parede de trás (retângulo na tela)
    const bl = proj(IX0, IY0, WALL_H), br = proj(IX1, IY0, 0);
    ctx.drawImage(wtex, bl.x, bl.y, br.x - bl.x, br.y - bl.y);
    // faces laterais em fatias (perspectiva)
    const step = 3, len = IY1 - IY0;
    for (const wx of [IX0, IX1]) {
      for (let y = IY0; y < IY1; y += step) {
        const b0 = proj(wx, y, 0), t0 = proj(wx, y, WALL_H), b1 = proj(wx, y + step, 0);
        const sx = ((y - IY0) / len) * wtex.width, sw = (step / len) * wtex.width;
        ctx.drawImage(wtex, sx, 0, Math.max(1, sw), WALL_H, Math.min(b0.x, b1.x) - 0.4, t0.y, Math.abs(b1.x - b0.x) + 0.8, b0.y - t0.y);
      }
      // sombreado: a lateral recebe menos luz
      poly(ctx, [proj(wx, IY0, 0), proj(wx, IY1, 0), proj(wx, IY1, WALL_H), proj(wx, IY0, WALL_H)], 'rgba(20,80,140,0.12)');
    }
    topFill([proj(0, IY0, WALL_H), proj(IX0, IY0, WALL_H), proj(IX0, IY1, WALL_H), proj(0, IY1, WALL_H)]);
    topFill([proj(IX1, IY0, WALL_H), proj(W, IY0, WALL_H), proj(W, IY1, WALL_H), proj(IX1, IY1, WALL_H)]);
    // portas de trás e laterais
    const d0 = W / 2 - DOOR / 2, d1 = W / 2 + DOOR / 2, e0 = H / 2 - DOOR / 2, e1 = H / 2 + DOOR / 2;
    if (room.doors.up) drawDoorQuad(ctx, [proj(d0, IY0, 0), proj(d1, IY0, 0), proj(d1, IY0, DOOR_H), proj(d0, IY0, DOOR_H)], doorColor(s, room, 'up'), room.cleared, s.time);
    if (room.doors.left) drawDoorQuad(ctx, [proj(IX0, e1, 0), proj(IX0, e0, 0), proj(IX0, e0, DOOR_H), proj(IX0, e1, DOOR_H)], doorColor(s, room, 'left'), room.cleared, s.time);
    if (room.doors.right) drawDoorQuad(ctx, [proj(IX1, e0, 0), proj(IX1, e1, 0), proj(IX1, e1, DOOR_H), proj(IX1, e0, DOOR_H)], doorColor(s, room, 'right'), room.cleared, s.time);
  }

  // Parede da frente: baixa e de vidro, desenhada por cima de tudo.
  function drawFrontWall(ctx, s, room) {
    const b = biome(s);
    // pontas das paredes laterais
    for (const [xa, xb] of [[0, IX0], [IX1, W]]) {
      const f = [proj(xa, IY1, 0), proj(xb, IY1, 0), proj(xb, IY1, WALL_H), proj(xa, IY1, WALL_H)];
      poly(ctx, f, vGrad(ctx, f[3].y, f[0].y, b.wallA, b.wallB));
      poly(ctx, f, null, 'rgba(255,255,255,0.8)', 1);
    }
    const d0 = W / 2 - DOOR / 2, d1 = W / 2 + DOOR / 2;
    const segs = room.doors.down ? [[0, d0], [d1, W]] : [[0, W]];
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (const [xa, xb] of segs) {
      const top = [proj(xa, IY1, FRONT_H), proj(xb, IY1, FRONT_H), proj(xb, H, FRONT_H), proj(xa, H, FRONT_H)];
      const face = [proj(xa, H, 0), proj(xb, H, 0), proj(xb, H, FRONT_H), proj(xa, H, FRONT_H)];
      poly(ctx, top, vGrad(ctx, top[0].y, top[2].y, b.wallTop, b.wallTopB));
      poly(ctx, face, vGrad(ctx, face[3].y, face[0].y, b.wallA, b.wallB));
      poly(ctx, top, null, 'rgba(255,255,255,0.9)', 1.2);
    }
    ctx.restore();
    if (room.doors.down) {
      const q = [proj(d0, H, 0), proj(d1, H, 0), proj(d1, IY1, 0), proj(d0, IY1, 0)];
      const col = doorColor(s, room, 'down');
      drawCube(ctx, d0 - 6, IY1 + 20, 0, 12, FRONT_H + 14, { top: '#ffffff', front: col, side: shade(col === '#ffffff' ? '#9fdcf2' : col, -0.3) });
      drawCube(ctx, d1 + 6, IY1 + 20, 0, 12, FRONT_H + 14, { top: '#ffffff', front: col, side: shade(col === '#ffffff' ? '#9fdcf2' : col, -0.3) });
      if (!room.cleared) {
        const g = [proj(d0, IY1 + 20, 0), proj(d1, IY1 + 20, 0), proj(d1, IY1 + 20, FRONT_H + 10), proj(d0, IY1 + 20, FRONT_H + 10)];
        poly(ctx, g, 'rgba(220,245,255,0.75)', 'rgba(255,255,255,0.95)', 2);
      } else {
        ctx.globalAlpha = 0.5; poly(ctx, q, 'rgba(63,196,255,0.4)'); ctx.globalAlpha = 1;
      }
    }
  }

  function enemyColor(e) {
    return {
      fly: '#ffb32b', orbiter: '#b678ff', grunt: '#7fe04a', turret: '#29c6d6', boss: '#ff4f8b',
      splitter: '#c77dff', slimelet: '#c77dff', charger: '#ff7a3c', spinner: '#ff5fc8', bomber: '#ff5a3c',
      ghost: '#e8f4ff', shielder: '#6aa8ff', healer: '#3fdc7a', nest: '#d9a020', clone: '#c9d3e6',
    }[e.type];
  }
  const SLIME_COL = { top: '#f6e8ff', front: '#c77dff', side: '#7a3fc0' };
  const CHARGER_COL = { top: '#fff0e0', front: '#ff8a4c', side: '#c0471a' };
  const SHIELDER_COL = { top: '#eef6ff', front: '#7fb2ff', side: '#2f63c0' };
  const NEST_COL = { top: '#fff2c8', front: '#e0a830', side: '#9a6a10' };
  const MIRROR_COL = { top: '#ffffff', front: '#e4ecf8', side: '#8fa0b8' };
  const colsOf = c => ({ top: shade(c, 0.6), front: c, side: shade(c, -0.35) });

  const PLAYER_COL = { top: '#effdff', front: '#56d6ff', side: '#138fd6' };
  const GRUNT_COL = { top: '#f1ffd9', front: '#86e655', side: '#3a9e28' };
  const FLASH_COL = { top: '#ffffff', front: '#ffffff', side: '#e6f6ff' };
  const PEDESTAL_COL = { top: '#ffffff', front: '#dbe8f5', side: '#9fb4cc' };
  const GEL_COL = { top: '#eaffd2', front: '#7fea6a', side: '#2fa84a' };
  const HYPER_COLS = { 1: '#4fb8ff', 2: '#b07bff', 3: '#ff4f7a', 4: '#ffae00' };

  function lookDir(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  function drawPrism(ctx, e) {
    const h = e.size * 1.3, R = e.size * 0.5, cz = e.z + h / 2;
    const top = proj(e.x, e.y, e.z + h), bot = proj(e.x, e.y, e.z);
    const ringPts = [];
    for (let i = 0; i < 4; i++) {
      const a = e.spin + i * Math.PI / 2;
      ringPts.push({ wy: e.y + Math.sin(a) * R, p: proj(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R, cz) });
    }
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const a = ringPts[i], b = ringPts[(i + 1) % 4];
      faces.push({ depth: a.wy + b.wy, pts: [top, a.p, b.p], up: true, i });
      faces.push({ depth: a.wy + b.wy, pts: [bot, a.p, b.p], up: false, i });
    }
    faces.sort((u, v) => u.depth - v.depth);
    ctx.save();
    ctx.globalAlpha = e.alpha;
    for (const f of faces) {
      const c = e.flash > 0 ? '#ffffff' : f.i % 2 ? (f.up ? '#9ff0ff' : '#3fb8e8') : (f.up ? '#ffb3f0' : '#d14fd0');
      poly(ctx, f.pts, c, 'rgba(255,255,255,0.9)', 1.2);
    }
    ctx.globalAlpha = e.alpha * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(top.x, top.y + h * 0.25, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawBoss(ctx, s, e) {
    const p = s.player, look = lookDir(e, p);
    if (e.kind === 'gelatao') {
      if (e.z > 650) return;
      const sq = e.squash;
      const r = drawCube(ctx, e.x, e.y, e.z, e.size, e.size * 0.85 * (1 - sq * 0.25), e.flash > 0 ? FLASH_COL : GEL_COL, 0.88, e.size * (1 + sq * 0.2));
      faceEyes(ctx, r.front, look, 1.1, '#0b3a1a');
      const f = r.front, mx = (f[0].x + f[1].x) / 2, my = f[0].y - (f[0].y - f[3].y) * 0.25;
      ctx.fillStyle = '#0b3a1a';
      ctx.beginPath(); ctx.ellipse(mx, my, 12 + sq * 8, 4 + (e.state === 'spit' ? sq * 10 : 0), 0, 0, TAU); ctx.fill();
    } else if (e.kind === 'duque') {
      const T = buildTextures();
      const c = drawSprite(ctx, T.duke, e.x, e.y, e.z + e.size * 0.12, e.size * 0.38);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(c.x - 16, c.y - c.r * 0.85); ctx.lineTo(c.x - 10, c.y - c.r - 14); ctx.lineTo(c.x - 3, c.y - c.r - 2);
      ctx.lineTo(c.x + 4, c.y - c.r - 16); ctx.lineTo(c.x + 10, c.y - c.r - 2); ctx.lineTo(c.x + 17, c.y - c.r - 12);
      ctx.lineTo(c.x + 16, c.y - c.r * 0.85); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff6c2'; ctx.lineWidth = 1.5; ctx.stroke();
      for (const side of [-1, 1]) {
        const ex = c.x + side * c.r * 0.35, ey = c.y + 2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1060'; ctx.beginPath(); ctx.arc(ex + look.x * 2.5, ey + look.y * 2.5, 3.2, 0, TAU); ctx.fill();
      }
      drawSprite(ctx, T.bubble, e.x, e.y, e.z, e.size / 2, 0.9);
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.3, 0, TAU); ctx.fill(); }
    } else if (e.kind === 'prisma') {
      drawPrism(ctx, e);
    } else if (e.kind === 'hipercubo') {
      const col = HYPER_COLS[e.phase];
      const inner = e.size * (0.45 + Math.sin(e.spin) * 0.06);
      const ir = drawCube(ctx, e.x, e.y, e.z + e.size * 0.22, inner, inner, e.flash > 0 ? FLASH_COL : { top: '#ffffff', front: col, side: shade(col, -0.45) }, 1);
      faceEyes(ctx, ir.front, look, 1.2, '#1a0020');
      drawCube(ctx, e.x, e.y, e.z, e.size, e.size, { top: 'rgba(255,255,255,0.9)', front: shade(col, 0.55), side: shade(col, 0.1) }, 0.32);
      if (e.shield) drawSprite(ctx, buildTextures().bubble, e.x, e.y, e.z, e.size * 0.85, 0.9);
    } else if (e.kind === 'colmeia') {
      const T = buildTextures(), c = proj(e.x, e.y, e.z + e.size / 2), flap = Math.abs(Math.sin(e.t * 26));
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(c.x + side * 34, c.y - 18, 26, 10 + flap * 10, side * 0.5, 0, TAU); ctx.fill();
      }
      const o = drawSprite(ctx, T.queen, e.x, e.y, e.z, e.size * 0.42);
      ctx.strokeStyle = 'rgba(90,40,0,0.55)'; ctx.lineWidth = 5;
      for (const dy of [0.1, 0.45]) { ctx.beginPath(); ctx.arc(o.x, o.y - o.r * 0.6, o.r * (0.9 + dy), 1.1, Math.PI - 1.1); ctx.stroke(); }
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(o.x - 18, o.y - o.r * 0.85); ctx.lineTo(o.x - 12, o.y - o.r - 14); ctx.lineTo(o.x - 4, o.y - o.r - 2);
      ctx.lineTo(o.x + 4, o.y - o.r - 16); ctx.lineTo(o.x + 12, o.y - o.r - 2); ctx.lineTo(o.x + 18, o.y - o.r * 0.85); ctx.closePath(); ctx.fill();
      for (const side of [-1, 1]) {
        const ex = o.x + side * o.r * 0.35, ey = o.y + 2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4a1a00'; ctx.beginPath(); ctx.arc(ex + look.x * 3, ey + look.y * 3, 3.6, 0, TAU); ctx.fill();
      }
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.2, 0, TAU); ctx.fill(); }
    } else if (e.kind === 'espelho') {
      ctx.save(); ctx.globalAlpha = e.alpha;
      const r = drawCube(ctx, e.x, e.y, 6 + Math.sin(e.t * 2) * 4, e.size, e.size * 1.1, e.flash > 0 ? FLASH_COL : MIRROR_COL, 0.95);
      faceEyes(ctx, r.front, look, 1.1, '#2a3a55');
      if (e.reflect) { // brilho de arco-íris enquanto reflete
        const hue = (e.t * 240) % 360;
        poly(ctx, r.front, 'hsla(' + hue + ',100%,70%,0.35)');
        drawSprite(ctx, buildTextures().bubble, e.x, e.y, 0, e.size * 0.8, 0.9);
      }
      ctx.restore();
    }
  }

  // Desenho dos monstros novos (andares 2 a 9)
  function drawNewEnemy(ctx, e, look) {
    const T = buildTextures(), col = e.flash > 0 ? FLASH_COL : null;
    if (e.type === 'splitter' || e.type === 'slimelet') {
      const sq = Math.abs(Math.sin(e.t * 4));
      const r = drawCube(ctx, e.x, e.y, 0, e.size * (1 + sq * 0.12), e.size * (0.78 - sq * 0.12), col || SLIME_COL, 0.82);
      faceEyes(ctx, r.front, look, 1, '#3a0b5a');
    } else if (e.type === 'charger') {
      const warn = e.state === 'chargeWind' && Math.floor(e.t * 16) % 2 === 0;
      const r = drawCube(ctx, e.x, e.y, 0, e.size, e.size * 0.8, col || (warn ? FLASH_COL : CHARGER_COL), 0.95);
      faceEyes(ctx, r.front, e.state === 'charging' ? { x: Math.cos(e.cang), y: Math.sin(e.cang) } : look, 1, '#5a1a00');
      const t = r.top;
      ctx.fillStyle = '#fff4e0';
      for (const [a, b] of [[t[0], t[3]], [t[1], t[2]]]) { // chifres
        const m = lerpPt(a, b, 0.5);
        ctx.beginPath(); ctx.moveTo(m.x - 4, m.y); ctx.lineTo(m.x + 4, m.y); ctx.lineTo(m.x, m.y - 12); ctx.closePath(); ctx.fill();
      }
      if (e.state === 'stun') { // estrelinhas de tontura
        const c = proj(e.x, e.y, e.size + 12);
        ctx.fillStyle = '#fff04a';
        for (let i = 0; i < 3; i++) {
          const a = e.t * 6 + i * TAU / 3;
          ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * 14, c.y + Math.sin(a) * 5, 3, 0, TAU); ctx.fill();
        }
      }
    } else if (e.type === 'spinner') {
      drawCube(ctx, e.x, e.y, 0, e.size, 10, PEDESTAL_COL, 1);
      const o = drawSprite(ctx, T.spinner, e.x, e.y, 10, e.size / 2 - 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = e.ang + i * TAU / 8;
        ctx.beginPath(); ctx.moveTo(o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r * 0.8);
        ctx.lineTo(o.x + Math.cos(a) * (o.r + 7), o.y + Math.sin(a) * (o.r + 7) * 0.8); ctx.stroke();
      }
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
    } else if (e.type === 'bomber') {
      const fuse = e.state === 'fuse';
      if (fuse) { // aviso do raio da explosão
        const c = proj(e.x, e.y, 0), k = sc(e.y);
        ctx.strokeStyle = 'rgba(255,60,40,' + (0.4 + Math.sin(e.t * 30) * 0.3) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, 80 * k, 80 * k * YSCALE * 0.75, 0, 0, TAU); ctx.stroke();
      }
      const o = drawSprite(ctx, T.bomber, e.x, e.y, 4, e.size / 2);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x + 3, o.y - o.r); ctx.quadraticCurveTo(o.x + 8, o.y - o.r - 8, o.x + 4, o.y - o.r - 12); ctx.stroke();
      ctx.fillStyle = Math.floor(e.t * 20) % 2 ? '#fff04a' : '#ff8a3c';
      ctx.beginPath(); ctx.arc(o.x + 4, o.y - o.r - 12, fuse ? 5 : 3, 0, TAU); ctx.fill();
      if (e.flash > 0 || (fuse && Math.floor(e.t * 16) % 2 === 0)) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
      }
    } else if (e.type === 'ghost') {
      const z = 14 + Math.sin(e.t * 3) * 5;
      const o = drawSprite(ctx, T.bubble, e.x, e.y, z, e.size / 2 + 2, e.alpha * 0.95);
      ctx.globalAlpha = e.alpha;
      ctx.fillStyle = '#1a2a4a';
      ctx.beginPath(); ctx.ellipse(o.x - 5 + look.x * 2, o.y + look.y * 2, 3, 4.5, 0, 0, TAU); ctx.ellipse(o.x + 5 + look.x * 2, o.y + look.y * 2, 3, 4.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(o.x, o.y + 8, 4, 2.5 + Math.abs(Math.sin(e.t * 4)) * 2, 0, 0, TAU); ctx.fill();
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (e.type === 'shielder') {
      const fx = Math.cos(e.ang), fy = Math.sin(e.ang), d = e.size * 0.75;
      const cx = e.x + fx * d, cy = e.y + fy * d, px = -fy * e.size * 0.7, py = fx * e.size * 0.7;
      const plate = () => {
        const q = [proj(cx - px, cy - py, 2), proj(cx + px, cy + py, 2), proj(cx + px, cy + py, 34), proj(cx - px, cy - py, 34)];
        poly(ctx, q, 'rgba(170,215,255,0.8)', '#ffffff', 2);
        poly(ctx, [lerpPt(q[0], q[3], 0.55), lerpPt(q[1], q[2], 0.55), q[2], q[3]], 'rgba(255,255,255,0.35)');
      };
      if (fy < 0) plate(); // escudo atrás do corpo: desenha antes
      const r = drawCube(ctx, e.x, e.y, 0, e.size, e.size * 0.9, col || SHIELDER_COL, 0.95);
      faceEyes(ctx, r.front, look, 1, '#0a2050');
      if (fy >= 0) plate();
    } else if (e.type === 'healer') {
      const z = 10 + Math.sin(e.t * 4) * 4;
      const o = drawSprite(ctx, T.healer, e.x, e.y, z, e.size / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(o.x - 2.5, o.y - 7, 5, 14); ctx.fillRect(o.x - 7, o.y - 2.5, 14, 5);
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
    } else if (e.type === 'nest') {
      const r = drawCube(ctx, e.x, e.y, 0, e.size, e.size * 0.9, col || NEST_COL, 0.97);
      const f = r.front;
      ctx.fillStyle = 'rgba(70,40,0,0.7)';
      for (const [u, v] of [[0.3, 0.35], [0.7, 0.35], [0.5, 0.7]]) {
        const a = lerpPt(f[3], f[2], u), b = lerpPt(f[0], f[1], u), c = lerpPt(a, b, v);
        ctx.beginPath(); ctx.ellipse(c.x, c.y, 4.5, 3.5, 0, 0, TAU); ctx.fill();
      }
    } else if (e.type === 'clone') {
      const r = drawCube(ctx, e.x, e.y, 0, e.size, e.size, col || MIRROR_COL, 0.8);
      faceEyes(ctx, r.front, look, 1, '#2a3a55');
    }
  }

  function drawEnemy(ctx, s, e) {
    const T = buildTextures(), p = s.player, look = lookDir(e, p);
    if (e.type === 'boss') return drawBoss(ctx, s, e);
    if (e.elite) { // elite: anel dourado no chão
      const c = proj(e.x, e.y, 0), k = sc(e.y), r = e.size * 0.8 * k;
      ctx.strokeStyle = 'rgba(255,196,0,' + (0.6 + Math.sin(s.time * 6) * 0.3) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * YSCALE * 0.75, 0, 0, TAU); ctx.stroke();
    }
    if (ENEMY_AI[e.type]) return drawNewEnemy(ctx, e, look);
    if (e.type === 'fly' || e.type === 'orbiter') {
      const z = 18 + Math.sin(e.t * 5) * 4;
      const c = proj(e.x, e.y, z + e.size / 2), flap = Math.abs(Math.sin(e.t * 30));
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(c.x - 9, c.y - 6, 7, 3 + flap * 3, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x + 9, c.y - 6, 7, 3 + flap * 3, 0.5, 0, TAU); ctx.fill();
      const o = drawSprite(ctx, e.type === 'fly' ? T.fly : T.orbiter, e.x, e.y, z, e.size / 2);
      ctx.fillStyle = '#2b1400';
      ctx.beginPath(); ctx.arc(o.x - 3 + look.x * 2, o.y + 1 + look.y * 2, 2, 0, TAU); ctx.arc(o.x + 3 + look.x * 2, o.y + 1 + look.y * 2, 2, 0, TAU); ctx.fill();
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
    } else if (e.type === 'grunt') {
      const wob = Math.sin(e.t * 8) * 2;
      const r = drawCube(ctx, e.x, e.y, 0, e.size, e.size * 0.85 + wob, e.flash > 0 ? FLASH_COL : GRUNT_COL, 0.92);
      faceEyes(ctx, r.front, look, 1, '#123d0a');
    } else if (e.type === 'turret') {
      drawCube(ctx, e.x, e.y, 0, e.size, 10, PEDESTAL_COL, 1);
      const o = drawSprite(ctx, T.turret, e.x, e.y, 10, e.size / 2 - 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x + look.x * 3, o.y + look.y * 3, 5.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#062a38'; ctx.beginPath(); ctx.arc(o.x + look.x * 5, o.y + look.y * 5, 3, 0, TAU); ctx.fill();
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
    }
  }

  function drawPlayer(ctx, s) {
    const p = s.player;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) return;
    const moving = Math.hypot(p.vx, p.vy) > 20;
    const bob = moving ? Math.abs(Math.sin(s.time * 14)) * 4 : Math.sin(s.time * 3) + 1;
    const r = drawCube(ctx, p.x, p.y, bob, p.size, p.size, PLAYER_COL, 0.96);
    const d = DIRS[p.face];
    faceEyes(ctx, r.front, { x: d.dx, y: d.dy }, 1);
  }

  function drawItemPedestal(ctx, s, it) {
    drawCube(ctx, it.x, it.y, 0, 44, 16, PEDESTAL_COL, 1);
    if (it.taken) return;
    const def = ITEMS.find(i => i.id === it.id);
    const bob = 34 + Math.sin(s.time * 3) * 5;
    const glow = proj(it.x, it.y, bob + 12);
    const gg = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 40);
    gg.addColorStop(0, 'rgba(255,255,255,0.8)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(glow.x - 40, glow.y - 40, 80, 80);
    drawCube(ctx, it.x, it.y, bob, 24, 24, { top: shade(def.color, 0.6), front: def.color, side: shade(def.color, -0.35) }, 0.95);
    // chegando perto mostra o que o item faz
    const p = s.player;
    if (Math.hypot(p.x - it.x, p.y - it.y) < 170) {
      const lp = proj(it.x, it.y, bob + 50);
      aeroText(ctx, def.name, lp.x, lp.y, 17);
      ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
      ctx.fillText(def.desc, lp.x, lp.y + 17);
    }
  }

  function drawPickup(ctx, s, pk) {
    const T = buildTextures();
    if (pk.type === 'coin') drawSprite(ctx, T.coin, pk.x, pk.y, 4 + Math.abs(Math.sin(s.time * 5 + pk.x)) * 5, 7);
    else if (pk.type === 'xp') drawSprite(ctx, T.xp, pk.x, pk.y, 10 + Math.sin(s.time * 6 + pk.y) * 3, 5);
    else drawSprite(ctx, T.heart, pk.x, pk.y, 6 + Math.sin(s.time * 4) * 3, 12);
  }

  // Pedestal da loja: produto flutuando, preço embaixo e descrição ao chegar perto
  const SHOP_INFO = {
    heart: { name: 'Coração', desc: 'Recupera 1 coração' },
    skill: { name: 'Carta de Melhoria', desc: 'Escolha 1 de 3 habilidades' },
  };
  function drawShopSlot(ctx, s, slot) {
    const T = buildTextures();
    drawCube(ctx, slot.x, slot.y, 0, 44, 16, PEDESTAL_COL, 1);
    if (slot.sold) return;
    const bob = 32 + Math.sin(s.time * 3 + slot.x) * 4;
    const info = slot.kind === 'item' ? ITEMS.find(i => i.id === slot.id) : SHOP_INFO[slot.kind];
    if (slot.kind === 'item') drawCube(ctx, slot.x, slot.y, bob, 24, 24, colsOf(info.color), 0.95);
    else if (slot.kind === 'heart') drawSprite(ctx, T.heart, slot.x, slot.y, bob, 14);
    else {
      const r = drawCube(ctx, slot.x, slot.y, bob, 20, 28, colsOf('#ffe14a'), 0.95);
      const f = r.front, c = lerpPt(lerpPt(f[0], f[1], 0.5), lerpPt(f[3], f[2], 0.5), 0.5);
      ctx.font = '600 14px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#7a4a00'; ctx.fillText('?', c.x, c.y + 5);
    }
    const afford = s.coins >= slot.price, lp = proj(slot.x, slot.y + 34, 0);
    aeroText(ctx, '● ' + slot.price, lp.x, lp.y + 4, 16, afford ? '#b07800' : '#8a95a8');
    const p = s.player;
    if (Math.hypot(p.x - slot.x, p.y - slot.y) < 120) {
      const tp = proj(slot.x, slot.y, bob + 48);
      aeroText(ctx, info.name, tp.x, tp.y, 16);
      ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
      ctx.fillText(afford ? info.desc : 'Faltam ' + (slot.price - s.coins) + ' moedas', tp.x, tp.y + 16);
    }
  }

  function drawFamiliars(ctx, s, list) {
    const o = s.orbital, b = s.buddy;
    if (o) list.push({ y: o.y, draw: () => drawCube(ctx, o.x, o.y, 14, 16, 16, { top: '#fff8d6', front: '#ffd84a', side: '#c79a00' }, 1) });
    if (b) list.push({ y: b.y, draw: () => {
      const r = drawCube(ctx, b.x, b.y, 2, b.size, b.size, { top: '#fff0f7', front: '#ff8fc4', side: '#d0477f' }, 0.96);
      const d = DIRS[s.player.face];
      faceEyes(ctx, r.front, { x: d.dx, y: d.dy }, 1);
    } });
  }

  function drawItemIcons(ctx, s) {
    const items = s.player.items;
    items.forEach((id, i) => {
      const def = ITEMS.find(it => it.id === id), x = 12 + (i % 10) * 22, y = SCREEN_H - 28 - Math.floor(i / 10) * 22;
      ctx.fillStyle = def.color; ctx.beginPath(); ctx.roundRect(x, y, 18, 18, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, 14, 7, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(x, y, 18, 18, 5); ctx.stroke();
    });
  }

  function drawTrapdoor(ctx, s, t) {
    const h = t.size / 2;
    const q = [proj(t.x - h, t.y - h, 0), proj(t.x + h, t.y - h, 0), proj(t.x + h, t.y + h, 0), proj(t.x - h, t.y + h, 0)];
    poly(ctx, q, vGrad(ctx, q[0].y, q[2].y, '#062c4a', '#1c8fd0'), '#ffffff', 4);
    const c = proj(t.x, t.y, 0);
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(1, YSCALE); ctx.rotate(s.time * 2);
    ctx.strokeStyle = 'rgba(160,240,255,0.8)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + i * 7, i, i + 3.6); ctx.stroke(); }
    ctx.restore();
  }

  function drawLaser(ctx, l) {
    const e = laserEnd(l), a = proj(l.ox, l.oy, 22), b = proj(e.x, e.y, 22);
    ctx.save();
    ctx.lineCap = 'round';
    if (l.tele > 0) {
      ctx.strokeStyle = 'rgba(255,80,160,' + (0.35 + Math.sin(l.tele * 40) * 0.2) + ')';
      ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else {
      const k = sc((l.oy + e.y) / 2);
      ctx.strokeStyle = 'rgba(255,60,170,0.35)'; ctx.lineWidth = l.width * 1.8 * k;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,210,0.85)'; ctx.lineWidth = l.width * k;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = l.width * 0.35 * k;
      ctx.stroke();
    }
    ctx.restore();
  }

  function glossPanel(ctx, x, y, w, h, r, dark) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = dark
      ? vGrad(ctx, y, y + h, 'rgba(20,90,150,0.55)', 'rgba(5,40,80,0.65)')
      : vGrad(ctx, y, y + h, 'rgba(235,250,255,0.9)', 'rgba(110,200,245,0.85)');
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,' + (dark ? 0.18 : 0.55) + ')';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h * 0.45, r * 0.8); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
  }

  function aeroText(ctx, text, x, y, size, color, align) {
    ctx.font = '600 ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 6;
    ctx.fillStyle = color || '#0b4a75';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawHud(ctx, s) {
    const T = buildTextures(), p = s.player;
    glossPanel(ctx, 8, 6, W - 16, HUD - 12, 16);
    for (let i = 0; i < p.maxHp / 2; i++) {
      const x = 22 + i * 26, y = 11;
      ctx.drawImage(T.heartEmpty, x, y, 24, 24);
      const v = p.hp - i * 2;
      if (v >= 2) ctx.drawImage(T.heart, x, y, 24, 24);
      else if (v === 1) ctx.drawImage(T.heart, 0, 0, 16, 32, x, y, 12, 24);
    }
    if (s.godMode) aeroText(ctx, '★ Indestrutível', 30 + (p.maxHp / 2) * 26, 30, 14, '#c47a00', 'left');
    ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#0b4a75';
    ctx.fillText('Dano ' + p.dmg.toFixed(1) + '   Tiros/s ' + (1 / p.fireDelay).toFixed(1) +
      '   Vel ' + Math.round(p.speed) + (p.triple ? '   Triplo' : ''), 22, 50);
    aeroText(ctx, 'Andar ' + s.floor + '/' + MAX_FLOOR + ' · ' + biome(s).name, W / 2, 30, 18);
    ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText('abates: ' + s.kills + (activeMusic && activeMusic.started ? (activeMusic.muted ? '   ·   ♪ mudo (M)' : '   ·   ♪ música (M)') : ''), W / 2, 48);
    // cronômetro de speedrun, nível e moedas
    const rx = W - 290;
    aeroText(ctx, P.fmtTime(s.runTime), rx, 29, 16, '#0b4a75');
    ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#0b4a75'; ctx.fillText('Nv ' + s.level, rx - 26, 47);
    ctx.drawImage(T.coin, rx + 8, 36, 13, 13);
    ctx.fillStyle = '#9a6a00'; ctx.textAlign = 'left'; ctx.fillText(String(s.coins), rx + 24, 47);
    // barra de XP do nível atual
    const bx = 22, bw = W - 212 - 30, f = clamp(s.xp / xpNeed(s.level), 0, 1);
    ctx.fillStyle = 'rgba(11,74,117,0.18)'; ctx.beginPath(); ctx.roundRect(bx, 53, bw, 4, 2); ctx.fill();
    ctx.fillStyle = '#2fd08a'; ctx.beginPath(); ctx.roundRect(bx, 53, Math.max(2, bw * f), 4, 2); ctx.fill();
    drawMinimap(ctx, s);
  }

  // Ícones das melhorias escolhidas (acima dos ícones de item), com o nível
  function drawSkillIcons(ctx, s) {
    const rows = Math.ceil(s.player.items.length / 10);
    let i = 0;
    for (const sk of SKILLS) {
      const lv = s.skills[sk.id];
      if (!lv) continue;
      const x = 12 + i * 26, y = SCREEN_H - 30 - rows * 22 - 26;
      ctx.fillStyle = sk.color; ctx.beginPath(); ctx.arc(x + 11, y + 11, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b3556';
      ctx.fillText(String(lv), x + 11, y + 15);
      i++;
    }
  }

  function wrapText(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const w of text.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Combo, avisos de conquista, parcial do andar, números flutuantes
  function drawOverlays(ctx, s) {
    if (s.combo >= 2) {
      const pulse = 1 + Math.max(0, s.comboT - COMBO_TIME + 0.25) * 1.2;
      aeroText(ctx, 'COMBO x' + s.combo, W / 2, 96, Math.round(22 * pulse), '#e0560a');
      aeroText(ctx, 'XP x' + comboMult(s).toFixed(1), W / 2, 112, 13, '#0b4a75');
      ctx.fillStyle = 'rgba(224,86,10,0.8)';
      ctx.fillRect(W / 2 - 40, 116, 80 * s.comboT / COMBO_TIME, 3);
    }
    if (s.splitInfo && s.status === 'playing') {
      const si = s.splitInfo;
      ctx.globalAlpha = Math.min(1, si.t);
      ctx.font = '600 16px ' + FONT; ctx.textAlign = 'center';
      const base = 'Andar ' + si.floor + ' em ' + P.fmtTime(si.time);
      const delta = si.delta == null ? '' : '   ' + (si.delta <= 0 ? '−' : '+') + P.fmtTime(Math.abs(si.delta));
      aeroText(ctx, base + delta, W / 2, 252, 16, si.delta == null ? '#0b4a75' : si.delta <= 0 ? '#1f9a3c' : '#d0204a');
      ctx.globalAlpha = 1;
    }
    for (const f of s.floaters) {
      const c = proj(f.x, f.y, 34);
      ctx.globalAlpha = clamp(f.t / f.max * 1.5, 0, 1);
      aeroText(ctx, f.text, c.x, c.y, f.size, f.color);
    }
    ctx.globalAlpha = 1;
    if (s.toasts.length) {
      const t = s.toasts[0], w = 380, x = W / 2 - w / 2, y = SCREEN_H - 112;
      ctx.globalAlpha = Math.min(1, t.t * 2);
      ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.roundRect(x, y, w, 50, 16); ctx.fill();
      glossPanel(ctx, x, y, w, 50, 16);
      aeroText(ctx, '★ Conquista: ' + t.title, W / 2, y + 22, 17, '#b07800');
      ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
      ctx.fillText(t.sub, W / 2, y + 40);
      ctx.globalAlpha = 1;
    }
  }

  // Ondas de explosão e de cura no chão
  function drawFx(ctx, s) {
    for (const f of s.fx) {
      const c = proj(f.x, f.y, 0), k = sc(f.y), g = 1 - f.t / f.max, r = f.r * (0.4 + 0.6 * g) * k;
      ctx.globalAlpha = f.t / f.max;
      ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * YSCALE * 0.75, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Cartas de nível ----------
  function levelCardRect(i) { return { x: W / 2 - 355 + i * 245, y: 205, w: 220, h: 230 }; }

  function drawLevelUp(ctx, s) {
    const lu = s.levelUp;
    ctx.fillStyle = 'rgba(10,50,90,0.55)'; ctx.fillRect(0, 0, W, SCREEN_H);
    aeroText(ctx, 'Subiu de nível!', W / 2, 150, 40, '#0b4a75');
    ctx.font = '600 17px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#e9f9ff';
    ctx.fillText('Nível ' + (s.level - s.pendingLevels + 1) + ' · escolha uma melhoria', W / 2, 180);
    lu.cards.forEach((id, i) => {
      const sk = SKILLS.find(k => k.id === id), r = levelCardRect(i), sel = i === lu.index;
      const y = r.y - (sel ? 8 : 0), lv = s.skills[id] || 0;
      glossPanel(ctx, r.x, y, r.w, r.h, 22, !sel);
      ctx.fillStyle = sk.color; ctx.beginPath(); ctx.arc(r.x + r.w / 2, y + 52, 26, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(r.x + r.w / 2 - 6, y + 42, 12, 6, -0.4, 0, TAU); ctx.fill();
      aeroText(ctx, sk.name, r.x + r.w / 2, y + 112, 22, sel ? '#0b4a75' : '#e9f9ff');
      ctx.font = '15px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = sel ? '#1d6ea3' : '#d6f1ff';
      wrapText(ctx, sk.desc, r.w - 30).forEach((l, j) => ctx.fillText(l, r.x + r.w / 2, y + 140 + j * 19));
      ctx.font = '600 13px ' + FONT;
      ctx.fillText('Nv ' + lv + ' → ' + (lv + 1) + ' (máx ' + SKILL_MAX + ')', r.x + r.w / 2, y + 196);
      if (!touchMode) ctx.fillText('[' + (i + 1) + ']', r.x + r.w / 2, y + 216);
    });
    ctx.font = '14px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#e9f9ff';
    ctx.fillText(touchMode ? 'Toque numa carta' : 'Teclas 1, 2, 3  ·  ou ← → e Enter', W / 2, 470);
  }

  // Tela de fim de partida: estatísticas, tempo, XP de conta e recordes
  function drawResults(ctx, s, title) {
    ctx.fillStyle = 'rgba(10,50,90,0.45)'; ctx.fillRect(0, 0, W, SCREEN_H);
    const w = 580, h = 250, x = W / 2 - w / 2, y = SCREEN_H / 2 - h / 2;
    glossPanel(ctx, x, y, w, h, 26);
    aeroText(ctx, title, W / 2, y + 48, 34);
    ctx.textAlign = 'center';
    ctx.font = '16px ' + FONT; ctx.fillStyle = '#1d6ea3';
    ctx.fillText('Andar ' + s.floor + ' de ' + MAX_FLOOR + ' · ' + s.kills + ' abates · Nível ' + s.level + ' · Combo máx x' + s.bestCombo, W / 2, y + 82);
    aeroText(ctx, 'Tempo ' + P.fmtTime(s.runTime), W / 2, y + 112, 20, '#0b4a75');
    const r = s.result;
    ctx.font = '15px ' + FONT; ctx.fillStyle = '#1d6ea3';
    if (s.godMode) ctx.fillText('Modo indestrutível: não conta para recordes nem XP de conta', W / 2, y + 142);
    else if (r) ctx.fillText('+' + r.xp + ' XP de conta' + (r.levelUp ? '  ·  a conta subiu de nível! (novo ponto de talento)' : ''), W / 2, y + 142);
    if (r && r.records.length) aeroText(ctx, '★ NOVO RECORDE: ' + r.records.join(', '), W / 2, y + 174, 16, '#b07800');
    ctx.font = '600 15px ' + FONT; ctx.fillStyle = '#0b4a75';
    ctx.fillText(touchMode ? 'Toque para jogar de novo' : 'R jogar de novo  ·  Esc menu', W / 2, y + 222);
  }

  function drawMinimap(ctx, s) {
    const bx = W - 212, by = 10, bw = 196, bh = HUD - 20, cw = 16, ch = 10, g = 3;
    glossPanel(ctx, bx, by, bw, bh, 10, true);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.clip();
    const cx = bx + bw / 2, cy = by + bh / 2;
    for (const key in s.rooms) {
      const r = s.rooms[key];
      let known = r.visited;
      if (!known) for (const k in r.doors) {
        if (s.rooms[rk(r.x + DIRS[k].dx, r.y + DIRS[k].dy)].visited) known = true;
      }
      if (!known) continue;
      const x = cx + (r.x - s.cur.x) * (cw + g) - cw / 2, y = cy + (r.y - s.cur.y) * (ch + g) - ch / 2;
      const isCur = r.x === s.cur.x && r.y === s.cur.y;
      ctx.fillStyle = isCur ? '#ffffff' : r.visited ? 'rgba(160,225,255,0.9)' : 'rgba(160,225,255,0.3)';
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 3); ctx.fill();
      if (r.type === 'boss' || r.type === 'item' || r.type === 'shop') {
        ctx.fillStyle = r.type === 'boss' ? '#ff4f6d' : r.type === 'item' ? '#ffcf3a' : '#4fd67a';
        ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, 3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBossBar(ctx, boss) {
    const w = 440, x = W / 2 - w / 2, y = SCREEN_H - 30;
    glossPanel(ctx, x, y, w, 20, 10, true);
    const f = clamp(boss.hp / boss.maxHp, 0, 1);
    if (f > 0) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 3, y + 3, (w - 6) * f, 14, 7); ctx.clip();
      ctx.fillStyle = vGrad(ctx, y, y + 20, '#ff9fc4', '#e0004f'); ctx.fillRect(x, y, w, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, y + 3, w, 6);
      ctx.restore();
    }
    ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.fillText(boss.name, W / 2, y + 14);
  }

  function centerPanel(ctx, title, sub) {
    ctx.fillStyle = 'rgba(10,50,90,0.4)'; ctx.fillRect(0, 0, W, SCREEN_H);
    glossPanel(ctx, W / 2 - 260, SCREEN_H / 2 - 70, 520, 130, 26);
    aeroText(ctx, title, W / 2, SCREEN_H / 2 - 12, 36);
    ctx.font = '16px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText(sub, W / 2, SCREEN_H / 2 + 26);
  }

  function drawAmbientBubbles(ctx, s, n, alpha, minR, maxR) {
    const T = buildTextures();
    for (let i = 0; i < n; i++) {
      const r = minR + ((i * 37) % 10) / 10 * (maxR - minR);
      const x = ((i * 173) % W) + Math.sin(s.time * 0.8 + i) * 24;
      const y = SCREEN_H + 40 - ((s.time * (16 + (i % 4) * 8) + i * 113) % (SCREEN_H + 80));
      ctx.globalAlpha = alpha;
      ctx.drawImage(T.bubble, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // Layout do menu (usado pelo desenho e pelo toque)
  function menuOptionRect(i) { return { x: W / 2 - 140, y: 272 + i * 52, w: 280, h: 44 }; }
  const PANEL_RECT = { x: W / 2 - 330, y: 172, w: 660, h: 404 };
  const BACK_RECT = { x: W / 2 - 90, y: 536, w: 180, h: 30 };
  function talentRowRect(i) { return { x: W / 2 - 300, y: 242 + i * 42, w: 600, h: 36 }; }

  function drawMenu(ctx, s) {
    const T = buildTextures(), sv = getSave();
    ctx.drawImage(T.sky, 0, 0);
    drawAmbientBubbles(ctx, s, 22, 0.7, 8, 30);
    // o herói: um cubo de vidro flutuando
    const bob = 30 + Math.sin(s.time * 2) * 10;
    const sh = proj(W / 2, 215, 0);
    ctx.fillStyle = 'rgba(10,60,110,0.18)';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 40 - bob * 0.3, 12, 0, 0, TAU); ctx.fill();
    const r = drawCube(ctx, W / 2, 215, bob, 70, 70, PLAYER_COL, 0.96);
    faceEyes(ctx, r.front, { x: Math.sin(s.time), y: 0.3 }, 1);
    aeroText(ctx, 'Bloco de Isaac', W / 2, 120, 58);
    ctx.font = '18px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
    ctx.fillText('Um roguelike de vidro em ' + MAX_FLOOR + ' andares', W / 2, 152);
    drawAccountBadge(ctx, sv);

    if (s.screen === 'help') return drawHelp(ctx);
    if (s.screen === 'talents') return drawTalents(ctx, s, sv);
    if (s.screen === 'achievements') return drawAchievements(ctx, sv);
    if (s.screen === 'records') return drawRecords(ctx, sv);
    MENU_OPTIONS.forEach((label, i) => {
      const sel = i === s.menuIndex, rr = menuOptionRect(i), grow = sel ? 20 : 0;
      glossPanel(ctx, rr.x - grow, rr.y, rr.w + grow * 2, rr.h, 22, !sel);
      ctx.font = '600 ' + (sel ? 24 : 20) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sel ? '#0b4a75' : '#e9f9ff';
      let txt = (sel ? '▶  ' : '') + label;
      if (label === 'Talentos' && P.freePoints(sv) > 0) txt += '  (' + P.freePoints(sv) + ')';
      ctx.fillText(txt, W / 2, rr.y + rr.h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    });
    ctx.font = '14px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
    if (touchMode) { ctx.fillText('Toque numa opção', W / 2, 556); return; }
    ctx.fillText('↑ ↓ ou W S para escolher  ·  Enter ou Espaço para confirmar', W / 2, 552);
    ctx.fillText('M  liga/desliga a música', W / 2, 572);
  }

  // Nível de conta no canto do menu
  function drawAccountBadge(ctx, sv) {
    const a = P.accountLevel(sv.accountXp), x = 16, y = 14, w = 210, h = 54;
    glossPanel(ctx, x, y, w, h, 16);
    aeroText(ctx, 'Conta  Nv ' + a.level, x + 14, y + 22, 17, '#0b4a75', 'left');
    const pts = P.freePoints(sv);
    if (pts > 0) aeroText(ctx, pts + (pts > 1 ? ' pontos' : ' ponto'), x + w - 12, y + 22, 13, '#b07800', 'right');
    ctx.fillStyle = 'rgba(11,74,117,0.18)'; ctx.beginPath(); ctx.roundRect(x + 14, y + 32, w - 28, 7, 3); ctx.fill();
    ctx.fillStyle = '#2fd08a'; ctx.beginPath(); ctx.roundRect(x + 14, y + 32, Math.max(3, (w - 28) * a.into / a.need), 7, 3); ctx.fill();
    ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText(Math.floor(a.into) + ' / ' + a.need + ' XP', x + 14, y + 51);
  }

  function screenPanel(ctx, title, sub) {
    glossPanel(ctx, PANEL_RECT.x, PANEL_RECT.y, PANEL_RECT.w, PANEL_RECT.h, 24);
    aeroText(ctx, title, W / 2, PANEL_RECT.y + 34, 26);
    if (sub) { ctx.font = '14px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3'; ctx.fillText(sub, W / 2, PANEL_RECT.y + 56); }
  }

  function backHint(ctx, keys) {
    ctx.font = '600 14px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText(touchMode ? '◀ Voltar' : keys, W / 2, BACK_RECT.y + 20);
  }

  function drawHelp(ctx) {
    screenPanel(ctx, 'Controles');
    ctx.font = '17px ' + FONT; ctx.fillStyle = '#0b4a75'; ctx.textAlign = 'center';
    const lines = touchMode
      ? ['Analógico esquerdo  —  mover o bloco', 'Analógico direito  —  atirar bolhas', 'Escudo  —  10 s sem dano (recarga 20 s)',
        '❚❚  —  pausar', '♪  —  ligar/desligar música', 'Cartas de nível  —  toque na que quiser',
        'Loja  —  ande até o produto para comprar', 'Toque na tela  —  recomeçar depois de perder']
      : ['WASD  —  mover o bloco', 'Setas  —  atirar bolhas', 'P  —  escudo de 10 s (recarga 20 s)', 'Esc  —  pausar', 'M  —  ligar/desligar música',
        'Cartas de nível  —  1, 2, 3 (ou ← → e Enter)', 'Loja  —  ande até o produto para comprar',
        'R  —  recomeçar depois de perder', 'Esc  —  voltar ao menu depois de perder'];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 250 + i * 31));
    backHint(ctx, 'Enter ou Esc para voltar');
  }

  function drawTalents(ctx, s, sv) {
    const pts = P.freePoints(sv);
    screenPanel(ctx, 'Talentos', 'Pontos livres: ' + pts + '  ·  ganhe 1 ponto a cada nível de conta');
    P.TALENTS.forEach((t, i) => {
      const r = talentRowRect(i), sel = i === s.talentIndex, lv = sv.talents[t.id] || 0;
      glossPanel(ctx, r.x, r.y, r.w, r.h, 14, !sel);
      aeroText(ctx, t.name, r.x + 16, r.y + 24, 17, sel ? '#0b4a75' : '#e9f9ff', 'left');
      ctx.font = '13px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = sel ? '#1d6ea3' : '#d6f1ff';
      ctx.fillText(t.desc, r.x + 190, r.y + 23);
      for (let k = 0; k < t.max; k++) { // bolinhas: nível comprado
        ctx.fillStyle = k < lv ? '#2fd08a' : 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(r.x + r.w - 20 - (t.max - 1 - k) * 18, r.y + r.h / 2, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    });
    const rr = talentRowRect(P.TALENTS.length), sel = s.talentIndex === P.TALENTS.length;
    glossPanel(ctx, rr.x, rr.y, rr.w, rr.h, 14, !sel);
    aeroText(ctx, s.confirmReset ? 'Tem certeza? Confirme de novo para apagar TUDO' : 'Apagar progresso', W / 2, rr.y + 25, 16,
      s.confirmReset ? '#d0204a' : sel ? '#0b4a75' : '#e9f9ff');
    backHint(ctx, '↑ ↓ escolher  ·  Enter comprar  ·  Esc voltar');
  }

  function drawAchievements(ctx, sv) {
    const n = P.ACHIEVEMENTS.filter(a => sv.achievements[a.id]).length;
    screenPanel(ctx, 'Conquistas  ' + n + '/' + P.ACHIEVEMENTS.length);
    P.ACHIEVEMENTS.forEach((a, i) => {
      const x = W / 2 - 318 + (i % 3) * 214, y = 236 + Math.floor(i / 3) * 59, got = !!sv.achievements[a.id];
      glossPanel(ctx, x, y, 206, 53, 12, !got);
      aeroText(ctx, (got ? '★ ' : '') + a.name, x + 10, y + 20, 14, got ? '#b07800' : '#e9f9ff', 'left');
      ctx.font = '11px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = got ? '#1d6ea3' : '#d6f1ff';
      wrapText(ctx, a.desc, 186).slice(0, 2).forEach((l, j) => ctx.fillText(l, x + 10, y + 36 + j * 13));
    });
    backHint(ctx, 'Enter ou Esc para voltar');
  }

  function drawRecords(ctx, sv) {
    const rec = sv.records, st = sv.stats;
    screenPanel(ctx, 'Recordes');
    const left = [
      ['Andar mais alto', rec.bestFloor ? rec.bestFloor + ' de ' + MAX_FLOOR : '—'],
      ['Mais abates', rec.mostKills || '—'],
      ['Maior nível', rec.bestLevel || '—'],
      ['Maior combo', rec.bestCombo ? 'x' + rec.bestCombo : '—'],
      ['Melhor tempo', rec.bestTime == null ? '—' : P.fmtTime(rec.bestTime)],
      ['Partidas', st.runs + '  (' + st.wins + ' vitórias)'],
      ['Abates no total', st.kills],
      ['Chefões derrotados', st.bossKills],
    ];
    ctx.textAlign = 'left';
    left.forEach(([k, v], i) => {
      ctx.font = '15px ' + FONT; ctx.fillStyle = '#1d6ea3'; ctx.fillText(k, W / 2 - 300, 252 + i * 34);
      aeroText(ctx, String(v), W / 2 - 110, 252 + i * 34, 16, '#0b4a75', 'left');
    });
    aeroText(ctx, 'Melhores parciais (speedrun)', W / 2 + 160, 252, 15, '#0b4a75');
    for (let i = 0; i < MAX_FLOOR; i++) {
      ctx.font = '14px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#1d6ea3';
      ctx.fillText('Andar ' + (i + 1), W / 2 + 70, 280 + i * 25);
      ctx.fillStyle = '#0b4a75';
      ctx.fillText(P.fmtTime(rec.bestSplits[i]), W / 2 + 170, 280 + i * 25);
    }
    backHint(ctx, 'Enter ou Esc para voltar');
  }

  // Medidor do escudo (canto inferior direito)
  function drawShieldMeter(ctx, s) {
    const p = s.player, w = 176, h = 24, x = W - w - 12, y = SCREEN_H - h - 8;
    const active = p.shieldTime > 0, ready = !active && p.shieldCd <= 0;
    glossPanel(ctx, x, y, w, h, 12, !ready && !active);
    const f = active ? p.shieldTime / SHIELD_TIME : ready ? 1 : 1 - p.shieldCd / (SHIELD_COOLDOWN * p.shieldCdMult);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, Math.max(0, (w - 6) * f), h - 6, 9); ctx.clip();
    ctx.fillStyle = active ? vGrad(ctx, y, y + h, '#bff3ff', '#1fa8f0')
      : ready ? vGrad(ctx, y, y + h, '#d8ffd0', '#4cc23a')
      : vGrad(ctx, y, y + h, '#cfd8e3', '#7d8fa6'); // recarregando: cinza
    ctx.globalAlpha = ready || active ? 0.9 : 0.6;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = ready || active ? '#0b4a75' : '#ffffff';
    const txt = active ? 'Escudo ativo: ' + Math.ceil(p.shieldTime) + ' s'
      : ready ? (touchMode ? 'Escudo pronto' : 'Escudo pronto (P)') :'Escudo recarregando: ' + Math.ceil(p.shieldCd) + ' s';
    ctx.fillText(txt, x + w / 2, y + 16);
  }

  // Analógicos e botões de toque (só em aparelhos de toque, durante a partida)
  function drawTouch(ctx, s, t) {
    if (!touchMode || s.status !== 'playing' || s.paused) return;
    const stick = (st, hx, hy, label) => {
      const ox = st ? st.ox : hx, oy = st ? st.oy : hy;
      ctx.globalAlpha = st ? 0.55 : 0.25;
      ctx.fillStyle = 'rgba(233,249,255,0.5)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ox, oy, STICK_R, 0, TAU); ctx.fill(); ctx.stroke();
      const kx = st ? st.x : hx, ky = st ? st.y : hy;
      const dx = kx - ox, dy = ky - oy, len = Math.hypot(dx, dy), f = len > STICK_R ? STICK_R / len : 1;
      ctx.globalAlpha = st ? 0.85 : 0.4;
      ctx.fillStyle = vGrad(ctx, oy - 28, oy + 28, '#e9fbff', '#3fb6f0');
      ctx.beginPath(); ctx.arc(ox + dx * f, oy + dy * f, 28, 0, TAU); ctx.fill(); ctx.stroke();
      if (!st) {
        ctx.font = '600 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
        ctx.fillText(label, ox, oy + STICK_R + 18);
      }
    };
    stick(t.move, 120, SCREEN_H - 130, 'mover');
    stick(t.aim, W - 250, SCREEN_H - 130, 'atirar');

    const p = s.player, ready = p.shieldTime <= 0 && p.shieldCd <= 0;
    for (const b of TOUCH_BTNS) {
      ctx.globalAlpha = b.id === 'shield' && !ready ? 0.35 : 0.75;
      ctx.fillStyle = vGrad(ctx, b.y - b.r, b.y + b.r, '#e9fbff', b.id === 'shield' ? '#4cc23a' : '#3fb6f0');
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0b4a75'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (b.id === 'shield') { ctx.font = '600 15px ' + FONT; ctx.fillText('Escudo', b.x, b.y); }
      if (b.id === 'pause') { ctx.fillRect(b.x - 8, b.y - 9, 6, 18); ctx.fillRect(b.x + 2, b.y - 9, 6, 18); }
      if (b.id === 'music') {
        ctx.font = '600 22px ' + FONT; ctx.fillText('♪', b.x, b.y + 1);
        if (activeMusic && activeMusic.muted) {
          ctx.strokeStyle = '#e0004f'; ctx.beginPath(); ctx.moveTo(b.x - 14, b.y + 14); ctx.lineTo(b.x + 14, b.y - 14); ctx.stroke();
        }
      }
      ctx.textBaseline = 'alphabetic';
    }
    ctx.globalAlpha = 1;
  }

  function drawCheatNotice(ctx, s) {
    ctx.fillStyle = 'rgba(10,50,90,0.45)'; ctx.fillRect(0, 0, W, SCREEN_H);
    const pw = 600, ph = 170, x = W / 2 - pw / 2, y = SCREEN_H / 2 - ph / 2;
    ctx.fillStyle = '#d6f1ff'; ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 28); ctx.fill(); // fundo sólido
    glossPanel(ctx, x, y, pw, ph, 28);
    aeroText(ctx, '★ Parabéns, você ativou o código secreto! ★', W / 2, y + 62, 24, '#0b4a75');
    ctx.font = '17px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText('Seu bloco agora é indestrutível', W / 2, y + 98);
    ctx.font = '600 15px ' + FONT;
    ctx.fillText('O jogo começa em ' + Math.ceil(s.cheatNotice) + '...', W / 2, y + 132);
  }

  function render(ctx, s) {
    if (s.status === 'menu') {
      drawMenu(ctx, s);
      if (s.cheatNotice > 0) drawCheatNotice(ctx, s);
      return;
    }
    const T = buildTextures(), room = curRoom(s), p = s.player;
    ctx.save();
    ctx.drawImage(T.sky, 0, 0);
    drawAmbientBubbles(ctx, s, 14, 0.6, 6, 22);
    if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

    drawFloor(ctx, s);
    if (room.type === 'start' && s.floor === 1) {
      ctx.save(); ctx.globalAlpha = 0.55;
      const tips = touchMode ? ['Dedo esquerdo  mover', 'Dedo direito  atirar', 'Botão  escudo']
        : ['WASD  mover', 'SETAS  atirar', 'P  escudo   ·   Esc  pausar'];
      for (const [txt, y] of tips.map((txt, i) => [txt, H / 2 + 90 + i * 35])) {
        const q = proj(W / 2, y, 0);
        aeroText(ctx, txt, q.x, q.y, 20, '#0b5a8a');
      }
      ctx.restore();
    }
    if (room.trapdoor) drawTrapdoor(ctx, s, room.trapdoor);
    if (room.type === 'shop') { const q = proj(W / 2, H / 2 - 120, 0); aeroText(ctx, 'Loja do Cubo', q.x, q.y, 26, '#1f8a4c'); }
    drawFx(ctx, s);

    // sombras no chão
    for (const r of room.rocks) drawShadow(ctx, r.x + r.w / 2 + 4, r.y + r.h / 2 + 6, 22, 0.18);
    for (const e of room.enemies) {
      let r = e.size / 2, a = 0.25;
      if (e.type === 'boss' && e.kind === 'gelatao' && e.z > 30) {
        const f = clamp(1 - e.z / 700, 0, 1); r *= 0.4 + 0.6 * f; a = 0.2 + 0.25 * f;
        const c = proj(e.x, e.y, 0);
        ctx.strokeStyle = 'rgba(255,60,120,' + (0.4 + Math.sin(s.time * 20) * 0.2) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, e.size / 2 * sc(e.y), e.size / 2 * sc(e.y) * YSCALE * 0.75, 0, 0, TAU); ctx.stroke();
      }
      drawShadow(ctx, e.x, e.y, r, a * (e.alpha === undefined ? 1 : e.alpha));
    }
    drawShadow(ctx, p.x, p.y, p.size / 2 + 2, 0.28);
    for (const t of s.tears) drawShadow(ctx, t.x, t.y, 5, 0.18);
    for (const b of s.bullets) drawShadow(ctx, b.x, b.y, b.size / 2 - 1, 0.18);

    drawWalls(ctx, s, room);

    // aviso das investidas: faixa vermelha piscando
    for (const e of room.enemies) {
      if (e.state === 'chargeWind' && e.cang !== undefined) {
        const end = laserEnd({ ox: e.x, oy: e.y, ang: e.cang });
        const a = proj(e.x, e.y, 2), b = proj(end.x, end.y, 2);
        ctx.strokeStyle = 'rgba(255,60,120,' + (0.3 + Math.sin(s.time * 30) * 0.15) + ')';
        ctx.lineWidth = e.size * 0.8 * sc(e.y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    // entidades ordenadas por profundidade
    const list = [];
    const biomeRock = biome(s).rock;
    for (const r of room.rocks) list.push({ y: r.y + r.h / 2, draw: () => drawCube(ctx, r.x + r.w / 2, r.y + r.h / 2, 0, r.w - 2, 34, biomeRock, biomeRock.alpha) });
    for (const pk of room.pickups) list.push({ y: pk.y, draw: () => drawPickup(ctx, s, pk) });
    if (room.shop) for (const slot of room.shop) list.push({ y: slot.y, draw: () => drawShopSlot(ctx, s, slot) });
    if (room.item) list.push({ y: room.item.y, draw: () => drawItemPedestal(ctx, s, room.item) });
    for (const e of room.enemies) list.push({ y: e.y, draw: () => {
      drawEnemy(ctx, s, e);
      if (e.frozen > 0) { // gelo da Bolha Gelada
        const c = proj(e.x, e.y, e.z + e.size / 2), r = e.size * 0.6 * sc(e.y);
        ctx.fillStyle = 'rgba(170,235,255,0.4)'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    } });
    list.push({ y: p.y, draw: () => {
      drawPlayer(ctx, s);
      if (p.shieldUp) drawSprite(ctx, T.bubble, p.x, p.y, -4, p.size * 0.95, 0.85);
      if (p.shieldTime > 0) { // escudo P: bolha grande que pisca nos últimos 2 s
        const blink = p.shieldTime < 2 && Math.floor(p.shieldTime * 8) % 2 === 0;
        if (!blink) drawSprite(ctx, T.bubble, p.x, p.y, -10, p.size * 1.25 + Math.sin(s.time * 6) * 2, 1);
      }
    } });
    drawFamiliars(ctx, s, list);
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();

    // projéteis e lasers
    for (const t of s.tears) {
      const z = 20 * Math.min(1, t.life / Math.min(0.2, t.max));
      drawSprite(ctx, T.tear, t.x, t.y, z, t.size / 2 + 1);
    }
    for (const b of s.bullets) drawSprite(ctx, T.bullet, b.x, b.y, 10, b.size / 2 + 1, b.wait > 0 ? 0.6 : 1);
    for (const l of s.lasers) drawLaser(ctx, l);

    drawFrontWall(ctx, s, room);

    for (const q of s.particles) {
      const c = proj(q.x, q.y, q.z);
      ctx.globalAlpha = q.life / q.max;
      ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(c.x, c.y, q.size / 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c.x - q.size * 0.15, c.y - q.size * 0.15, q.size * 0.18, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawAmbientBubbles(ctx, s, 6, 0.35, 10, 26);
    ctx.restore();

    const boss = room.enemies.find(e => e.type === 'boss');
    if (boss) drawBossBar(ctx, boss);
    drawItemIcons(ctx, s);
    drawSkillIcons(ctx, s);
    drawShieldMeter(ctx, s);
    drawHud(ctx, s);
    if (s.msg && s.status === 'playing') {
      ctx.globalAlpha = Math.min(1, s.msg.t);
      aeroText(ctx, s.msg.title, W / 2, 190, 40);
      if (s.msg.sub) { ctx.font = '18px ' + FONT; ctx.fillStyle = '#0b4a75'; ctx.textAlign = 'center'; ctx.fillText(s.msg.sub, W / 2, 220); }
      ctx.globalAlpha = 1;
    }
    drawOverlays(ctx, s);
    if (s.paused && s.status === 'playing') centerPanel(ctx, 'Pausa', touchMode ? 'Toque para continuar' : 'Esc para continuar');
    if (s.status === 'dead') drawResults(ctx, s, 'Você foi quebrado');
    if (s.status === 'won') drawResults(ctx, s, 'Vitória cristalina!');
    if (s.levelUp && s.status === 'playing' && !s.paused) drawLevelUp(ctx, s);
  }

  let activeMusic = null;
  function getMusic() { return activeMusic; }

  // Música: começa na primeira tecla (o navegador exige um gesto do usuário); M liga/desliga
  function bindMusic(target, music) {
    target.addEventListener('keydown', e => {
      if (e.repeat) return;
      music.start();
      if (e.code === 'KeyM') music.toggleMute();
    });
  }

  function start(canvas) {
    const ctx = canvas.getContext('2d');
    const s = createState(undefined, { menu: true });
    const touch = createTouch();
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) touchMode = true;
    bindInput(s, window);
    bindTouch(s, touch, canvas, window);
    if (global.BlockMusic) {
      if (activeMusic) activeMusic.stop();
      activeMusic = global.BlockMusic.createMusic();
      bindMusic(window, activeMusic);
    }
    let last = performance.now();
    function frame(now) {
      syncTouch(s, touch);
      update(s, (now - last) / 1000);
      last = now;
      if (activeMusic) activeMusic.setIntensity(musicIntensity(s));
      render(ctx, s);
      drawTouch(ctx, s, touch);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return s;
  }

  global.BlockGame = {
    W, H, HUD, WALL, TILE, IX0, IY0, IX1, IY1, DOOR, MAX_FLOOR, DIRS, ITEMS, BOSSES, FLOORS, BIOMES, ENEMY_BASE, ENEMY_XP,
    SKILLS, SKILL_MAX, xpNeed, gainXp, openLevelUp, chooseCard, comboMult, COMBO_TIME, shopPrices, hitEnemy, explode, finishRun,
    menuOptionRect, levelCardRect, talentRowRect, PANEL_RECT, BACK_RECT, setStorage, getSave,
    SCREEN_H, WALL_H, PLAYER_DMG_BONUS, PLAYER_SPEED_BONUS, PLAYER_MAX_HP, ENEMY_HP_BONUS, BOSS_HP_MULT, MENU_OPTIONS, SECRET_CODE, CHEAT_NOTICE_TIME, SHIELD_TIME, SHIELD_COOLDOWN, musicIntensity, createState, startGame, update, render, setKey, bindInput, enterRoom,
    createTouch, touchDown, touchMove, touchUp, syncTouch, stickCodes, drawTouch, TOUCH_BTNS, STICK_R,
    setTouchMode: on => { touchMode = !!on; }, generateFloor,
    makeEnemy, curRoom, start, rk, proj, sc, buildTextures, laserEnd, getMusic, bindMusic,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const c = document.getElementById('game');
      if (c) start(c);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
