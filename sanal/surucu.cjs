// Sanal gözle laboratuvarı başsız tarayıcıda çalıştırır (lab klasöründe: python3 -m http.server 8765).
// Kullanım: node sanal/surucu.cjs '<senaryo json>'
// senaryo: { sanal: {...}, ayar: {...}, adimlar: ["kalibre"|"dokunarak"|"bas"|"isabet"|"ogret"|"bekle:ms"], ad }
const { chromium } = require('playwright');
const fs = require('fs');
const sen = JSON.parse(process.argv[2]);
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ acceptDownloads: true, viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await c.newPage();
  const hatalar = []; p.on('pageerror', e => hatalar.push(e.message));
  await p.addInitScript((s) => { if (!localStorage.getItem('gk-baslatildi')) { localStorage.clear(); localStorage.setItem('gk-baslatildi', '1'); localStorage.setItem('sanal-gk-ayar', JSON.stringify({ _surum: 99, ...(s.ayar || {}) })); } }, sen);
  const q = new URLSearchParams({ sanal: '1', ...(sen.sanal || {}) });
  await p.goto('http://localhost:8765/?' + q);
  await p.waitForFunction(() => !document.getElementById('bKamera').disabled, null, { timeout: 30000 });
  await p.click('#bKamera');
  await p.waitForTimeout(1500);
  const sonuc = { ad: sen.ad, adimlar: [] };
  const baslik = () => p.textContent('#hudBaslik');
  const bitene = async (re, ms) => { await p.waitForFunction((r) => new RegExp(r).test(document.getElementById('hudBaslik').textContent), re, { timeout: ms, polling: 500 }); };
  const kapat = async () => { const cik = await p.$('#hudDugmeler button:last-child'); if (cik) await cik.click(); await p.waitForTimeout(300); };
  for (const a of sen.adimlar) {
    if (a === 'kalibre') { await p.click('#bKalibre'); await bitene('Kalibrasyon bitti|Yeterli', 200000); sonuc.adimlar.push({ a, alt: await p.textContent('#hudAlt'), bilgi: await p.textContent('#hudBilgi') }); await kapat(); }
    else if (a === 'bas') { await p.click('#bBasKal'); await bitene('Baş hareketi öğrenildi|Yeterli', 90000); sonuc.adimlar.push({ a, alt: await p.textContent('#hudAlt') }); await kapat(); }
    else if (a === 'isabet' || a === 'ogret') {
      await p.click('#bIsabet'); await bitene('İsabet testi bitti|Yeterli', 60000);
      const bilgi = await p.textContent('#hudBilgi'), alt = await p.textContent('#hudAlt');
      sonuc.adimlar.push({ a: 'isabet', alt, bilgi });
      if (a === 'ogret') { await p.click('#hudDugmeler button:has-text("Düzeltmeyi öğret")'); await p.waitForTimeout(300); }
      await kapat();
    }
    else if (a.startsWith('indir:')) {
      const [ind] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => { navigator.canShare = undefined; document.getElementById('bHamVeri').click(); })]);
      await ind.saveAs(a.slice(6)); sonuc.adimlar.push({ a: 'indir', alt: a.slice(6) });
    }
    else if (a.startsWith('bekle:')) await p.waitForTimeout(+a.slice(6));
    else if (a.startsWith('ayar:')) { const [k, v] = a.slice(5).split('='); await p.evaluate(([k, v]) => { const s = JSON.parse(localStorage.getItem('sanal-gk-ayar')); s[k] = isNaN(+v) ? v : +v; localStorage.setItem('sanal-gk-ayar', JSON.stringify(s)); }, [k, v]); await p.reload(); await p.waitForFunction(() => !document.getElementById('bKamera').disabled); await p.click('#bKamera'); await p.waitForTimeout(1500); }
  }
  sonuc.profil = await p.textContent('#profilOzet');
  sonuc.hatalar = hatalar;
  console.log(JSON.stringify(sonuc, null, 1));
  await b.close();
})();
