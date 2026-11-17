// Detección del dispositivo para ofrecer la descarga adecuada (sitio/descargas.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const UA = {
  windows: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'Win32'
  ],
  mac: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'MacIntel'
  ],
  linux: [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'Linux x86_64'
  ],
  android: [
    'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
    'Linux armv8l'
  ],
  ios: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'iPhone'
  ],
  chromebook: [
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'Linux x86_64'
  ]
};
const D = (ua, platform, touch) => cargar(['sitio/descargas.js'], { ua, platform, touch }).WhiderDescargas;

test('reconoce cada sistema', () => {
  assert.equal(D(...UA.windows).plataforma(), 'windows');
  assert.equal(D(...UA.mac).plataforma(), 'mac');
  assert.equal(D(...UA.linux).plataforma(), 'linux');
  assert.equal(D(...UA.android).plataforma(), 'android');
  assert.equal(D(...UA.ios).plataforma(), 'ios');
  // Un Chromebook no puede instalar ninguno de los instaladores
  assert.equal(D(...UA.chromebook).plataforma(), 'otro');
});

test('un iPad que se presenta como Mac se trata como iOS', () => {
  assert.equal(D(UA.mac[0], 'MacIntel', 5).plataforma(), 'ios');
});

test('solo Android e iOS cuentan como móvil', () => {
  assert.equal(D(...UA.android).esMovil(), true);
  assert.equal(D(...UA.ios).esMovil(), true);
  assert.equal(D(...UA.windows).esMovil(), false);
});

test('cada sistema de ordenador tiene su instalador con dirección de descarga', () => {
  const d = D(...UA.windows);
  for (const so of ['windows', 'mac', 'linux']) {
    assert.ok(d.ordenador[so].archivo, so);
    assert.match(d.ordenador[so].url, /^https:\/\/github\.com\/McTn4\/whider-2\.0-PREMIUM\/releases\//, so);
  }
});
