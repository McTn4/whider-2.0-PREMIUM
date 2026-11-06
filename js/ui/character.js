/**
 * WHIDER · Tu personaje
 *
 * Un compañero propio, dibujado en SVG en blanco y negro como el resto de la app:
 *  - Se personaliza: cuerpo, tono, ojos, boca, mejillas, cabeza (pelo, gorros…) y accesorios.
 *    Muchos objetos se desbloquean subiendo de nivel o con logros; algunos son de Premium.
 *  - Tiene estados de ánimo según tu día: contento, orgulloso (todo hecho), concentrado
 *    (enfoque en marcha), preocupado (muchas vencidas), dormido (de noche) y de fiesta.
 *  - Al tocarlo reacciona y te dice algo útil (con una acción a mano cuando tiene sentido).
 *  - Aparece en Hoy, en tu perfil, en el enfoque, en las pantallas vacías y en las celebraciones.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var uidN = 0, lineIndex = 0, partyUntil = 0;

  /* ---------- Catálogo ---------- */
  var DEFAULT = { name: 'Whi', body: 'gota', tone: 'blanco', eyes: 'puntos', mouth: 'sonrisa', cheeks: true, head: 'antena', acc: 'nada' };
  var CATALOG = {
    body: [
      { id: 'gota', name: 'Gota' }, { id: 'cubo', name: 'Cubo' }, { id: 'capsula', name: 'Cápsula' },
      { id: 'nube', name: 'Nube', level: 4 }, { id: 'gema', name: 'Gema', premium: true }
    ],
    tone: [
      { id: 'blanco', name: 'Blanco' }, { id: 'perla', name: 'Perla' }, { id: 'grafito', name: 'Grafito', level: 2 },
      { id: 'negro', name: 'Noche', level: 3 }, { id: 'cromo', name: 'Cromo', premium: true }
    ],
    eyes: [
      { id: 'puntos', name: 'Puntos' }, { id: 'grandes', name: 'Grandes' }, { id: 'felices', name: 'Felices', level: 2 },
      { id: 'estrellas', name: 'Estrellas', ach: 'streak7' }, { id: 'corazones', name: 'Corazones', level: 8 }
    ],
    mouth: [
      { id: 'sonrisa', name: 'Sonrisa' }, { id: 'abierta', name: 'Alegre' }, { id: 'neutra', name: 'Seria' },
      { id: 'gato', name: 'Gatuna', level: 3 }, { id: 'o', name: 'Sorpresa', level: 5 }
    ],
    head: [
      { id: 'nada', name: 'Nada' }, { id: 'antena', name: 'Antena' }, { id: 'flequillo', name: 'Flequillo' },
      { id: 'gorro', name: 'Gorro', level: 2 }, { id: 'lazo', name: 'Lazo', level: 3 }, { id: 'brote', name: 'Brote', ach: 'habits-1' },
      { id: 'auriculares', name: 'Auriculares', ach: 'focus1' }, { id: 'cresta', name: 'Cresta', level: 6 },
      { id: 'birrete', name: 'Birrete', ach: 'hundred' }, { id: 'corona', name: 'Corona', level: 10 }, { id: 'halo', name: 'Halo', premium: true }
    ],
    acc: [
      { id: 'nada', name: 'Nada' }, { id: 'gafas', name: 'Gafas', level: 3 }, { id: 'bufanda', name: 'Bufanda', level: 5 },
      { id: 'pajarita', name: 'Pajarita', level: 7 }, { id: 'medalla', name: 'Medalla', ach: 'streak30' }, { id: 'capa', name: 'Capa', premium: true }
    ]
  };
  var MOODS = { happy: 'Contento', proud: 'Orgulloso', focus: 'Concentrado', worried: 'Preocupado', sleepy: 'Dormido', party: 'De fiesta' };

  var BODIES = {
    gota: { d: 'M60 24C83 24 95 46 95 70c0 22-15 34-35 34S25 92 25 70C25 46 37 24 60 24z', top: 24, ey: 63, ex: 12, my: 79, arm: [27, 76], feet: 103 },
    cubo: { d: 'M49 30h22c12 0 22 10 22 22v28c0 12-10 22-22 22H49c-12 0-22-10-22-22V52c0-12 10-22 22-22z', top: 30, ey: 62, ex: 13, my: 79, arm: [27, 76], feet: 101 },
    capsula: { d: 'M60 20c14 0 25 11 25 25v34c0 14-11 25-25 25S35 93 35 79V45c0-14 11-25 25-25z', top: 20, ey: 55, ex: 10.5, my: 71, arm: [35, 74], feet: 103 },
    nube: { d: 'M34 103c-8 0-12-6-12-14V76c0-8 5-14 12-16 1-10 10-17 20-15 4-6 11-8 17-5 8-4 18 1 20 10 7 3 11 9 11 16v13c0 8-4 14-12 14H34z', top: 34, ey: 67, ex: 13, my: 83, arm: [24, 80], feet: 102 },
    gema: { d: 'M60 25c3 0 5 1 7 2l20 11c4 2 6 6 6 10v30c0 4-2 8-6 10L67 99c-4 2-10 2-14 0L33 88c-4-2-6-6-6-10V48c0-4 2-8 6-10l20-11c2-1 4-2 7-2z', top: 25, ey: 62, ex: 12, my: 78, arm: [28, 74], feet: 100 }
  };
  var TONES = {
    blanco: { body: '#F2F2F2', shade: '#CFCFCF', ink: '#111111', line: 'rgba(255,255,255,0)', item: '#1E1E1E', gloss: .55 },
    perla: { body: '#BDBDBD', shade: '#9C9C9C', ink: '#0B0B0B', line: 'rgba(255,255,255,0)', item: '#F2F2F2', gloss: .4 },
    grafito: { body: '#3B3B3B', shade: '#2A2A2A', ink: '#F2F2F2', line: 'rgba(255,255,255,.3)', item: '#F2F2F2', gloss: .16 },
    negro: { body: '#0E0E0E', shade: '#050505', ink: '#F5F5F5', line: 'rgba(255,255,255,.62)', item: '#F2F2F2', gloss: .1 },
    cromo: { body: 'url(#G)', shade: '#7A7A7A', ink: '#0B0B0B', line: 'rgba(255,255,255,.25)', item: '#111111', gloss: .6 }
  };

  /* ---------- Requisitos y desbloqueos ---------- */
  function find(cat, id) { var list = CATALOG[cat] || []; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function achName(id) {
    var a = W.Game ? W.Game.achievements().filter(function (x) { return x.id === id; })[0] : null;
    return a ? a.title : 'un logro';
  }
  /** { ok, why } para un objeto del catálogo */
  function access(item) {
    if (!item) return { ok: false, why: '' };
    if (item.premium && !(W.Plan && W.Plan.isPremium())) return { ok: false, why: 'Premium', premium: true };
    if (item.level && W.Game && W.Game.get().level < item.level) return { ok: false, why: 'Nivel ' + item.level };
    if (item.ach && W.Game && !W.Game.achievements().some(function (a) { return a.id === item.ach && a.ok; })) return { ok: false, why: 'Logro «' + achName(item.ach) + '»' };
    return { ok: true, why: '' };
  }
  /** Configuración actual (lo bloqueado se sustituye por lo básico) */
  function config(raw) {
    var c = Object.assign({}, DEFAULT, raw || S().character || {});
    ['body', 'tone', 'eyes', 'mouth', 'head', 'acc'].forEach(function (k) { if (!access(find(k, c[k])).ok) c[k] = DEFAULT[k]; });
    return c;
  }

  /* ---------- Dibujo ---------- */
  function eyesSvg(kind, b, t, mood) {
    var L = 60 - b.ex, R = 60 + b.ex, y = b.ey, ink = t.ink, out = '';
    if (mood === 'sleepy') kind = 'cerrados';
    if (mood === 'party') kind = kind === 'corazones' ? 'corazones' : 'estrellas';
    if (mood === 'proud' && kind === 'puntos') kind = 'felices';
    if (mood === 'worried' && (kind === 'felices' || kind === 'cerrados')) kind = 'grandes';
    var each = function (x) {
      switch (kind) {
        case 'grandes': return '<circle cx="' + x + '" cy="' + y + '" r="6.6" fill="' + ink + '"/><circle cx="' + (x + 2.2) + '" cy="' + (y - 2.4) + '" r="2.1" fill="' + (ink === '#F5F5F5' || ink === '#F2F2F2' ? '#000' : '#FFF') + '"/>';
        case 'felices': return '<path d="M' + (x - 6) + ' ' + (y + 2) + 'Q' + x + ' ' + (y - 6) + ' ' + (x + 6) + ' ' + (y + 2) + '" fill="none" stroke="' + ink + '" stroke-width="3.2" stroke-linecap="round"/>';
        case 'cerrados': return '<path d="M' + (x - 6) + ' ' + y + 'Q' + x + ' ' + (y + 4.5) + ' ' + (x + 6) + ' ' + y + '" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
        case 'estrellas': return '<path d="M' + x + ' ' + (y - 7) + 'l2 4.6 5 .6-3.7 3.4 1 5-4.3-2.5-4.3 2.5 1-5-3.7-3.4 5-.6z" fill="' + ink + '"/>';
        case 'corazones': return '<path d="M' + x + ' ' + (y + 5.5) + 'c-6-4-7.5-7-7.5-9.3 0-2.4 1.9-4.2 4.1-4.2 1.5 0 2.7.8 3.4 2 .7-1.2 1.9-2 3.4-2 2.2 0 4.1 1.8 4.1 4.2 0 2.3-1.5 5.3-7.5 9.3z" fill="' + ink + '"/>';
        default: return '<circle cx="' + x + '" cy="' + y + '" r="4.3" fill="' + ink + '"/>';
      }
    };
    out = each(L) + each(R);
    if (mood === 'worried') out += '<path d="M' + (L - 6) + ' ' + (y - 10) + 'l9 -3M' + (R + 6) + ' ' + (y - 10) + 'l-9 -3" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
    if (mood === 'focus') out += '<path d="M' + (L - 7) + ' ' + (y - 4) + 'h13M' + (R - 6) + ' ' + (y - 4) + 'h13" stroke="' + t.body.replace('url(#G)', '#DDD') + '" stroke-width="5" stroke-linecap="round"/>';
    var blink = kind === 'puntos' || kind === 'grandes';
    return '<g class="ch-eyes' + (blink && mood !== 'sleepy' ? ' blink' : '') + '">' + out + '</g>';
  }
  function mouthSvg(kind, b, t, mood) {
    var y = b.my, ink = t.ink;
    if (mood === 'sleepy') kind = 'o-small';
    else if (mood === 'party' || mood === 'proud') kind = 'abierta';
    else if (mood === 'worried') kind = 'ondulada';
    else if (mood === 'focus') kind = 'neutra';
    switch (kind) {
      case 'abierta': return '<path d="M52 ' + (y - 1) + 'Q60 ' + (y + 11) + ' 68 ' + (y - 1) + 'Z" fill="' + ink + '" stroke="' + ink + '" stroke-width="2" stroke-linejoin="round"/>';
      case 'neutra': return '<path d="M54 ' + (y + 1) + 'h12" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
      case 'gato': return '<path d="M52 ' + y + 'q4 5 8 0q4 5 8 0" fill="none" stroke="' + ink + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
      case 'o': return '<ellipse cx="60" cy="' + (y + 1) + '" rx="3.8" ry="4.8" fill="' + ink + '"/>';
      case 'o-small': return '<ellipse cx="60" cy="' + (y + 1) + '" rx="2.4" ry="3" fill="' + ink + '"/>';
      case 'ondulada': return '<path d="M52 ' + (y + 2) + 'q2.7-3 5.3 0t5.4 0 5.3 0" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
      default: return '<path d="M52 ' + (y - 1) + 'Q60 ' + (y + 7) + ' 68 ' + (y - 1) + '" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
    }
  }
  function headSvg(kind, b, t) {
    var y = b.top, it = t.item, glow = 'filter="url(#F)"';
    switch (kind) {
      case 'antena': return '<path d="M60 ' + y + 'V' + (y - 12) + '" stroke="' + t.shade + '" stroke-width="3.4" stroke-linecap="round"/><circle cx="60" cy="' + (y - 16) + '" r="8" fill="#FFF" opacity=".16"/><circle cx="60" cy="' + (y - 16) + '" r="4.6" fill="#FFF"/>';
      case 'flequillo': return '<path d="M36 ' + (y + 15) + 'C38 ' + (y - 4) + ' 82 ' + (y - 4) + ' 84 ' + (y + 15) + 'C76 ' + (y + 9) + ' 70 ' + (y + 13) + ' 64 ' + (y + 7) + 'C59 ' + (y + 13) + ' 50 ' + (y + 10) + ' 44 ' + (y + 13) + 'C41 ' + (y + 11) + ' 38 ' + (y + 12) + ' 36 ' + (y + 15) + 'z" fill="' + it + '"/>';
      case 'gorro': return '<path d="M35 ' + (y + 11) + 'C35 ' + (y - 13) + ' 85 ' + (y - 13) + ' 85 ' + (y + 11) + 'z" fill="' + it + '"/><rect x="33" y="' + (y + 5) + '" width="54" height="9" rx="4.5" fill="' + it + '" stroke="' + (it === '#1E1E1E' || it === '#111111' ? '#3A3A3A' : '#BDBDBD') + '" stroke-width="1.5"/><circle cx="60" cy="' + (y - 11) + '" r="5.5" fill="' + it + '"/>';
      case 'lazo': return '<g transform="translate(76 ' + (y + 6) + ') rotate(18)"><path d="M0 0-11-6v12zM0 0l11-6v12z" fill="' + it + '" stroke-linejoin="round" stroke="' + it + '" stroke-width="2"/><circle r="3.2" fill="' + it + '"/></g>';
      case 'brote': return '<path d="M60 ' + y + 'q-1-7 1-12" fill="none" stroke="' + (t.ink === '#111111' || t.ink === '#0B0B0B' ? '#5C5C5C' : '#BDBDBD') + '" stroke-width="2.8" stroke-linecap="round"/><path d="M61 ' + (y - 10) + 'c5-8 14-8 17-4-4 7-12 8-17 4zM59 ' + (y - 8) + 'c-4-6-11-6-13-3 3 5 9 6 13 3z" fill="#E6E6E6"/>';
      case 'auriculares': return '<path d="M' + (60 - b.ex - 19) + ' ' + (b.ey + 2) + 'C' + (60 - b.ex - 19) + ' ' + (y - 16) + ' ' + (60 + b.ex + 19) + ' ' + (y - 16) + ' ' + (60 + b.ex + 19) + ' ' + (b.ey + 2) + '" fill="none" stroke="' + it + '" stroke-width="4.5" stroke-linecap="round"/><rect x="' + (60 - b.ex - 25) + '" y="' + (b.ey - 7) + '" width="10" height="17" rx="4.5" fill="' + it + '"/><rect x="' + (60 + b.ex + 15) + '" y="' + (b.ey - 7) + '" width="10" height="17" rx="4.5" fill="' + it + '"/>';
      case 'cresta': return '<path d="M43 ' + (y + 7) + 'L46 ' + (y - 8) + 'L53 ' + (y + 1) + 'L60 ' + (y - 13) + 'L67 ' + (y + 1) + 'L74 ' + (y - 8) + 'L77 ' + (y + 7) + 'z" fill="' + it + '" stroke="' + it + '" stroke-width="2" stroke-linejoin="round"/>';
      case 'birrete': return '<path d="M44 ' + (y - 2) + 'v7c0 4 32 4 32 0v-7" fill="' + it + '"/><path d="M60 ' + (y - 15) + 'L90 ' + (y - 6) + 'L60 ' + (y + 3) + 'L30 ' + (y - 6) + 'z" fill="' + it + '" stroke="' + it + '" stroke-width="2" stroke-linejoin="round"/><path d="M60 ' + (y - 6) + 'L86 ' + (y - 5) + 'V' + (y + 9) + '" fill="none" stroke="#FFF" stroke-width="1.6"/><circle cx="86" cy="' + (y + 11) + '" r="2.4" fill="#FFF"/>';
      case 'corona': return '<path d="M40 ' + (y + 4) + 'L41 ' + (y - 12) + 'L50.5 ' + (y - 3) + 'L60 ' + (y - 17) + 'L69.5 ' + (y - 3) + 'L79 ' + (y - 12) + 'L80 ' + (y + 4) + 'z" fill="#FFF" stroke="#9A9A9A" stroke-width="1.2" stroke-linejoin="round" ' + glow + '/><circle cx="60" cy="' + (y - 4) + '" r="2.4" fill="#1E1E1E"/>';
      case 'halo': return '<ellipse cx="60" cy="' + (y - 11) + '" rx="19" ry="5.5" fill="none" stroke="#FFF" stroke-width="3.2" ' + glow + '/>';
      default: return '';
    }
  }
  function accSvg(kind, b, t, behind) {
    var y = b.my, it = t.item;
    if (behind) return kind === 'capa' ? '<path d="M34 ' + (b.top + 30) + 'C24 70 21 94 25 106Q42 101 60 107Q78 101 95 106C99 94 96 70 86 ' + (b.top + 30) + 'Z" fill="#1A1A1A" stroke="#FFF" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round"/>' : '';
    switch (kind) {
      case 'gafas': return '<g fill="rgba(255,255,255,.1)" stroke="' + t.ink + '" stroke-width="2.4"><circle cx="' + (60 - b.ex) + '" cy="' + b.ey + '" r="8.6"/><circle cx="' + (60 + b.ex) + '" cy="' + b.ey + '" r="8.6"/></g><path d="M' + (60 - b.ex + 8.6) + ' ' + b.ey + 'Q60 ' + (b.ey - 3) + ' ' + (60 + b.ex - 8.6) + ' ' + b.ey + '" fill="none" stroke="' + t.ink + '" stroke-width="2.4"/>';
      case 'bufanda': return '<path d="M33 ' + (y + 11) + 'C50 ' + (y + 19) + ' 70 ' + (y + 19) + ' 87 ' + (y + 11) + '" fill="none" stroke="' + it + '" stroke-width="8" stroke-linecap="round"/><path d="M71 ' + (y + 14) + 'l4 16" stroke="' + it + '" stroke-width="7" stroke-linecap="round"/>';
      case 'pajarita': var py = y + 16; return '<path d="M60 ' + py + 'L49 ' + (py - 6) + 'V' + (py + 6) + 'zM60 ' + py + 'L71 ' + (py - 6) + 'V' + (py + 6) + 'z" fill="' + it + '" stroke="' + it + '" stroke-width="2.2" stroke-linejoin="round"/><circle cx="60" cy="' + py + '" r="3" fill="' + it + '"/>';
      case 'medalla': return '<path d="M53 ' + (y + 10) + 'L60 ' + (y + 21) + 'L67 ' + (y + 10) + '" fill="none" stroke="' + it + '" stroke-width="3.2" stroke-linejoin="round"/><circle cx="60" cy="' + (y + 25) + '" r="6.4" fill="#FFF" stroke="#8A8A8A" stroke-width="1.2" filter="url(#F)"/><path d="M60 ' + (y + 21.5) + 'l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z" fill="#1E1E1E"/>';
      default: return '';
    }
  }
  function armsSvg(b, t, pose) {
    var x = b.arm[0], y = b.arm[1], X = 120 - x;
    var left = pose === 'up' ? 'M' + x + ' ' + y + 'q-10-4-12-17' : 'M' + x + ' ' + y + 'q-8 6-9 15';
    var right = pose === 'up' || pose === 'wave' ? 'M' + X + ' ' + y + 'q10-4 12-17' : 'M' + X + ' ' + y + 'q8 6 9 15';
    var line = t.line !== 'rgba(255,255,255,0)' ? '<path d="' + left + '" stroke="' + t.line + '" stroke-width="10" stroke-linecap="round" fill="none"/><path d="' + right + '" stroke="' + t.line + '" stroke-width="10" stroke-linecap="round" fill="none"/>' : '';
    var fill = t.body === 'url(#G)' ? '#CFCFCF' : t.body;
    return '<g class="ch-arms' + (pose === 'wave' ? ' waving' : '') + '">' + line + '<path d="' + left + '" stroke="' + fill + '" stroke-width="7.4" stroke-linecap="round" fill="none"/><path class="ch-arm-r" d="' + right + '" stroke="' + fill + '" stroke-width="7.4" stroke-linecap="round" fill="none"/></g>';
  }

  /**
   * SVG del personaje. o = { size, mood, pose, cfg (opcional), prop: 'coffee'|'party'|'sprout'|'note'|'search'|'zzz' }
   */
  function svg(o) {
    o = o || {};
    var c = o.cfg ? Object.assign({}, DEFAULT, o.cfg) : config();
    var b = BODIES[c.body] || BODIES.gota, t = TONES[c.tone] || TONES.blanco, mood = o.mood || 'happy';
    var pose = o.pose || (mood === 'party' || mood === 'proud' ? 'up' : 'down');
    var id = 'ch' + (++uidN);
    var defs = '<defs><linearGradient id="' + id + 'G" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#BDBDBD"/><stop offset="1" stop-color="#7A7A7A"/></linearGradient>' +
      '<filter id="' + id + 'F" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    var fill = t.body === 'url(#G)' ? 'url(#' + id + 'G)' : t.body;
    var parts = [
      defs,
      '<ellipse class="ch-shadow" cx="60" cy="110" rx="27" ry="4.2" fill="#000" opacity=".55"/>',
      accSvg(c.acc, b, t, true),
      '<g class="ch-body-g">',
      armsSvg(b, t, pose),
      '<ellipse cx="' + (60 - 12) + '" cy="' + b.feet + '" rx="8" ry="4.6" fill="' + (t.body === 'url(#G)' ? '#9C9C9C' : t.shade) + '"/><ellipse cx="' + (60 + 12) + '" cy="' + b.feet + '" rx="8" ry="4.6" fill="' + (t.body === 'url(#G)' ? '#9C9C9C' : t.shade) + '"/>',
      '<path d="' + b.d + '" fill="' + fill + '" stroke="' + t.line + '" stroke-width="1.6"/>',
      '<ellipse cx="' + (60 - 13) + '" cy="' + (b.top + 14) + '" rx="9" ry="5.5" transform="rotate(-24 ' + (60 - 13) + ' ' + (b.top + 14) + ')" fill="#FFF" opacity="' + t.gloss + '"/>',
      c.cheeks ? '<ellipse cx="' + (60 - b.ex - 6) + '" cy="' + (b.ey + 10) + '" rx="5" ry="3" fill="' + (t.ink === '#111111' || t.ink === '#0B0B0B' ? '#000' : '#FFF') + '" opacity=".14"/><ellipse cx="' + (60 + b.ex + 6) + '" cy="' + (b.ey + 10) + '" rx="5" ry="3" fill="' + (t.ink === '#111111' || t.ink === '#0B0B0B' ? '#000' : '#FFF') + '" opacity=".14"/>' : '',
      eyesSvg(c.eyes, b, t, mood),
      mouthSvg(c.mouth, b, t, mood),
      accSvg(c.acc, b, t, false),
      headSvg(c.head, b, t),
      mood === 'worried' ? '<path d="M' + (60 + b.ex + 14) + ' ' + (b.ey - 12) + 'c-3 4-3 7 0 8 3-1 3-4 0-8z" fill="#DADADA"/>' : '',
      '</g>',
      mood === 'sleepy' ? '<g class="ch-zzz" fill="#BDBDBD" font-family="var(--font)" font-weight="700"><text x="86" y="' + (b.top + 4) + '" font-size="11">z</text><text x="94" y="' + (b.top - 7) + '" font-size="14">z</text><text x="103" y="' + (b.top - 20) + '" font-size="17">Z</text></g>' : '',
      mood === 'focus' ? '<g class="ch-dots" fill="#BDBDBD"><circle cx="90" cy="' + (b.top - 4) + '" r="2.4"/><circle cx="98" cy="' + (b.top - 10) + '" r="3"/><circle cx="107" cy="' + (b.top - 18) + '" r="3.6"/></g>' : '',
      mood === 'party' ? confettiSvg() : '',
      o.prop ? propSvg(o.prop) : ''
    ];
    var html = '<svg class="ch-svg mood-' + mood + '" viewBox="0 0 120 120" width="' + (o.size || 96) + '" height="' + (o.size || 96) + '" aria-hidden="true">' + parts.join('') + '</svg>';
    html = html.replace(/url\(#F\)/g, 'url(#' + id + 'F)');
    return U.el('span.ch-wrap', { html: html }).firstChild;
  }
  function confettiSvg() {
    var bits = [[16, 22, 0], [102, 18, 1], [10, 58, 2], [110, 52, 0], [26, 8, 1], [94, 36, 2], [20, 92, 1], [104, 88, 2]];
    return '<g class="ch-confetti">' + bits.map(function (p, i) {
      return p[2] === 0 ? '<rect x="' + p[0] + '" y="' + p[1] + '" width="5" height="3" rx="1" fill="#FFF" style="--i:' + i + '"/>'
        : p[2] === 1 ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.2" fill="#BDBDBD" style="--i:' + i + '"/>'
          : '<path d="M' + p[0] + ' ' + p[1] + 'l2 4 4 .5-3 2.6 1 4-4-2.2-4 2.2 1-4-3-2.6 4-.5z" fill="#FFF" style="--i:' + i + '"/>';
    }).join('') + '</g>';
  }
  /** Pequeños objetos para las ilustraciones de las pantallas vacías */
  function propSvg(p) {
    switch (p) {
      case 'coffee': return '<g transform="translate(88 78)"><path d="M0 0h16v9a7 7 0 0 1-7 7H7a7 7 0 0 1-7-7z" fill="#F2F2F2"/><path d="M16 3h3a3.5 3.5 0 0 1 0 7h-3" fill="none" stroke="#F2F2F2" stroke-width="2.4"/><path d="M5-4q-2-4 1-8M11-4q-2-4 1-8" fill="none" stroke="#8A8A8A" stroke-width="1.8" stroke-linecap="round"/></g>';
      case 'sprout': return '<g transform="translate(92 86)"><path d="M0 16V2" stroke="#BDBDBD" stroke-width="2.4" stroke-linecap="round"/><path d="M0 4c4-7 12-7 14-3-4 6-10 7-14 3zM0 8c-4-6-11-6-13-3 3 5 9 6 13 3z" fill="#F2F2F2"/><rect x="-8" y="14" width="16" height="10" rx="2.5" fill="#3A3A3A"/></g>';
      case 'note': return '<g transform="translate(86 74) rotate(8)"><rect width="22" height="28" rx="3" fill="#F2F2F2"/><path d="M5 8h12M5 13h12M5 18h8" stroke="#8A8A8A" stroke-width="1.8" stroke-linecap="round"/></g>';
      case 'search': return '<g transform="translate(86 76)"><circle cx="8" cy="8" r="7" fill="rgba(255,255,255,.12)" stroke="#F2F2F2" stroke-width="3"/><path d="M13.5 13.5l7 7" stroke="#F2F2F2" stroke-width="3.4" stroke-linecap="round"/></g>';
      case 'friends': return '<g transform="translate(86 70)" fill="#8A8A8A"><circle cx="10" cy="8" r="7"/><path d="M-2 30c0-8 5-13 12-13s12 5 12 13z"/></g>';
      case 'trophy': return '<g transform="translate(88 74)"><path d="M3 0h16v8a8 8 0 0 1-16 0z" fill="#FFF"/><path d="M11 16v6M6 25h10" stroke="#FFF" stroke-width="3" stroke-linecap="round"/></g>';
      default: return '';
    }
  }

  /* ---------- Estado de ánimo y frases ---------- */
  function mood() {
    var st = S(), h = new Date().getHours();
    if (Date.now() < partyUntil) return 'party';
    var f = W.Screens.focus && W.Screens.focus.status ? W.Screens.focus.status() : null;
    if (f && f.running && f.mode === 'work') return 'focus';
    var s = st.stats();
    if (s.todayTotal && s.todayDone === s.todayTotal) return 'proud';
    if (st.overdueAll().length >= 3) return 'worried';
    if (h >= 23 || h < 6) return 'sleepy';
    return 'happy';
  }

  /** Frases útiles según el momento: [{ text, action: { label, run } }] */
  function lines() {
    var st = S(), s = st.stats(), out = [], td = U.today(), g = W.Game ? W.Game.get() : null, name = st.displayName().split(' ')[0];
    var overdue = st.overdueAll(), left = s.todayTotal - s.todayDone, h = new Date().getHours();
    var f = W.Screens.focus.status();
    if (f.running) out.push({ text: f.mode === 'work' ? 'Estoy concentrado contigo. Quedan ' + f.text + '.' : 'Pausa: respira y estírate. Quedan ' + f.text + '.' });
    if (overdue.length) out.push({ text: overdue.length === 1 ? 'Tienes una tarea vencida. ¿La pasamos a hoy?' : 'Tienes ' + overdue.length + ' tareas vencidas. ¿Las pasamos a hoy?',
      action: { label: 'Pasar a hoy', run: function () {
        var ids = overdue.map(function (t) { return t.id; });
        st.bulkUpdate(ids, function (t) { return { date: td, time: t.date === td ? t.time : null }; });
        W.Toast.show({ text: U.plural(ids.length, 'tarea pasa', 'tareas pasan') + ' a hoy', icon: 'sun' });
      } } });
    if (s.todayTotal && !left) out.push({ text: '¡Todo hecho por hoy' + (name ? ', ' + name : '') + '! Me encanta este ritmo.' });
    else if (left > 0) out.push({ text: left === 1 ? 'Te queda una tarea para hoy. ¡Vamos!' : 'Te quedan ' + left + ' tareas para hoy. Una a una.',
      action: f.running ? null : { label: 'Enfoque de ' + st.settings.focus.work + ' min', run: function () { W.Screens.focus.toggle(); W.Router.refresh(); } } });
    if (W.Habits) {
      var hp = W.Habits.list().filter(W.Habits.pendingToday);
      if (hp.length) out.push({ text: 'Aún te falta un hábito: «' + hp[0].name + '».', action: { label: hp[0].target > 1 ? 'Sumar uno' : 'Hecho', run: function () { W.Habits.tap(hp[0], td); } } });
    }
    if (s.streak >= 2) out.push({ text: 'Llevas ' + s.streak + ' días de racha. No la rompas.' });
    if (g) out.push({ text: 'Te faltan ' + Math.max(1, g.to - g.xp) + ' XP para el nivel ' + (g.level + 1) + '.', action: { label: 'Ver logros', run: function () { S().ui.profileTab = 'achievements'; W.Router.go('progress'); } } });
    if (!s.todayTotal && !overdue.length) out.push({ text: h < 13 ? '¿Qué quieres conseguir hoy?' : '¿Algo más para hoy?', action: { label: 'Nueva tarea', run: function () { W.QuickAdd.open({ date: td }); } } });
    if (h >= 22 || h < 6) out.push({ text: 'Es tarde. Mañana seguimos con energía.' });
    out.push({ text: 'Tócame cuando quieras: te cuento cómo vas.' });
    return out;
  }

  /* ---------- Componentes ---------- */
  /** Personaje interactivo: { size, bubble: true, mood } */
  function node(o) {
    o = o || {};
    var m = o.mood || mood();
    var wrap = U.el('div.buddy' + (o.cls ? '.' + o.cls : ''), { attrs: { role: 'button', tabindex: '0', 'aria-label': (config().name || 'Tu personaje') + ', ' + MOODS[m].toLowerCase() + '. Toca para hablar.' } }, [svg({ size: o.size || 72, mood: m })]);
    var bubble = null;
    var speak = function () {
      var all = lines(), l = all[lineIndex++ % all.length];
      if (!bubble) { bubble = U.el('div.buddy-bubble'); wrap.parentNode && wrap.parentNode.appendChild(bubble); }
      U.clear(bubble);
      bubble.appendChild(U.el('span', { text: l.text }));
      if (l.action) bubble.appendChild(U.el('button.btn.xs.soft', { text: l.action.label, on: { click: function (e) { e.stopPropagation(); l.action.run(); } } }));
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    };
    var react = function () {
      wrap.classList.remove('jump'); void wrap.offsetWidth; wrap.classList.add('jump');
      W.Audio.boop(); W.Audio.vibrate([10]);
      if (o.bubble !== false) speak();
    };
    wrap.addEventListener('click', function (e) { e.stopPropagation(); react(); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); react(); } });
    wrap._speak = speak;
    return wrap;
  }

  /** Bloque de Hoy: el personaje con una frase (móvil: tira; ordenador: tarjeta del lateral) */
  function companion(desk) {
    var c = config(), m = mood(), g = W.Game.get();
    var bubble = U.el('div.buddy-bubble.static');
    var b = node({ size: desk ? 104 : 64, mood: m, bubble: false });
    var all = lines(), first = all[0];
    var fill = function (l) {
      U.clear(bubble);
      bubble.appendChild(U.el('span', { text: l.text }));
      if (l.action) bubble.appendChild(U.el('button.btn.xs.soft', { text: l.action.label, on: { click: function (e) { e.stopPropagation(); l.action.run(); } } }));
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    };
    fill(first);
    lineIndex = 1;
    b.addEventListener('click', function () { var l = lines(); fill(l[lineIndex++ % l.length]); });
    var meta = U.el('div.buddy-meta', [U.el('strong', { text: c.name || 'Tu personaje' }),
      U.el('span', { text: 'Nivel ' + g.level + ' · ' + W.Game.title(g.level) }),
      U.el('div.bar', [U.el('i', { style: { width: Math.round(g.progress * 100) + '%' } })])]);
    var edit = U.el('button.circle-btn.buddy-edit', { attrs: { 'aria-label': 'Personalizar tu personaje', title: 'Personalizar' }, on: { click: function (e) { e.stopPropagation(); Character.edit(); } } }, [U.icon('palette')]);
    if (desk) return U.el('div.group.card.side-card.buddy-card', [U.el('div.buddy-row', [b, meta, edit]), bubble]);
    return U.el('div.buddy-strip', [b, U.el('div.buddy-say', [bubble]), edit]);
  }

  /** Ilustración para pantallas vacías: personaje con un objeto */
  function illustration(prop, mood0, size) {
    return U.el('span.buddy-illus', [svg({ size: size || 96, mood: mood0 || 'happy', prop: prop })]);
  }

  /* ---------- Celebraciones ---------- */
  var currentCel = null;
  function celebrate(o) {
    o = o || {};
    if (currentCel) currentCel.close();
    partyUntil = Date.now() + 6000;
    var layer = U.el('div.celebrate', { attrs: { role: 'dialog', 'aria-label': o.title || 'Celebración' } });
    var pieces = U.el('div.cel-confetti');
    for (var i = 0; i < 36; i++) pieces.appendChild(U.el('i', { style: { left: Math.round(Math.random() * 100) + '%', '--d': (Math.random() * 1.2).toFixed(2) + 's', '--x': Math.round(Math.random() * 120 - 60) + 'px', '--r': Math.round(Math.random() * 720) + 'deg' } }));
    var card = U.el('div.cel-card', [
      U.el('div.cel-buddy', [svg({ size: 150, mood: 'party' })]),
      o.kicker ? U.el('div.cel-kicker', { text: o.kicker }) : null,
      U.el('h2', { text: o.title || '¡Bien hecho!' }),
      o.text ? U.el('p', { text: o.text }) : null,
      o.items && o.items.length ? U.el('div.cel-items', o.items.map(function (it) {
        return U.el('div.cel-item', [U.el('span.cel-mini', [svg({ size: 46, cfg: it.cfg, mood: 'happy' })]), U.el('span', [U.el('b', { text: it.name }), U.el('small', { text: it.kind })])]);
      })) : null,
      U.el('div.cel-actions', [
        o.items && o.items.length ? U.el('button.btn.ghost', { text: 'Probármelo', on: { click: function () { close(); setTimeout(function () { Character.edit(o.items[0].cat); }, 250); } } }) : null,
        U.el('button.btn.primary', { text: 'Seguir', on: { click: function () { close(); } } })
      ])
    ]);
    layer.appendChild(pieces);
    layer.appendChild(card);
    var close = function () {
      if (currentCel && currentCel.layer === layer) currentCel = null;
      layer.classList.remove('open'); setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 300); W.Router.refresh();
    };
    currentCel = { layer: layer, close: close };
    layer.addEventListener('click', function (e) { if (e.target === layer) close(); });
    document.body.appendChild(layer);
    requestAnimationFrame(function () { layer.classList.add('open'); });
    if (o.sound !== false) (o.level ? W.Audio.levelUp : W.Audio.achievement)();
    W.Audio.vibrate([20, 40, 20]);
    if (o.auto) setTimeout(close, o.auto);
    return { close: close };
  }

  /** Objetos que se desbloquean justo en un nivel */
  function unlocksAt(level) {
    var out = [];
    Object.keys(CATALOG).forEach(function (cat) {
      CATALOG[cat].forEach(function (it) {
        if (it.level === level) { var cfg = {}; cfg[cat] = it.id; out.push({ cat: cat, id: it.id, name: it.name, kind: KIND[cat], cfg: Object.assign({}, config(), cfg) }); }
      });
    });
    return out;
  }
  var KIND = { body: 'Cuerpo', tone: 'Tono', eyes: 'Ojos', mouth: 'Boca', head: 'Cabeza', acc: 'Accesorio' };
  var TABS = [{ value: 'body', label: 'Cuerpo' }, { value: 'face', label: 'Cara' }, { value: 'head', label: 'Cabeza' }, { value: 'acc', label: 'Accesorios' }];

  /* ---------- Editor ---------- */
  function edit(tab0) {
    var draft = Object.assign({}, config());
    var tab = tab0 === 'eyes' || tab0 === 'mouth' ? 'face' : tab0 === 'tone' ? 'body' : (tab0 && TABS.some(function (t) { return t.value === tab0; }) ? tab0 : 'body');
    var previewMood = 'happy';
    var stage = U.el('div.be-stage');
    var drawStage = function () { U.clear(stage); stage.appendChild(svg({ size: 168, mood: previewMood, cfg: draft })); };
    var moods = U.el('div.chips.be-moods', Object.keys(MOODS).map(function (k) {
      var c = U.el('button.chip' + (k === previewMood ? '.on' : ''), { attrs: { type: 'button' }, text: MOODS[k] });
      c.addEventListener('click', function () { previewMood = k; U.$$('.chip', moods).forEach(function (x) { x.classList.toggle('on', x === c); }); drawStage(); });
      return c;
    }));
    var name = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 16, placeholder: 'Nombre de tu personaje', 'aria-label': 'Nombre de tu personaje' } });
    name.value = draft.name || '';
    name.addEventListener('input', function () { draft.name = name.value.trim(); });
    var grid = U.el('div.be-grid');
    var option = function (cat, it) {
      var acc = access(it), cfg = Object.assign({}, draft); cfg[cat] = it.id;
      var on = draft[cat] === it.id;
      var b = U.el('button.be-opt' + (on ? '.on' : '') + (acc.ok ? '' : '.locked'), { attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false', title: acc.ok ? it.name : it.name + ' · ' + acc.why } }, [
        svg({ size: 58, cfg: cfg, mood: 'happy' }),
        U.el('span.be-name', { text: it.name }),
        acc.ok ? null : U.el('span.be-lock', [U.icon(acc.premium ? 'gem' : 'lock'), U.el('span', { text: acc.why })])
      ]);
      b.addEventListener('click', function () {
        if (!acc.ok) {
          if (acc.premium) W.Plan.paywall('items');
          else W.Toast.show({ text: it.name + ': se desbloquea con ' + acc.why.toLowerCase().replace('logro', 'el logro'), icon: 'lock' });
          return;
        }
        draft[cat] = it.id; W.Audio.select(); drawStage(); drawGrid();
      });
      return b;
    };
    var drawGrid = function () {
      U.clear(grid);
      var cats = tab === 'body' ? ['body', 'tone'] : tab === 'face' ? ['eyes', 'mouth'] : [tab];
      cats.forEach(function (cat) {
        grid.appendChild(U.el('div.be-h', { text: KIND[cat] }));
        grid.appendChild(U.el('div.be-row', CATALOG[cat].map(function (it) { return option(cat, it); })));
      });
      if (tab === 'face') grid.appendChild(W.UI.group([W.UI.cell({ title: 'Mejillas', right: W.UI.toggle(!!draft.cheeks, function (v) { draft.cheeks = v; drawStage(); drawGrid(); }, 'Mejillas') })]));
    };
    var tabs = W.UI.segmented(TABS, tab, function (v) { tab = v; drawGrid(); });
    var randomize = function () {
      Object.keys(CATALOG).forEach(function (cat) {
        var open = CATALOG[cat].filter(function (it) { return access(it).ok; });
        draft[cat] = open[Math.floor(Math.random() * open.length)].id;
      });
      draft.cheeks = Math.random() > .4;
      W.Audio.boop(); drawStage(); drawGrid();
    };
    var g = W.Game.get();
    var nextUnlock = null;
    for (var L = g.level + 1; L <= g.level + 12 && !nextUnlock; L++) { var u = unlocksAt(L); if (u.length) nextUnlock = { level: L, items: u }; }
    var s = W.Sheet.open({
      title: 'Tu personaje', className: 'editor buddy-editor', full: true,
      body: [
        U.el('div.be-top', [stage, moods]),
        U.el('div.group', [U.el('label.cell', [name])]),
        nextUnlock ? U.el('p.be-next', { text: 'En el nivel ' + nextUnlock.level + ' desbloqueas: ' + nextUnlock.items.map(function (x) { return x.name.toLowerCase(); }).join(', ') + '.' }) : null,
        tabs, grid
      ],
      foot: [
        U.el('button.btn.ghost', { on: { click: randomize } }, [U.icon('sparkle', 'sm'), 'Al azar']),
        U.el('button.btn.primary', { text: 'Guardar', on: { click: function () {
          var out = {}; ['name', 'body', 'tone', 'eyes', 'mouth', 'head', 'acc', 'cheeks'].forEach(function (k) { out[k] = draft[k]; });
          if (!out.name) out.name = DEFAULT.name;
          S().setCharacter(out); W.Audio.success(); s.close();
        } } })
      ]
    });
    drawStage(); drawGrid();
    return s;
  }

  var Character = {
    CATALOG: CATALOG,
    MOODS: MOODS,
    DEFAULT: DEFAULT,
    config: config,
    access: access,
    svg: svg,
    node: node,
    mood: mood,
    lines: lines,
    companion: companion,
    illustration: illustration,
    celebrate: celebrate,
    unlocksAt: unlocksAt,
    edit: edit,
    /** Subida de nivel: celebración con lo que se desbloquea */
    levelUp: function (level) {
      celebrate({ kicker: 'Subes de nivel', title: 'Nivel ' + level, text: 'Ahora eres ' + W.Game.title(level) + '.', items: unlocksAt(level), level: true });
    },
    party: function (ms) { partyUntil = Date.now() + (ms || 5000); },
    /** Cierra la celebración abierta (Esc o Atrás) */
    dismiss: function () { if (!currentCel) return false; currentCel.close(); return true; }
  };

  W.Character = Character;
})(window.Whider);
