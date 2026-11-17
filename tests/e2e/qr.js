// El QR de la app (con el personaje en el centro) se lee bien con un lector real
const { chromium } = require('playwright');
const { APP, OUT } = require('./_util');
const fs = require('fs');
const DIR = process.argv[2] || OUT;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 600, height: 700 }, deviceScaleFactor: 1 })).newPage();
  await p.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
  await p.goto(APP); await p.waitForTimeout(1500);
  const results = [];
  for (const link of ['https://whider-red.vercel.app/i/?c=WH-9ZQZS5&k=tz4YtJHGVHn7&t=w&n=Luc%C3%ADa%20Mart%C3%ADn&b=zorro.blanco.grandes.sonrisa.auriculares.bufanda.brillo.degradado.aro', 'https://whider-red.vercel.app/i/?s=sp_mw6ywjwhzlug1&k=E4DG3R7j4KRj&n=Marketing&by=Luc%C3%ADa%20Mart%C3%ADn']) {
    await p.evaluate(l => Whider.Invite.loadQR().then(() => { const old = document.getElementById('qrtest'); if (old) old.remove(); const box = Whider.U.el('div', { attrs: { id: 'qrtest' }, style: { position: 'fixed', left: '0', top: '0', zIndex: '99999', background: '#fff', padding: '20px' } }, [Whider.U.el('div', { style: { width: '300px' } }, [Whider.Invite.qrNode(l, { center: Whider.Avatar.me(60) })])]); document.body.appendChild(box); }), link);
    await p.waitForTimeout(400);
    const png = await p.locator('#qrtest').screenshot();
    const decoded = await p.evaluate(async (b64) => {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/vendor/jsqr.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height); const r = window.jsQR(d.data, d.width, d.height); return r ? r.data : null;
    }, png.toString('base64'));
    results.push(decoded === link ? 'OK   QR leído: ' + link.slice(0, 60) + '…' : 'FAIL no se pudo leer');
    fs.writeFileSync(DIR + '/qr-' + results.length + '.png', png);
  }
  console.log(results.join('\n'));
  await b.close();
})();
