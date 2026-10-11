// Bloco de Isaac - progresso salvo no navegador: nível de conta, talentos, conquistas e recordes.
// Módulo puro (sem canvas). Se o navegador bloquear o armazenamento, o jogo segue sem salvar.
(function (global) {
  'use strict';

  const SAVE_KEY = 'blocoIsaac.save.v1';
  let storage = null;
  try { storage = global.localStorage || null; } catch (e) { storage = null; }

  function setStorage(st) { storage = st; }

  function defaults() {
    return {
      accountXp: 0,
      talents: {},          // id -> nível comprado
      achievements: {},     // id -> data em que desbloqueou
      stats: { runs: 0, wins: 0, kills: 0, bossKills: 0, purchases: 0 },
      records: { bestFloor: 0, mostKills: 0, bestLevel: 0, bestCombo: 0, bestTime: null, bestSplits: [] },
    };
  }

  function load() {
    const d = defaults();
    try {
      const raw = storage && storage.getItem(SAVE_KEY);
      if (!raw) return d;
      const o = JSON.parse(raw);
      return {
        accountXp: +o.accountXp || 0,
        talents: Object.assign({}, o.talents),
        achievements: Object.assign({}, o.achievements),
        stats: Object.assign(d.stats, o.stats),
        records: Object.assign(d.records, o.records),
      };
    } catch (e) { return d; }
  }

  function save(data) {
    try { if (storage) { storage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } } catch (e) { /* sem espaço ou bloqueado */ }
    return false;
  }

  function reset() {
    try { if (storage) storage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
    return defaults();
  }

  // ---------- Nível de conta ----------
  // Do nível n para o n+1 são 60 + 40*(n-1) de XP.
  const levelCost = n => 60 + 40 * (n - 1);
  function accountLevel(xp) {
    let lvl = 1, left = xp;
    while (left >= levelCost(lvl)) { left -= levelCost(lvl); lvl++; }
    return { level: lvl, into: left, need: levelCost(lvl) };
  }

  // ---------- Talentos (pontos de conta: 1 por nível) ----------
  const TALENTS = [
    { id: 'hp', name: 'Coração Extra', desc: '+1 coração no início', max: 2 },
    { id: 'dmg', name: 'Força Inicial', desc: '+5% de dano', max: 5 },
    { id: 'xp', name: 'Sabedoria', desc: '+10% de XP', max: 5 },
    { id: 'coins', name: 'Ganância', desc: '+15% de moedas', max: 4 },
    { id: 'shield', name: 'Escudo Ágil', desc: 'Escudo P recarrega 10% mais rápido', max: 3 },
    { id: 'item', name: 'Herança', desc: 'Começa com 1 item aleatório', max: 1 },
  ];

  function spentPoints(data) { let n = 0; for (const k in data.talents) n += data.talents[k]; return n; }
  function freePoints(data) { return accountLevel(data.accountXp).level - 1 - spentPoints(data); }

  function buyTalent(data, id) {
    const t = TALENTS.find(x => x.id === id), cur = data.talents[id] || 0;
    if (!t || cur >= t.max || freePoints(data) < 1) return false;
    data.talents[id] = cur + 1;
    return true;
  }

  // ---------- Conquistas ----------
  // r = partida atual somada ao total salvo (ver snapshot no game.js)
  const ACHIEVEMENTS = [
    { id: 'boss1', name: 'Caçador', desc: 'Derrote seu primeiro chefão', check: r => r.totalBossKills >= 1 },
    { id: 'floor5', name: 'Explorador', desc: 'Chegue ao andar 5', check: r => r.floor >= 5 },
    { id: 'floor10', name: 'Portas do Núcleo', desc: 'Chegue ao andar 10', check: r => r.floor >= 10 },
    { id: 'win', name: 'Vitória Cristalina', desc: 'Derrote o Hipercubo', check: r => r.won },
    { id: 'speed20', name: 'Velocista', desc: 'Vença em menos de 20 minutos', check: r => r.won && r.time < 20 * 60 },
    { id: 'speed12', name: 'Relâmpago', desc: 'Vença em menos de 12 minutos', check: r => r.won && r.time < 12 * 60 },
    { id: 'kills100', name: 'Centena', desc: '100 abates no total', check: r => r.totalKills >= 100 },
    { id: 'kills500', name: 'Exterminador', desc: '500 abates no total', check: r => r.totalKills >= 500 },
    { id: 'combo15', name: 'Mestre do Combo', desc: 'Faça um combo x15', check: r => r.bestCombo >= 15 },
    { id: 'clean', name: 'Intocável', desc: 'Passe um andar sem tomar dano', check: r => r.cleanFloors >= 1 },
    { id: 'shop10', name: 'Freguês', desc: 'Compre 10 vezes na loja', check: r => r.totalPurchases >= 10 },
    { id: 'level15', name: 'Veterano', desc: 'Chegue ao nível 15 numa partida', check: r => r.level >= 15 },
    { id: 'rich', name: 'Cofrinho Cheio', desc: 'Junte 50 moedas de uma vez', check: r => r.coinsMax >= 50 },
    { id: 'items8', name: 'Colecionador', desc: 'Tenha 8 itens numa partida', check: r => r.items >= 8 },
    { id: 'noshield', name: 'Sem Rede', desc: 'Vença sem usar o escudo P', check: r => r.won && !r.usedShield },
  ];

  // Devolve as conquistas que acabaram de ser desbloqueadas (e já marca no save)
  function unlock(data, r) {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (data.achievements[a.id] || !a.check(r)) continue;
      data.achievements[a.id] = Date.now();
      fresh.push(a);
    }
    return fresh;
  }

  // ---------- Fim de partida: soma estatísticas e recordes ----------
  // Devolve a lista de recordes batidos (para a tela de resultado)
  function recordRun(data, run) {
    const st = data.stats, rec = data.records, beaten = [];
    st.runs++; if (run.won) st.wins++;
    st.kills += run.kills; st.bossKills += run.bossKills; st.purchases += run.purchases;
    data.accountXp += Math.floor(run.xp);
    const better = (key, v, label) => { if (v > rec[key]) { rec[key] = v; beaten.push(label); } };
    better('bestFloor', run.floor, 'Andar mais alto');
    better('mostKills', run.kills, 'Mais abates');
    better('bestLevel', run.level, 'Maior nível');
    better('bestCombo', run.bestCombo, 'Maior combo');
    if (run.won && (rec.bestTime === null || run.time < rec.bestTime)) { rec.bestTime = run.time; beaten.push('Melhor tempo'); }
    run.splits.forEach((t, i) => { if (rec.bestSplits[i] == null || t < rec.bestSplits[i]) rec.bestSplits[i] = t; });
    return beaten;
  }

  function fmtTime(sec) {
    if (sec == null) return '--:--.--';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), c = Math.floor((sec * 100) % 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
  }

  global.BlockProgress = {
    SAVE_KEY, TALENTS, ACHIEVEMENTS, setStorage, defaults, load, save, reset,
    accountLevel, levelCost, freePoints, spentPoints, buyTalent, unlock, recordRun, fmtTime,
  };
})(typeof window !== 'undefined' ? window : globalThis);
