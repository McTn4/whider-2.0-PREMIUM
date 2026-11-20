/**
 * WHIDER · Tu personaje
 *
 * Un compañero propio, dibujado en SVG en blanco y negro como el resto de la app:
 *  - Se personaliza: especie, acabado, ojos, boca, mejillas, cabeza (pelo, gorros…), accesorios,
 *    efectos, y el fondo y el marco de la foto de perfil. Todo está disponible para todos.
 *  - Tiene estados de ánimo según tu día: contento, orgulloso (todo hecho), concentrado
 *    (enfoque en marcha), preocupado (muchas vencidas), dormido (de noche) y de fiesta.
 *  - Al tocarlo reacciona y te dice algo útil (con una acción a mano cuando tiene sentido).
 *  - Es tu foto de perfil y aparece en Hoy, en el enfoque y en las pantallas vacías.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var uidN = 0, lineIndex = 0;

  /* ---------- Catálogo ---------- */
  var DEFAULT = { name: 'Whi', body: 'gota', tone: 'blanco', eyes: 'puntos', mouth: 'sonrisa', cheeks: true, head: 'antena', acc: 'nada', fx: 'nada', bg: 'liso', frame: 'nada' };
  var CATS = ['body', 'tone', 'eyes', 'mouth', 'head', 'acc', 'fx', 'bg', 'frame'];
  var CATALOG = {
    body: [
      { id: 'gota', name: W.t('Gota') }, { id: 'cubo', name: W.t('Cubo') }, { id: 'capsula', name: W.t('Cápsula') }, { id: 'gato', name: W.t('Gato') },
      { id: 'oso', name: W.t('Oso') }, { id: 'nube', name: W.t('Nube') }, { id: 'buho', name: W.t('Búho') }, { id: 'zorro', name: W.t('Zorro') },
      { id: 'fantasma', name: W.t('Fantasma') }, { id: 'robot', name: W.t('Robot') }
    ],
    tone: [
      { id: 'blanco', name: W.t('Blanco') }, { id: 'perla', name: W.t('Perla') }, { id: 'grafito', name: W.t('Grafito') },
      { id: 'negro', name: W.t('Noche') }, { id: 'cromo', name: W.t('Cromo') }, { id: 'platino', name: W.t('Platino') },
      { id: 'obsidiana', name: W.t('Obsidiana') }, { id: 'holo', name: W.t('Holográfico') },
      { id: 'cristal', name: W.t('Cristal') }, { id: 'marmol', name: W.t('Mármol') }
    ],
    eyes: [
      { id: 'puntos', name: W.t('Puntos') }, { id: 'grandes', name: W.t('Grandes') }, { id: 'felices', name: W.t('Felices') },
      { id: 'estrellas', name: W.t('Estrellas') }, { id: 'corazones', name: W.t('Corazones') }
    ],
    mouth: [
      { id: 'sonrisa', name: W.t('Sonrisa') }, { id: 'abierta', name: W.t('Alegre') }, { id: 'neutra', name: W.t('Seria') },
      { id: 'gato', name: W.t('Gatuna') }, { id: 'o', name: W.t('Sorpresa') }
    ],
    head: [
      { id: 'nada', name: W.t('Nada') }, { id: 'antena', name: W.t('Antena') }, { id: 'flequillo', name: W.t('Flequillo') },
      { id: 'gorro', name: W.t('Gorro') }, { id: 'lazo', name: W.t('Lazo') }, { id: 'brote', name: W.t('Brote') },
      { id: 'auriculares', name: W.t('Auriculares') }, { id: 'cresta', name: W.t('Cresta') },
      { id: 'birrete', name: W.t('Birrete') }, { id: 'corona', name: W.t('Corona') }, { id: 'halo', name: W.t('Halo') }
    ],
    acc: [
      { id: 'nada', name: W.t('Nada') }, { id: 'gafas', name: W.t('Gafas') }, { id: 'bufanda', name: W.t('Bufanda') },
      { id: 'pajarita', name: W.t('Pajarita') }, { id: 'medalla', name: W.t('Medalla') }, { id: 'capa', name: W.t('Capa') },
      { id: 'solares', name: W.t('Gafas de sol') }, { id: 'collar', name: W.t('Collar de perlas') }
    ],
    fx: [
      { id: 'nada', name: W.t('Ninguno') }, { id: 'brillo', name: W.t('Destellos') }, { id: 'aura', name: W.t('Aura') },
      { id: 'orbita', name: W.t('Órbita') }, { id: 'estela', name: W.t('Polvo de estrellas') }, { id: 'rayos', name: W.t('Rayos de luz') }
    ],
    bg: [
      { id: 'liso', name: W.t('Liso') }, { id: 'puntos', name: W.t('Puntos') }, { id: 'degradado', name: W.t('Degradado') }, { id: 'rayas', name: W.t('Rayas') },
      { id: 'estrellas', name: W.t('Estrellas') }, { id: 'holo', name: W.t('Holográfico') }
    ],
    frame: [
      { id: 'nada', name: W.t('Sin marco') }, { id: 'aro', name: W.t('Aro') }, { id: 'doble', name: W.t('Doble aro') }, { id: 'laurel', name: W.t('Laurel') },
      { id: 'diamante', name: W.t('Diamante') }, { id: 'animado', name: W.t('Aro de luz') }, { id: 'corona', name: W.t('Con corona') }
    ]
  };
  var MOODS = { happy: W.t('Contento'), proud: W.t('Orgulloso'), focus: W.t('Concentrado'), worried: W.t('Preocupado'), sleepy: W.t('Dormido'), party: W.t('De fiesta') };

  var BODIES = {
    gota: { d: 'M60 24C83 24 95 46 95 70c0 22-15 34-35 34S25 92 25 70C25 46 37 24 60 24z', top: 24, ey: 63, ex: 12, my: 79, arm: [27, 76], feet: 103 },
    cubo: { d: 'M49 30h22c12 0 22 10 22 22v28c0 12-10 22-22 22H49c-12 0-22-10-22-22V52c0-12 10-22 22-22z', top: 30, ey: 62, ex: 13, my: 79, arm: [27, 76], feet: 101 },
    capsula: { d: 'M60 20c14 0 25 11 25 25v34c0 14-11 25-25 25S35 93 35 79V45c0-14 11-25 25-25z', top: 20, ey: 55, ex: 10.5, my: 71, arm: [35, 74], feet: 103 },
    nube: { d: 'M34 103c-8 0-12-6-12-14V76c0-8 5-14 12-16 1-10 10-17 20-15 4-6 11-8 17-5 8-4 18 1 20 10 7 3 11 9 11 16v13c0 8-4 14-12 14H34z', top: 34, ey: 67, ex: 13, my: 83, arm: [24, 80], feet: 102 },
    gato: { d: 'M60 30C82 30 94 48 94 70c0 21-15 34-34 34S26 91 26 70c0-22 12-40 34-40z', top: 30, ey: 64, ex: 12.5, my: 81, arm: [27, 78], feet: 103,
      back: function (b, t, f) { return '<path d="M31 50 34.5 20 54 34z M89 50 85.5 20 66 34z" fill="' + f + '" stroke="' + t.line + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M37 41 38.6 28 47.5 35z M83 41 81.4 28 72.5 35z" fill="' + t.shade + '"/><path d="M88 97c14 2 20-9 15-21" fill="none" stroke="' + f + '" stroke-width="7" stroke-linecap="round"/>'; },
      front: function (b, t) { return '<path d="M57.4 75.5h5.2L60 78.5z" fill="' + t.ink + '"/><g stroke="' + t.ink + '" stroke-width="1.3" stroke-linecap="round" opacity=".45"><path d="M36 77 23 74M36 81 22 82M37 85 25 89M84 77l13-3M84 81l14 1M83 85l12 4"/></g>'; } },
    oso: { d: 'M60 28c21 0 34 17 34 40 0 23-14 36-34 36S26 91 26 68c0-23 13-40 34-40z', top: 28, ey: 61, ex: 12, my: 83, arm: [27, 77], feet: 103,
      back: function (b, t, f) { return '<circle cx="36" cy="34" r="10.5" fill="' + f + '" stroke="' + t.line + '" stroke-width="1.6"/><circle cx="84" cy="34" r="10.5" fill="' + f + '" stroke="' + t.line + '" stroke-width="1.6"/><circle cx="36" cy="34" r="5" fill="' + t.shade + '"/><circle cx="84" cy="34" r="5" fill="' + t.shade + '"/>'; },
      front: function (b, t) { return '<ellipse cx="60" cy="80" rx="13.5" ry="10.5" fill="' + (light(t) ? '#FFFFFF' : 'rgba(255,255,255,.13)') + '" opacity="' + (light(t) ? '.6' : '1') + '"/><ellipse cx="60" cy="75.5" rx="4.4" ry="3.1" fill="' + t.ink + '"/>'; } },
    buho: { d: 'M60 26c20 0 32 18 32 42 0 22-13 36-32 36S28 90 28 68c0-24 12-42 32-42z', top: 26, ey: 58, ex: 13, my: 81, arm: [29, 74], feet: 103,
      back: function (b, t, f) { return '<path d="M37 42 32 17 49 31z M83 42 88 17 71 31z" fill="' + f + '" stroke="' + t.line + '" stroke-width="1.6" stroke-linejoin="round"/>'; },
      front: function (b, t) { var disc = light(t) ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.13)'; return '<circle cx="47" cy="58" r="11.5" fill="' + disc + '"/><circle cx="73" cy="58" r="11.5" fill="' + disc + '"/><path d="M48 90l4 3 4-3M56 95l4 3 4-3M64 90l4 3 4-3" fill="none" stroke="' + t.shade + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'; },
      over: function (b, t) { return '<path d="M56.6 66.5h6.8L60 72.5z" fill="' + t.item + '" stroke="' + t.item + '" stroke-width="1.5" stroke-linejoin="round"/>'; } },
    zorro: { d: 'M60 30C83 30 94 49 94 71c0 20-15 33-34 33S26 91 26 71c0-22 11-41 34-41z', top: 30, ey: 63, ex: 12, my: 82, arm: [27, 78], feet: 103,
      back: function (b, t, f) { return '<path d="M86 99c18 4 30-10 24-30-3-10-12-14-16-12 4 8 2 20-10 26z" fill="' + f + '" stroke="' + t.line + '" stroke-width="1.6"/><path d="M110 70c-3-8-10-11-14-10 3 4 4 9 3 13z" fill="#FFFFFF" opacity=".9"/><path d="M30 54 31 15 56 35z M90 54 89 15 64 35z" fill="' + f + '" stroke="' + t.line + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M35 43 36 25 48.5 35z M85 43 84 25 71.5 35z" fill="' + t.ink + '" opacity=".55"/>'; },
      front: function (b, t) { return '<path d="M35 74c6 11 15 17 25 17s19-6 25-17c-8 5-16 6-25 6s-17-1-25-6z" fill="' + (light(t) ? t.shade : 'rgba(255,255,255,.3)') + '"/><ellipse cx="60" cy="77" rx="3.4" ry="2.5" fill="' + t.ink + '"/>'; } },
    fantasma: { d: 'M60 26c19 0 32 15 32 36v38c0 3-3 4-5 2l-5-5-6 6c-1.5 1.5-3.5 1.5-5 0l-6-6-5 5c-1.5 1.5-3.5 1.5-5 0l-6-6-5 5c-2 2-5 1-5-2V62c0-21 13-36 32-36z', top: 26, ey: 58, ex: 11.5, my: 74, arm: [28, 70], feet: 0, nofeet: true, cls: 'float' },
    robot: { d: 'M42 30h36c9 0 16 7 16 16v40c0 10-8 18-18 18H44c-10 0-18-8-18-18V46c0-9 7-16 16-16z', top: 30, ey: 62, ex: 11, my: 79, arm: [26, 77], feet: 103, ink: '#F2F2F2',
      back: function (b, t) { return '<rect x="19" y="56" width="9" height="16" rx="3" fill="' + t.shade + '"/><rect x="92" y="56" width="9" height="16" rx="3" fill="' + t.shade + '"/>'; },
      front: function () { return '<rect x="35" y="49" width="50" height="38" rx="12" fill="#121212" stroke="rgba(255,255,255,.22)" stroke-width="1.4"/><rect x="51" y="92" width="18" height="5" rx="2.5" fill="#2A2A2A"/><circle cx="55" cy="94.5" r="1.2" fill="#FFF"/><circle cx="60" cy="94.5" r="1.2" fill="#9A9A9A"/><circle cx="65" cy="94.5" r="1.2" fill="#FFF"/>'; } }
  };
  function light(t) { return t.ink === '#111111' || t.ink === '#0B0B0B'; }
  var TONES = {
    blanco: { body: '#F2F2F2', shade: '#CFCFCF', ink: '#111111', line: 'rgba(255,255,255,0)', item: '#1E1E1E', gloss: .55 },
    perla: { body: '#BDBDBD', shade: '#9C9C9C', ink: '#0B0B0B', line: 'rgba(255,255,255,0)', item: '#F2F2F2', gloss: .4 },
    grafito: { body: '#3B3B3B', shade: '#2A2A2A', ink: '#F2F2F2', line: 'rgba(255,255,255,.3)', item: '#F2F2F2', gloss: .16 },
    negro: { body: '#0E0E0E', shade: '#050505', ink: '#F5F5F5', line: 'rgba(255,255,255,.62)', item: '#F2F2F2', gloss: .1 },
    cromo: { body: 'url(#G)', shade: '#7A7A7A', ink: '#0B0B0B', line: 'rgba(255,255,255,.25)', item: '#111111', gloss: .6 },
    platino: { body: 'url(#Pt)', shade: '#8C8C8C', ink: '#0B0B0B', line: 'rgba(255,255,255,.6)', item: '#111111', gloss: .75, solid: '#D9D9D9' },
    obsidiana: { body: 'url(#Ob)', shade: '#000000', ink: '#F5F5F5', line: 'rgba(255,255,255,.45)', item: '#F2F2F2', gloss: .3, solid: '#151515' },
    holo: { body: 'url(#Ho)', shade: '#8A8A8A', ink: '#0B0B0B', line: 'rgba(255,255,255,.7)', item: '#111111', gloss: .7, solid: '#CFCFCF' },
    cristal: { body: 'rgba(255,255,255,.14)', shade: 'rgba(255,255,255,.28)', ink: '#F5F5F5', line: 'rgba(255,255,255,.8)', item: '#F2F2F2', gloss: .85, solid: 'rgba(255,255,255,.35)' },
    marmol: { body: 'url(#Mb)', shade: '#A8A8A8', ink: '#111111', line: 'rgba(0,0,0,.1)', item: '#1E1E1E', gloss: .55, solid: '#E6E6E6' }
  };

  /* ---------- Catálogo: lo que existe ---------- */
  function find(cat, id) { var list = CATALOG[cat] || []; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  /** Configuración actual (lo que ya no existe en el catálogo vuelve a lo básico) */
  function config(raw) {
    var c = Object.assign({}, DEFAULT, raw || S().character || {});
    CATS.forEach(function (k) { if (!find(k, c[k])) c[k] = DEFAULT[k]; });
    return c;
  }

  /* ---------- Dibujo ---------- */
  function eyesSvg(kind, b, t, mood) {
    var L = 60 - b.ex, R = 60 + b.ex, y = b.ey, ink = t.ink, out;
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
      case 'solares': return '<g><rect x="' + (60 - b.ex - 9.5) + '" y="' + (b.ey - 6.5) + '" width="19" height="12.5" rx="5" fill="#0A0A0A" stroke="#E6E6E6" stroke-width="1.6"/><rect x="' + (60 + b.ex - 9.5) + '" y="' + (b.ey - 6.5) + '" width="19" height="12.5" rx="5" fill="#0A0A0A" stroke="#E6E6E6" stroke-width="1.6"/><path d="M' + (60 - b.ex + 9.5) + ' ' + (b.ey - 2) + 'h' + (2 * b.ex - 19) + '" stroke="#E6E6E6" stroke-width="2"/><path d="M' + (60 - b.ex - 6) + ' ' + (b.ey - 3) + 'l5 -2" stroke="#FFF" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>';
      case 'collar': var cy = y + 13; return '<path d="M42 ' + cy + 'Q60 ' + (cy + 12) + ' 78 ' + cy + '" fill="none" stroke="#BDBDBD" stroke-width="1"/>' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { var x = 44 + i * 5.3, yy = cy + Math.sin((i / 6) * Math.PI) * 6; return '<circle cx="' + x.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="2.6" fill="#FFF" stroke="#9A9A9A" stroke-width=".6"/>'; }).join('');
      case 'medalla': return '<path d="M53 ' + (y + 10) + 'L60 ' + (y + 21) + 'L67 ' + (y + 10) + '" fill="none" stroke="' + it + '" stroke-width="3.2" stroke-linejoin="round"/><circle cx="60" cy="' + (y + 25) + '" r="6.4" fill="#FFF" stroke="#8A8A8A" stroke-width="1.2" filter="url(#F)"/><path d="M60 ' + (y + 21.5) + 'l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z" fill="#1E1E1E"/>';
      default: return '';
    }
  }
  function armsSvg(b, t, pose) {
    var x = b.arm[0], y = b.arm[1], X = 120 - x;
    var left = pose === 'up' ? 'M' + x + ' ' + y + 'q-10-4-12-17' : 'M' + x + ' ' + y + 'q-8 6-9 15';
    var right = pose === 'up' || pose === 'wave' ? 'M' + X + ' ' + y + 'q10-4 12-17' : 'M' + X + ' ' + y + 'q8 6 9 15';
    var line = t.line !== 'rgba(255,255,255,0)' ? '<path d="' + left + '" stroke="' + t.line + '" stroke-width="10" stroke-linecap="round" fill="none"/><path d="' + right + '" stroke="' + t.line + '" stroke-width="10" stroke-linecap="round" fill="none"/>' : '';
    var fill = t.solid || (t.body === 'url(#G)' ? '#CFCFCF' : t.body);
    return '<g class="ch-arms' + (pose === 'wave' ? ' waving' : '') + '">' + line + '<path d="' + left + '" stroke="' + fill + '" stroke-width="7.4" stroke-linecap="round" fill="none"/><path class="ch-arm-r" d="' + right + '" stroke="' + fill + '" stroke-width="7.4" stroke-linecap="round" fill="none"/></g>';
  }

  /**
   * SVG del personaje. o = { size, mood, pose, cfg (opcional), prop: 'coffee'|'party'|'sprout'|'note'|'search'|'zzz' }
   */
  function svg(o) {
    o = o || {};
    var c = o.cfg ? Object.assign({}, DEFAULT, o.cfg) : config();
    var b = BODIES[c.body] || BODIES.gota, t0 = TONES[c.tone] || TONES.blanco, mood = o.mood || 'happy';
    var t = b.ink ? Object.assign({}, t0, { ink: b.ink }) : t0;
    var pose = o.pose || (mood === 'party' || mood === 'proud' ? 'up' : 'down');
    var id = 'ch' + (++uidN);
    var defs = '<defs><linearGradient id="G" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#BDBDBD"/><stop offset="1" stop-color="#7A7A7A"/></linearGradient>' +
      '<filter id="F" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<linearGradient id="Pt" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#E9E9E9"/><stop offset=".6" stop-color="#B9B9B9"/><stop offset=".8" stop-color="#F4F4F4"/><stop offset="1" stop-color="#9A9A9A"/></linearGradient>' +
      '<linearGradient id="Ob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A3A3A"/><stop offset=".3" stop-color="#0E0E0E"/><stop offset=".65" stop-color="#050505"/><stop offset="1" stop-color="#262626"/></linearGradient>' +
      '<linearGradient id="Ho" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#F2F2F2"/><stop offset=".3" stop-color="#9E9E9E"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#8E8E8E"/><stop offset="1" stop-color="#EDEDED"/>' +
        '<animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0;-1 0" dur="6s" repeatCount="indefinite"/></linearGradient>' +
      '<pattern id="Mb" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#ECECEC"/><path d="M-5 18c12-6 20 4 32-2s18-10 33-4M-4 44c10 2 16-6 28-2s22 8 36 0M20 -4c2 14-6 20 2 34s4 22 10 34" fill="none" stroke="#B0B0B0" stroke-width="1.2" opacity=".8"/><path d="M8 30c6-2 10 2 16 0" stroke="#8C8C8C" stroke-width=".8" fill="none"/></pattern>' +
      '<radialGradient id="Au"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".45"/><stop offset=".6" stop-color="#FFFFFF" stop-opacity=".12"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="Ry" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".5"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>';
    var fill = t.body;
    var solid = t.solid || (t.body === 'url(#G)' ? '#CFCFCF' : t.body);
    var parts = [
      defs,
      c.fx && c.fx !== 'nada' ? fxSvg(c.fx, true) : '',
      o.crop ? '' : '<ellipse class="ch-shadow" cx="60" cy="110" rx="27" ry="4.2" fill="#000" opacity=".55"/>',
      accSvg(c.acc, b, t, true),
      '<g class="ch-body-g' + (b.cls ? ' ' + b.cls : '') + '">',
      b.back ? b.back(b, t, fill, id) : '',
      armsSvg(b, t, pose),
      b.nofeet ? '' : '<ellipse cx="' + (60 - 12) + '" cy="' + b.feet + '" rx="8" ry="4.6" fill="' + (t.body === 'url(#G)' ? '#9C9C9C' : t.shade) + '"/><ellipse cx="' + (60 + 12) + '" cy="' + b.feet + '" rx="8" ry="4.6" fill="' + (t.body === 'url(#G)' ? '#9C9C9C' : t.shade) + '"/>',
      '<path d="' + b.d + '" fill="' + fill + '" stroke="' + t.line + '" stroke-width="1.6"/>',
      b.front ? b.front(b, t, fill, id) : '',
      '<ellipse cx="' + (60 - 13) + '" cy="' + (b.top + 14) + '" rx="9" ry="5.5" transform="rotate(-24 ' + (60 - 13) + ' ' + (b.top + 14) + ')" fill="#FFF" opacity="' + t.gloss + '"/>',
      c.cheeks ? '<ellipse cx="' + (60 - b.ex - 6) + '" cy="' + (b.ey + 10) + '" rx="5" ry="3" fill="' + (t.ink === '#111111' || t.ink === '#0B0B0B' ? '#000' : '#FFF') + '" opacity=".14"/><ellipse cx="' + (60 + b.ex + 6) + '" cy="' + (b.ey + 10) + '" rx="5" ry="3" fill="' + (t.ink === '#111111' || t.ink === '#0B0B0B' ? '#000' : '#FFF') + '" opacity=".14"/>' : '',
      eyesSvg(c.eyes, b, t, mood),
      mouthSvg(c.mouth, b, t, mood),
      b.over ? b.over(b, t, fill, id) : '',
      accSvg(c.acc, b, t, false),
      headSvg(c.head, b, t),
      mood === 'worried' ? '<path d="M' + (60 + b.ex + 14) + ' ' + (b.ey - 12) + 'c-3 4-3 7 0 8 3-1 3-4 0-8z" fill="#DADADA"/>' : '',
      '</g>',
      mood === 'sleepy' ? '<g class="ch-zzz" fill="#BDBDBD" font-family="var(--font)" font-weight="700"><text x="86" y="' + (b.top + 4) + '" font-size="11">z</text><text x="94" y="' + (b.top - 7) + '" font-size="14">z</text><text x="103" y="' + (b.top - 20) + '" font-size="17">Z</text></g>' : '',
      mood === 'focus' ? '<g class="ch-dots" fill="#BDBDBD"><circle cx="90" cy="' + (b.top - 4) + '" r="2.4"/><circle cx="98" cy="' + (b.top - 10) + '" r="3"/><circle cx="107" cy="' + (b.top - 18) + '" r="3.6"/></g>' : '',
      mood === 'party' && !o.crop ? confettiSvg() : '',
      c.fx && c.fx !== 'nada' ? fxSvg(c.fx, false) : '',
      o.prop ? propSvg(o.prop) : ''
    ];
    var view = o.crop ? '14 6 92 92' : '0 0 120 120';
    var html = '<svg class="ch-svg mood-' + mood + (o.still ? ' still' : '') + '" viewBox="' + view + '" width="' + (o.size || 96) + '" height="' + (o.size || 96) + '" aria-hidden="true">' + parts.join('') + '</svg>';
    // Cada dibujo con sus propios degradados (varios personajes en la misma pantalla)
    html = html.replace(/id="(G|F|Pt|Ob|Ho|Mb|Au|Ry)"/g, 'id="' + id + '$1"').replace(/url\(#(G|F|Pt|Ob|Ho|Mb|Au|Ry)\)/g, 'url(#' + id + '$1)');
    void solid;
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
  /** Efectos alrededor del personaje */
  function fxSvg(kind, behind) {
    if (behind) {
      if (kind === 'aura') return '<circle class="ch-aura" cx="60" cy="66" r="50" fill="url(#Au)"/>';
      if (kind === 'rayos') return '<g class="ch-rays" opacity=".5">' + [0, 30, 60, 90, 120, 150].map(function (a) { return '<path d="M60 66 L' + (60 + 70 * Math.cos(a * Math.PI / 180)).toFixed(1) + ' ' + (66 + 70 * Math.sin(a * Math.PI / 180)).toFixed(1) + '" stroke="url(#Ry)" stroke-width="10"/>'; }).join('') + '</g>';
      if (kind === 'orbita') return '<ellipse cx="60" cy="68" rx="52" ry="14" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2" transform="rotate(-12 60 68)"/>';
      return '';
    }
    switch (kind) {
      case 'brillo': return '<g class="ch-twinkle" fill="#FFF">' + [[18, 30, 1], [102, 24, .8], [108, 70, 1.1], [12, 78, .7]].map(function (p, i) { return '<path style="--i:' + i + '" transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')" d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z"/>'; }).join('') + '</g>';
      case 'orbita': return '<g class="ch-orbit"><path transform="translate(112 58)" d="M0-5 1.2-1.2 5 0 1.2 1.2 0 5-1.2 1.2-5 0-1.2-1.2z" fill="#FFF"/><circle cx="8" cy="78" r="2.4" fill="#BDBDBD"/></g>';
      case 'estela': return '<g class="ch-dust" fill="#FFF">' + [[30, 100], [44, 106], [76, 104], [92, 98], [60, 110]].map(function (p, i) { return '<circle style="--i:' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (1.4 + (i % 3) * .5) + '"/>'; }).join('') + '</g>';
      case 'aura': return '<g class="ch-twinkle" fill="#FFF"><path style="--i:1" transform="translate(98 30) scale(.8)" d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z"/></g>';
      default: return '';
    }
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
    var f = W.Screens.focus && W.Screens.focus.status ? W.Screens.focus.status() : null;
    if (f && f.running && f.mode === 'work') return 'focus';
    var s = st.stats();
    if (s.todayTotal && s.todayDone === s.todayTotal) return 'proud';
    if (st.overdueAll().length >= 3) return 'worried';
    if (h >= 23 || h < 6) return 'sleepy';
    return 'happy';
  }

  /** La siguiente tarea de hoy: la primera de «Lo más importante» */
  function nextTask() {
    var home = W.Screens && W.Screens.home;
    return home && home.topTasks ? home.topTasks(S()).list[0] || null : null;
  }

  /**
   * Frases útiles según el momento: [{ text, action: { label, run } }]
   * Con { next: true } no repite cuántas tareas quedan (ya lo dice la tarjeta del día):
   * propone por cuál seguir.
   */
  function lines(opts) {
    opts = opts || {};
    var st = S(), s = st.stats(), out = [], td = U.today(), name = st.displayName().split(' ')[0];
    var overdue = st.overdueAll(), left = s.todayTotal - s.todayDone, h = new Date().getHours();
    var f = W.Screens.focus.status();
    if (f.running) out.push({ text: f.mode === 'work' ? W.t('Estoy concentrado contigo. Quedan {text}.', { text: f.text }) : W.t('Pausa: respira y estírate. Quedan {text}.', { text: f.text }) });
    // De otros días: se pueden pasar a hoy. De hoy con la hora pasada: no tiene sentido «pasarlas a hoy»
    var past = overdue.filter(function (t) { return t.date < td; });
    if (past.length) out.push({ text: past.length === 1 ? W.t('Tienes una tarea de otro día sin hacer. ¿La pasamos a hoy?') : W.t('Tienes {length} tareas de otros días sin hacer. ¿Las pasamos a hoy?', { length: past.length }),
      action: { label: W.t('Pasar a hoy'), run: function () {
        var ids = past.map(function (t) { return t.id; });
        st.bulkUpdate(ids, function () { return { date: td, time: null }; });
        W.Toast.show({ text: W.t('{n} a hoy', { n: U.plural(ids.length, 'tarea pasa', 'tareas pasan') }), icon: 'sun' });
      } } });
    else if (overdue.length) out.push(overdue.length === 1
      ? { text: W.t('Se te pasó la hora de «{text}». ¿Le buscamos otro hueco?', { text: overdue[0].text }), action: { label: W.t('Posponer'), run: function () { W.TaskCard.actions.postpone(overdue[0].id); } } }
      : { text: W.t('Se te pasó la hora de {length} tareas de hoy. Ve a por la primera.', { length: overdue.length }) });
    if (s.todayTotal && !left) out.push({ text: W.t('¡Todo hecho por hoy{0}! Me encanta este ritmo.', { 0: name ? ', ' + name : '' }) });
    else if (left > 0) {
      var nx = opts.next ? nextTask() : null;
      if (nx) out.push({ text: W.t('Lo siguiente: «{text}».', { text: nx.text }),
        action: f.running ? null : { label: W.t('Enfoque de {work} min', { work: st.settings.focus.work }), run: function () { W.Screens.focus.linkTask(nx.id); W.Screens.focus.toggle(); W.Router.refresh(); } } });
      else out.push({ text: left === 1 ? W.t('Te queda una tarea para hoy. ¡Vamos!') : W.t('Te quedan {left} tareas para hoy. Una a una.', { left: left }),
        action: f.running ? null : { label: W.t('Enfoque de {work} min', { work: st.settings.focus.work }), run: function () { W.Screens.focus.toggle(); W.Router.refresh(); } } });
    }
    if (W.Habits) {
      var hp = W.Habits.list().filter(W.Habits.pendingToday);
      if (hp.length) out.push({ text: W.t('Aún te falta un hábito: «{name}».', { name: hp[0].name }), action: { label: hp[0].target > 1 ? W.t('Sumar uno') : W.t('Hecho'), run: function () { W.Habits.tap(hp[0], td); } } });
    }
    if (s.streak >= 2) out.push({ text: W.t('Llevas {streak} días de racha. No la rompas.', { streak: s.streak }) });
    if (!s.todayTotal && !overdue.length) out.push({ text: h < 13 ? W.t('¿Qué quieres conseguir hoy?') : W.t('¿Algo más para hoy?'), action: { label: W.t('Nueva tarea'), run: function () { W.QuickAdd.open({ date: td }); } } });
    if (h >= 22 || h < 6) out.push({ text: W.t('Es tarde. Mañana seguimos con energía.') });
    out.push({ text: W.t('Tócame cuando quieras: te cuento cómo vas.') });
    return out;
  }

  /* ---------- Componentes ---------- */
  /** Personaje interactivo: { size, bubble: true, mood } */
  function node(o) {
    o = o || {};
    var m = o.mood || mood();
    var wrap = U.el('div.buddy' + (o.cls ? '.' + o.cls : ''), { attrs: { role: 'button', tabindex: '0', 'aria-label': W.t('{name}, {mood}. Toca para hablar.', { name: config().name || W.t('Tu personaje'), mood: MOODS[m].toLowerCase() }) } }, [svg({ size: o.size || 72, mood: m })]);
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
    var c = config(), m = mood(), s = S().stats();
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
    // En el ordenador, si el bloque «Resumen del día» está a la vista, el recuento no se repite aquí
    var widgets = (S().settings.desk || {}).widgets || {};
    var showCount = !desk || widgets.summary === false;
    var meta = U.el('div.buddy-meta', [U.el('strong', { text: c.name || W.t('Tu personaje') }),
      showCount ? U.el('span', { text: s.todayTotal ? W.t('{done} de {total} hoy', { done: s.todayDone, total: U.plural(s.todayTotal, 'tarea hecha', 'tareas hechas') }) : W.t('Nada programado para hoy') })
        : U.el('span', { text: MOODS[m] }),
      showCount ? U.el('div.bar', [U.el('i', { style: { width: s.todayPct + '%' } })]) : null]);
    var edit = U.el('button.circle-btn.buddy-edit', { attrs: { 'aria-label': W.t('Personalizar tu personaje'), title: W.t('Personalizar') }, on: { click: function (e) { e.stopPropagation(); Character.edit(); } } }, [U.icon('palette')]);
    if (desk) return U.el('div.group.card.side-card.buddy-card', [U.el('div.buddy-row', [b, meta, edit]), bubble]);
    return U.el('div.buddy-strip', [b, U.el('div.buddy-say', [bubble]), edit]);
  }

  /**
   * Móvil · tu día en una sola tarjeta: el personaje, cuántas llevas (con su barra), la racha y
   * el enfoque de hoy, y una frase que propone por dónde seguir (sin repetir el recuento).
   */
  function dayCard() {
    var st = S(), s = st.stats(), m = mood();
    var bubble = U.el('div.buddy-bubble.static');
    var b = node({ size: 58, mood: m, bubble: false });
    var idx = 0;
    var fill = function (l) {
      U.clear(bubble);
      bubble.appendChild(U.el('span', { text: l.text }));
      if (l.action) bubble.appendChild(U.el('button.btn.xs.soft', { text: l.action.label, on: { click: function (e) { e.stopPropagation(); l.action.run(); } } }));
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    };
    fill(lines({ next: true })[0]);
    b.addEventListener('click', function () { var l = lines({ next: true }); idx++; fill(l[idx % l.length]); });
    var chips = [];
    if (s.streak) chips.push(U.el('span.hero-chip', [U.icon('flame'), U.el('b', { text: String(s.streak) }), ' ' + W.tn(s.streak, 'día de racha', 'días de racha')]));
    if (s.focusToday) chips.push(U.el('span.hero-chip', [U.icon('timer'), U.el('b', { text: String(s.focusToday) }), W.t(' min de enfoque')]));
    var pct = s.todayPct;
    var info = U.el('button.day-info', { attrs: { type: 'button', title: W.t('Ver tu perfil y resumen') }, on: { click: function () { W.Router.go('progress'); } } }, [
      U.el('strong', { text: s.todayTotal ? W.t('{todayDone} de {todayTotal} hechas hoy', { todayDone: s.todayDone, todayTotal: s.todayTotal }) : W.t('Nada programado para hoy') }),
      s.todayTotal ? U.el('span.bar', { attrs: { role: 'progressbar', 'aria-label': W.t('Progreso de hoy'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) } },
        [U.el('i', { style: { width: pct + '%' } })]) : null,
      chips.length ? U.el('span.hero-chips', chips) : null
    ]);
    var edit = U.el('button.circle-btn.buddy-edit', { attrs: { 'aria-label': W.t('Personalizar tu personaje'), title: W.t('Personalizar') }, on: { click: function (e) { e.stopPropagation(); Character.edit(); } } }, [U.icon('palette')]);
    return U.el('div.day-card', [U.el('div.day-row', [b, info, edit]), bubble]);
  }

  /** Ilustración para pantallas vacías: personaje con un objeto */
  function illustration(prop, mood0, size) {
    return U.el('span.buddy-illus', [svg({ size: size || 96, mood: mood0 || 'happy', prop: prop })]);
  }

  var KIND = { body: W.t('Especie'), tone: W.t('Acabado'), eyes: W.t('Ojos'), mouth: W.t('Boca'), head: W.t('Cabeza'), acc: W.t('Accesorio'), fx: W.t('Efecto'), bg: W.t('Fondo'), frame: W.t('Marco') };
  var TABS = [{ value: 'body', label: W.t('Especie') }, { value: 'face', label: W.t('Cara') }, { value: 'head', label: W.t('Cabeza') }, { value: 'acc', label: W.t('Accesorios') }, { value: 'avatar', label: W.t('Perfil') }];

  /* ---------- Editor ---------- */
  function edit(tab0) {
    var draft = Object.assign({}, config());
    var tab = tab0 === 'eyes' || tab0 === 'mouth' ? 'face' : tab0 === 'tone' ? 'body' : tab0 === 'fx' ? 'acc' : tab0 === 'bg' || tab0 === 'frame' ? 'avatar' : (tab0 && TABS.some(function (t) { return t.value === tab0; }) ? tab0 : 'body');
    var previewMood = 'happy';
    var stage = U.el('div.be-stage');
    var drawStage = function () {
      U.clear(stage);
      stage.appendChild(svg({ size: 168, mood: previewMood, cfg: draft }));
      if (W.Avatar) stage.appendChild(U.el('div.be-avatar', [W.Avatar.buddy(draft, 64), U.el('small', { text: W.t('Así te ven') })]));
    };
    var moods = U.el('div.chips.be-moods', Object.keys(MOODS).map(function (k) {
      var c = U.el('button.chip' + (k === previewMood ? '.on' : ''), { attrs: { type: 'button' }, text: MOODS[k] });
      c.addEventListener('click', function () { previewMood = k; U.$$('.chip', moods).forEach(function (x) { x.classList.toggle('on', x === c); }); drawStage(); });
      return c;
    }));
    var name = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 16, placeholder: W.t('Nombre de tu personaje'), 'aria-label': W.t('Nombre de tu personaje') } });
    name.value = draft.name || '';
    name.addEventListener('input', function () { draft.name = name.value.trim(); });
    var grid = U.el('div.be-grid');
    var option = function (cat, it) {
      var cfg = Object.assign({}, draft); cfg[cat] = it.id;
      var on = draft[cat] === it.id;
      var preview = (cat === 'bg' || cat === 'frame') && W.Avatar ? W.Avatar.buddy(cfg, 58) : svg({ size: 58, cfg: cfg, mood: 'happy', still: true });
      var b = U.el('button.be-opt' + (on ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false', title: it.name } }, [
        preview,
        U.el('span.be-name', { text: it.name })
      ]);
      b.addEventListener('click', function () { draft[cat] = it.id; W.Audio.select(); drawStage(); drawGrid(); });
      return b;
    };
    var drawGrid = function () {
      U.clear(grid);
      var cats = tab === 'body' ? ['body', 'tone'] : tab === 'face' ? ['eyes', 'mouth'] : tab === 'acc' ? ['acc', 'fx'] : tab === 'avatar' ? ['bg', 'frame'] : [tab];
      cats.forEach(function (cat) {
        grid.appendChild(U.el('div.be-h', { text: KIND[cat] }));
        grid.appendChild(U.el('div.be-row', CATALOG[cat].map(function (it) { return option(cat, it); })));
      });
      if (tab === 'face') grid.appendChild(W.UI.group([W.UI.cell({ title: W.t('Mejillas'), right: W.UI.toggle(!!draft.cheeks, function (v) { draft.cheeks = v; drawStage(); drawGrid(); }, W.t('Mejillas')) })]));
    };
    var tabs = W.UI.segmented(TABS, tab, function (v) { tab = v; drawGrid(); });
    var randomize = function () {
      Object.keys(CATALOG).filter(function (cat) { return cat !== 'bg' && cat !== 'frame'; }).forEach(function (cat) {
        var all = CATALOG[cat];
        draft[cat] = all[Math.floor(Math.random() * all.length)].id;
      });
      draft.cheeks = Math.random() > .4;
      W.Audio.boop(); drawStage(); drawGrid();
    };
    var s = W.Sheet.open({
      title: W.t('Tu personaje'), className: 'editor buddy-editor', full: true,
      body: [
        U.el('div.be-top', [stage, moods]),
        U.el('div.group', [U.el('label.cell', [name])]),
        tabs, grid
      ],
      foot: [
        U.el('button.btn.ghost', { on: { click: randomize } }, [U.icon('sparkle', 'sm'), W.t('Al azar')]),
        U.el('button.btn.primary', { text: W.t('Guardar'), on: { click: function () {
          var out = {}; ['name', 'body', 'tone', 'eyes', 'mouth', 'head', 'acc', 'cheeks', 'fx', 'bg', 'frame'].forEach(function (k) { out[k] = draft[k]; });
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
    CATS: CATS,
    MOODS: MOODS,
    DEFAULT: DEFAULT,
    config: config,
    svg: svg,
    node: node,
    mood: mood,
    lines: lines,
    companion: companion,
    dayCard: dayCard,
    illustration: illustration,
    edit: edit
  };

  W.Character = Character;
})(window.Whider);
