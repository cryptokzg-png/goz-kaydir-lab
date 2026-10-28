// GözKaydır Lab — Android uygulamasındaki göz takip hattının tarayıcı sürümü.
// Özellikler, model, filtre, kırpma eşiği, kalibrasyon ve imleç modları Kotlin koduyla birebir aynı mantıkta;
// buradaki ayarlar bulunduktan sonra uygulamaya aktarılır.
import { FaceLandmarker, HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const SURUM = "lab 21";
const $ = (id) => document.getElementById(id);
const deg = (r) => (r * 180) / Math.PI;
const kis = (v, a, b) => Math.min(b, Math.max(a, v));

// ------------------------------------------------------------------ ayarlar
const AYAR_TANIM = [
  { b: "Yumuşatma ve kırpma" },
  { k: "kesim", ad: "Titreme yumuşatma (kesim, Hz)", min: 0.1, max: 3, adim: 0.05, v: 0.9, not: "Düşük = daha sakin imleç, ama yavaş bakışta biraz gecikme." },
  { k: "beta", ad: "Hız duyarlılığı (beta)", min: 0, max: 3, adim: 0.05, v: 0.7, not: "Yüksek = göz sıçrayınca imleç daha hızlı yetişir." },
  { k: "kirpTaban", ad: "Kırpma eşiği", min: 0.2, max: 0.6, adim: 0.01, v: 0.35, not: "Bu değerin üstünde takip donar (göz kırpılıyor sayılır)." },
  { k: "kirpEgim", ad: "Aşağı bakışta eşik artışı", min: 0, max: 1, adim: 0.05, v: 0.45, not: "Aşağı bakınca göz kapağı düşer; eşik bu oranda yükselir." },
  { k: "kirpTavan", ad: "Kırpma eşiği üst sınırı", min: 0.4, max: 0.9, adim: 0.01, v: 0.7 },
  { k: "kirpGoreli", ad: "Kapanmaya başlama algısı", min: 0, max: 0.4, adim: 0.01, v: 0.15, not: "Kırpma puanı senin açık göz değerinin bu kadar üstüne çıkınca da donar. Kırpmanın ilk karelerini yakalar. 0 = kapalı." },
  { k: "kirpSonrasi", ad: "Kırpmadan sonra bekleme (ms)", min: 0, max: 400, adim: 10, v: 150, not: "Göz açılırken ölçüm bozuk olur; bu süre boyunca imleç donuk kalır." },
  { k: "sicramaEsik", ad: "Sıçrama süzgeci (ekranın oranı)", min: 0.05, max: 0.6, adim: 0.01, v: 0.2, not: "Bundan büyük ani sıçramalar onaylanmadan kabul edilmez." },
  { k: "sicramaKare", ad: "Sıçrama onayı (kare)", min: 0, max: 3, adim: 1, v: 1, not: "Büyük sıçramanın kabul edilmesi için kaç kare daha aynı yerde kalmalı. 0 = süzgeç kapalı." },
  { b: "Model" },
  { k: "ozellik", ad: "Göz özellikleri", secenek: [["yeni", "Yeni (uzaklık + kapak, 10)"], ["eski", "Eski (6)"], ["goz", "Sadece göz (baş yok)"]], v: "yeni", not: "Değiştirince model aynı örneklerle yeniden eğitilir: farkı hemen ölçebilirsin." },
  { k: "lambda", ad: "Düzenleme (lambda)", min: 0.002, max: 1, adim: 0.002, v: 0.02, not: "Yüksek = daha kararlı ama daha az esnek model." },
  { k: "izgara", ad: "Izgara", secenek: [["oto", "Otomatik"], ["2x3", "2×3"], ["2x4", "2×4"], ["3x3", "3×3"], ["3x4", "3×4"]], v: "oto" },
  { k: "bolgeMs", ad: "Bölge değişme süresi (ms)", min: 0, max: 1000, adim: 50, v: 300 },
  { b: "Kalibrasyon" },
  { k: "noktaSure", ad: "Nokta başına süre (ms)", min: 1000, max: 3000, adim: 100, v: 1800 },
  { k: "toplamaBasi", ad: "Toplamaya başlama (ms)", min: 300, max: 1500, adim: 50, v: 700, not: "Göz noktaya varana kadar beklenen süre." },
  { k: "uzaklikAsama", ad: "Yakın ve uzak aşamaları", secenek: [["acik", "Açık"], ["kapali", "Kapalı"]], v: "acik" },
  { k: "dkSayi", ad: "Dokunarak kalibrasyon nokta sayısı", secenek: [["20", "20"], ["45", "45"], ["90", "90"]], v: "45" },
  { k: "dkPencere", ad: "Dokunmadan önceki pencere (ms)", min: 150, max: 800, adim: 25, v: 450, not: "Dokunmadan bu kadar önceki kareler örnek alınır (dokunma anı ve sonrası atılır)." },
  { b: "Kilitle modu" },
  { k: "kilitSabitMs", ad: "Kilitlenme süresi (ms)", min: 200, max: 1500, adim: 50, v: 500 },
  { k: "kilitYaricap", ad: "Sabit bakış yarıçapı (px)", min: 20, max: 100, adim: 5, v: 45 },
  { k: "kilitKazanc", ad: "Baş ince ayar hızı (px/derece)", min: 4, max: 30, adim: 1, v: 12 },
  { k: "kilitOlu", ad: "Baş ölü bölgesi (derece)", min: 0, max: 2, adim: 0.1, v: 0.6 },
  { k: "kilitCikis", ad: "Kilidi açma uzaklığı (px)", min: 60, max: 250, adim: 10, v: 130 },
  { k: "atlaYaricap", ad: "Kilitte aday hedef yarıçapı (px)", min: 40, max: 250, adim: 10, v: 130, not: "Kilitlenince bu mesafedeki hedeflerden bakışa en yakını seçilir; başla komşulara atlanır." },
  { k: "atlaEsik", ad: "Atlama için baş hareketi (derece)", min: 1, max: 8, adim: 0.5, v: 3, not: "Başı bu kadar çevirip geri getirince yandaki hedefe geçer." },
  { k: "basTersX", ad: "Baş yönü sağ-sol", secenek: [["normal", "Normal"], ["ters", "Ters"]], v: "normal" },
  { k: "basTersY", ad: "Baş yönü yukarı-aşağı", secenek: [["normal", "Normal"], ["ters", "Ters"]], v: "normal" },
  { b: "Tıklama" },
  { k: "tikYontem", ad: "Tıklama yöntemi", secenek: [["kapat", "Gözleri kapat"], ["cimdik", "Parmak çimdiği (başparmak + işaret)"], ["bekle", "Bakıp bekle"]], v: "kapat", not: "Gözleri kapat: iki gözü kısa bir süre kapatıp açınca tıklar (normal göz kırpmayla karışmaz)." },
  { k: "tikKapatMs", ad: "Gözleri kapalı tutma süresi (ms)", min: 250, max: 1200, adim: 50, v: 500 },
  { k: "bekleTikMs", ad: "Bekleme süresi (ms)", min: 400, max: 2500, adim: 50, v: 1000 },
  { k: "bekleEsik", ad: "Sabit sayılma eşiği, göz modu (px)", min: 8, max: 60, adim: 2, v: 28 },
  { k: "kilitTikMs", ad: "Kilitliyken tıklama süresi (ms)", min: 600, max: 3000, adim: 100, v: 1500, not: "İnce ayar için zaman tanır." },
  { k: "tikAra", ad: "İki tıklama arası en az (ms)", min: 0, max: 2000, adim: 100, v: 800 },
  { k: "miknatis", ad: "Mıknatıs (hedefe yapış)", secenek: [["acik", "Açık"], ["kapali", "Kapalı"]], v: "acik", not: "Uygulamadaki gibi: yakında tek belirgin hedef varsa imleç ona oturur, hedefler sıkışıksa yapışmaz." },
  { k: "ogren", ad: "Doğru tıklamalardan öğren", secenek: [["kayma", "Kaymayı düzelt"], ["ornek", "Örnek ekle"], ["kapali", "Kapalı"]], v: "kayma" },
  { k: "dokunma", ad: "Canlı bakışta dokununca", secenek: [["kayma", "Kaymayı düzelt"], ["ornek", "Örnek ekle"]], v: "kayma", not: "Kayma: tüm ekranı topluca kaydırır (hızlı, kararlı). Örnek: modeli yeniden eğitir." },
  { k: "kaymaHiz", ad: "Kayma düzeltme hızı", min: 0.1, max: 1, adim: 0.05, v: 0.4, not: "Her doğru bilinen bakışta kaymanın ne kadarı düzeltilsin. 1 = tamamı." },
  { b: "El ve parmak" },
  { k: "kontrol", ad: "İmleç kontrolü", secenek: [["goz", "Sadece göz"], ["parmak", "Sadece parmak"], ["gozParmak", "Göz + parmak"]], v: "goz", not: "Göz + parmak: göz imleci götürür, işaret parmağını kaldırınca imleç o noktadan parmakla kayar." },
  { k: "elAlan", ad: "Sadece parmak: kamera alanı", min: 0.3, max: 1, adim: 0.05, v: 0.6, not: "Kameranın ortasındaki bu oran tüm ekrana yayılır. Küçük = az el hareketiyle tüm ekran." },
  { k: "parmakHassas", ad: "Göz + parmak: ince ayar hızı", min: 0.3, max: 4, adim: 0.1, v: 1.2, not: "Parmağın kamerada kat ettiği yolun ekranda kaç katı kadar kayacağı." },
  { k: "kaydirModu", ad: "Kaydırma", secenek: [["yumruk", "Yumrukla tut ve çek"], ["cimdik", "Çimdikle sürükle"], ["joystick", "İki parmak joystick"], ["mesafe", "İki parmak mesafe"]], v: "yumruk", not: "Yumruk: elini yumruk yap (tut), aşağı-yukarı götür, elini aç (bırak). Hızlı bırakırsan liste biraz daha kayar." },
  { k: "surukleYon", ad: "Sürükleme yönü", secenek: [["ters", "El aşağı = listede aşağı"], ["telefon", "Telefondaki gibi (içerik eli izler)"]], v: "ters" },
  { k: "kaydirHiz", ad: "Joystick hızı (px/sn)", min: 200, max: 4000, adim: 100, v: 900, not: "Parmak, ölü bölgenin %10 ötesine çekildiğinde saniyedeki kaydırma. Hız karesel artar: az çekince çok yavaş." },
  { k: "kaydirOlu", ad: "Joystick ölü bölgesi", min: 0.01, max: 0.1, adim: 0.005, v: 0.04, not: "Parmak başlangıç noktasından bu kadar uzaklaşmadan kaydırma başlamaz." },
  { k: "kaydirOtur", ad: "Bırakınca satıra otur", secenek: [["acik", "Açık"], ["kapali", "Kapalı"]], v: "acik" },
  { k: "kaydirMesafe", ad: "Sürükleme / mesafe katsayısı", min: 1, max: 10, adim: 0.5, v: 3, not: "El kameranın tamamı kadar hareket ederse liste kaç ekran boyu kayar." },
  { b: "Performans" },
  { k: "gpu", ad: "Yüz modeli işlemcisi", secenek: [["cpu", "CPU"], ["gpu", "GPU"]], v: "cpu", not: "GPU daha yüksek kare hızı verebilir; değiştirince model yeniden yüklenir." },
];
const VARSAYILAN = Object.fromEntries(AYAR_TANIM.filter((a) => a.k).map((a) => [a.k, a.v]));
let S = { ...VARSAYILAN };
function oku(anahtar, yedek) { try { const v = localStorage.getItem(anahtar); return v ? JSON.parse(v) : yedek; } catch { return yedek; } }
function yaz(anahtar, v) { try { localStorage.setItem(anahtar, JSON.stringify(v)); } catch {} }
S = { ...VARSAYILAN, ...oku("gk-ayar", {}) };
// Varsayılanı değişen ayarlar: eski kayıtlı değerleri bir kez yenile
if ((S._surum || 0) < 18) { S.kaydirHiz = VARSAYILAN.kaydirHiz; S._surum = 18; yaz("gk-ayar", S); }
if ((S._surum || 0) < 20) { S.surukleYon = "ters"; }
if ((S._surum || 0) < 19) { S.kaydirModu = "cimdik"; S.kaydirMesafe = VARSAYILAN.kaydirMesafe; }
if ((S._surum || 0) < 21) { S.kaydirModu = "yumruk"; S._surum = 21; yaz("gk-ayar", S); }
// Eski sürümden kalan seçenek değerleri
if (!AYAR_TANIM.find((a) => a.k === "ogren").secenek.some(([v]) => v === S.ogren)) S.ogren = VARSAYILAN.ogren;

function ayarlariCiz() {
  const kap = $("ayarlar");
  kap.innerHTML = "";
  let grup = null;
  for (const a of AYAR_TANIM) {
    if (a.b) {
      grup = document.createElement("details");
      if (a.b === "Yumuşatma ve kırpma" || a.b === "Model" || a.b === "El ve parmak") grup.open = true;
      grup.innerHTML = `<summary>${a.b}</summary>`;
      kap.appendChild(grup);
      continue;
    }
    const d = document.createElement("div");
    d.className = "ayar";
    const id = "ay-" + a.k;
    if (a.secenek) {
      d.innerHTML = `<label for="${id}">${a.ad}</label><select id="${id}">${a.secenek.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
      const sel = d.querySelector("select");
      sel.value = S[a.k];
      sel.addEventListener("change", () => ayarDegisti(a.k, sel.value));
    } else {
      d.innerHTML = `<label for="${id}">${a.ad}</label><output id="${id}-o"></output><input type="range" id="${id}" min="${a.min}" max="${a.max}" step="${a.adim}">`;
      const inp = d.querySelector("input");
      const out = d.querySelector("output");
      inp.value = S[a.k];
      out.textContent = bicim(S[a.k], a.adim);
      inp.addEventListener("input", () => { out.textContent = bicim(+inp.value, a.adim); ayarDegisti(a.k, +inp.value, true); });
      inp.addEventListener("change", () => ayarDegisti(a.k, +inp.value));
    }
    if (a.not) { const s = document.createElement("small"); s.textContent = a.not; d.appendChild(s); }
    grup.appendChild(d);
  }
}
const bicim = (v, adim) => (adim >= 1 ? String(Math.round(v)) : v.toFixed(adim < 0.01 ? 3 : 2));

let egitZamanlayici = 0;
function ayarDegisti(k, v, surukleniyor = false) {
  S[k] = v;
  yaz("gk-ayar", S);
  if (k === "ozellik" || k === "lambda") {
    clearTimeout(egitZamanlayici);
    egitZamanlayici = setTimeout(() => { profilEgit(true); }, surukleniyor ? 400 : 0);
  }
  if (k === "izgara") profilEgit(false);
  if (k === "gpu" && !surukleniyor) modelYukle();
}

// ------------------------------------------------------------------ göz modeli (Kotlin: GozModeli)
const OZ_SAYI = 10;
const UZAKLIK = 8;
const TABAN = [1e-3, 1e-3, 0.02, 0.02, 2, 2, 1, 1, 2, 0.02];

function terimler(n, set) {
  // Sadece göz: baş açısı ve konumu yok (iris, kapak, göz ifadeleri)
  if (set === "goz") return [1, n[0], n[1], n[2], n[3], n[9], n[0] * n[0], n[1] * n[1], n[0] * n[1], n[9] * n[9]];
  if (set === "eski") return [1, n[0], n[1], n[2], n[3], n[4], n[5], n[0] * n[0], n[1] * n[1], n[0] * n[1]];
  const u = n[UZAKLIK];
  return [1, n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9],
    n[0] * n[0], n[1] * n[1], n[0] * n[1], n[9] * n[9], n[0] * u, n[1] * u, n[9] * u];
}

class Model {
  constructor(mu, sd, wx, wy, set) { Object.assign(this, { mu, sd, wx, wy, set }); }
  tahmin(f) {
    const n = this.mu.map((m, i) => (f[i] - m) / this.sd[i]);
    const z = terimler(n, this.set);
    let x = 0, y = 0;
    for (let i = 0; i < z.length; i++) { x += this.wx[i] * z[i]; y += this.wy[i] * z[i]; }
    return [x, y];
  }
}

function egit(ornekler, set = S.ozellik, lambdaOran = S.lambda) {
  if (ornekler.length < 20) return null;
  const nf = set === "eski" ? 6 : OZ_SAYI;
  const mu = [], sd = [];
  for (let i = 0; i < nf; i++) {
    let t = 0; for (const o of ornekler) t += o.f[i];
    const m = t / ornekler.length;
    let v = 0; for (const o of ornekler) v += (o.f[i] - m) ** 2;
    mu.push(m);
    sd.push(Math.max(Math.sqrt(v / ornekler.length), set === "eski" ? 1e-4 : TABAN[i]));
  }
  const X = ornekler.map((o) => terimler(mu.map((m, i) => (o.f[i] - m) / sd[i]), set));
  const W = ornekler.map((o) => (o.t === 1 ? 0.5 : 1));
  const wx = sirt(X, ornekler.map((o) => o.x), W, lambdaOran);
  const wy = sirt(X, ornekler.map((o) => o.y), W, lambdaOran);
  return wx && wy ? new Model(mu, sd, wx, wy, set) : null;
}

function sirt(X, y, w, lambdaOran = S.lambda) {
  const n = X[0].length;
  const m = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (let k = 0; k < X.length; k++) {
    const r = X[k], a = w[k];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) m[i][j] += a * r[i] * r[j];
      m[i][n] += a * r[i] * y[k];
    }
  }
  const lambda = lambdaOran * X.length;
  for (let i = 1; i < n; i++) m[i][i] += lambda;
  for (let p = 0; p < n; p++) {
    let en = p;
    for (let r = p + 1; r < n; r++) if (Math.abs(m[r][p]) > Math.abs(m[en][p])) en = r;
    [m[p], m[en]] = [m[en], m[p]];
    if (Math.abs(m[p][p]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === p) continue;
      const f = m[r][p] / m[p][p];
      for (let c = p; c <= n; c++) m[r][c] -= f * m[p][c];
    }
  }
  return Array.from({ length: n }, (_, i) => m[i][n] / m[i][i]);
}

// Izgara seçimi (Kotlin: IzgaraSecim)
const ADAYLAR = [[2, 3], [2, 4], [3, 3], [3, 4]];
const anahtarXY = (o) => Math.floor(o.x * 1000) * 10000 + Math.floor(o.y * 1000);

function degerlendir(ornekler, W, H) {
  const kal = ornekler.filter((o) => o.t === 0);
  const gruplar = new Map();
  for (const o of kal) { const a = anahtarXY(o); if (!gruplar.has(a)) gruplar.set(a, []); gruplar.get(a).push(o); }
  if (gruplar.size < 6) return null;
  const hatalar = [];
  for (const [a, grup] of gruplar) {
    const m = egit(ornekler.filter((o) => anahtarXY(o) !== a));
    if (!m) continue;
    for (let i = 0; i < grup.length; i += 5) {
      const parca = grup.slice(i, i + 5);
      let tx = 0, ty = 0;
      for (const o of parca) { const [x, y] = m.tahmin(o.f); tx += x; ty += y; }
      hatalar.push([tx / parca.length - parca[0].x, ty / parca.length - parca[0].y]);
    }
  }
  if (!hatalar.length) return null;
  const isabet = {};
  for (const [c, r] of ADAYLAR) isabet[`${c}x${r}`] = hatalar.filter(([ex, ey]) => Math.abs(ex) < 0.5 / c && Math.abs(ey) < 0.5 / r).length / hatalar.length;
  const px = hatalar.map(([ex, ey]) => Math.hypot(ex * W, ey * H)).sort((a, b) => a - b);
  return { isabet, hataPx: px.reduce((a, b) => a + b, 0) / px.length, ortancaPx: px[px.length >> 1] };
}

function izgaraSec(isabet) {
  const gecen = ADAYLAR.filter(([c, r]) => (isabet[`${c}x${r}`] ?? 0) >= 0.9);
  if (gecen.length) return gecen.reduce((a, b) => (b[0] * b[1] > a[0] * a[1] || (b[0] * b[1] === a[0] * a[1] && isabet[`${b[0]}x${b[1]}`] > isabet[`${a[0]}x${a[1]}`]) ? b : a));
  return ADAYLAR.reduce((a, b) => ((isabet[`${b[0]}x${b[1]}`] ?? 0) > (isabet[`${a[0]}x${a[1]}`] ?? 0) ? b : a));
}

// ------------------------------------------------------------------ profil
// t: 0 kalibrasyon, 1 kullanırken öğrenilen, 2 dokunarak düzeltme
const P = { ornekler: oku("gk-profil", []), model: null, deger: null, cols: 3, rows: 3, aralik: null, kayma: oku("gk-kayma", { x: 0, y: 0 }) };
// Sabit kayma düzeltmesi: tahmin − gerçek bakış farkının yürüyen ortalaması (ekranın oranı olarak).
function kaymaGuncelle(hataX, hataY, oran = S.kaymaHiz) {
  P.kayma.x = kis(P.kayma.x + hataX * oran, -0.5, 0.5);
  P.kayma.y = kis(P.kayma.y + hataY * oran, -0.5, 0.5);
  yaz("gk-kayma", P.kayma);
  profilCiz();
}
function kaymaSifirla() { P.kayma = { x: 0, y: 0 }; yaz("gk-kayma", P.kayma); profilCiz(); }

function profilKaydet() { yaz("gk-profil", P.ornekler); }

function profilEgit(degerlendirmeYap) {
  P.model = egit(P.ornekler);
  const u = P.ornekler.filter((o) => o.t === 0).map((o) => o.f[UZAKLIK]).sort((a, b) => a - b);
  P.aralik = u.length < 20 ? null : [u[Math.floor(u.length / 20)], u[u.length - 1 - Math.floor(u.length / 20)]];
  if (degerlendirmeYap) P.deger = P.model ? degerlendir(P.ornekler, innerWidth, innerHeight) : null;
  if (S.izgara !== "oto") [P.cols, P.rows] = S.izgara.split("x").map(Number);
  else if (P.deger) [P.cols, P.rows] = izgaraSec(P.deger.isabet);
  profilCiz();
}

function profilCiz() {
  const kal = P.ornekler.filter((o) => o.t === 0).length;
  const duz = P.ornekler.filter((o) => o.t === 2).length;
  if (!P.ornekler.length) { $("profilOzet").textContent = "Henüz kalibrasyon yok. Önce kalibre et."; $("izgaraTablo").innerHTML = ""; return; }
  const ar = P.aralik ? ` · uzaklık ${P.aralik[0].toFixed(0)}–${P.aralik[1].toFixed(0)} cm` : "";
  const ky = Math.round(P.kayma.x * innerWidth), kd = Math.round(P.kayma.y * innerHeight);
  $("profilOzet").textContent = `${kal} kalibrasyon + ${duz} düzeltme örneği · özellik: ${S.ozellik} λ${S.lambda}${ar} · seçili ızgara ${P.cols}×${P.rows}` +
    ` · kayma düzeltmesi ${ky} / ${kd} px` + (P.model ? "" : " · model eğitilemedi");
  if (!P.deger) { $("izgaraTablo").innerHTML = ""; return; }
  const d = P.deger;
  $("izgaraTablo").innerHTML = `<table><tr><th>Izgara</th>${ADAYLAR.map(([c, r]) => `<th>${c}×${r}</th>`).join("")}<th>Hata</th></tr>
    <tr><td>Kalibrasyon isabeti</td>${ADAYLAR.map(([c, r]) => { const v = d.isabet[`${c}x${r}`]; return `<td class="${v >= 0.9 ? "iyi" : v >= 0.75 ? "uyari" : "kotu"}">%${Math.round(v * 100)}</td>`; }).join("")}
    <td>${d.hataPx.toFixed(0)} px</td></tr></table>
    <p class="not">Her noktayı dışarıda bırakıp kalanlarla eğitilen modelin o noktadaki isabeti. Hata ≈ ${(d.hataPx * 0.159).toFixed(0)} mm.</p>`;
}

// ------------------------------------------------------------------ filtreler (Kotlin: OneEuro, HucreTakip)
class OneEuro {
  constructor() { this.ilk = true; }
  sifirla() { this.ilk = true; }
  filtre(v, t, kesim, beta) {
    if (this.ilk || t - this.t > 500 || t <= this.t) { this.ilk = false; this.x = v; this.dx = 0; this.t = t; return v; }
    const dt = (t - this.t) / 1000;
    this.t = t;
    const alfa = (k) => 1 / (1 + 1 / (2 * Math.PI * k) / dt);
    this.dx += ((v - this.x) / dt - this.dx) * alfa(1);
    this.x += (v - this.x) * alfa(kesim + beta * Math.abs(this.dx));
    return this.x;
  }
}

class HucreTakip {
  constructor(c, r) { this.cols = c; this.rows = r; this.sifirla(); }
  sifirla() { this.hucre = -1; this.aday = -1; this.basi = 0; }
  guncelle(x, y, t) {
    const i = kis(Math.floor(y * this.rows), 0, this.rows - 1) * this.cols + kis(Math.floor(x * this.cols), 0, this.cols - 1);
    if (this.hucre < 0) { this.hucre = i; this.basi = t; this.aday = -1; return i; }
    if (i === this.hucre) { this.aday = -1; return i; }
    if (i !== this.aday) { this.aday = i; this.adayBasi = t; }
    else if (t - this.adayBasi >= S.bolgeMs) { this.hucre = i; this.basi = t; this.aday = -1; }
    return this.hucre;
  }
}

// ------------------------------------------------------------------ kamera ve algılama
const video = $("video");
let yuzModeli = null;
let elModeli = null, elYukleniyor = false;
// El: işaret parmağı (imleç) ve iki parmak (kaydırma). Konum ekran oranı, aynalanmış (kullanıcının sağı = ekranın sağı).
const EL = { var: false, isaret: false, iki: false, yumruk: false, sonYumruk: 0, avuc: false, avucBasi: 0, cimdik: false, cimdikOlay: false, x: 0.5, y: 0.5, sonIsaret: 0, sonIki: 0, sonCimdik: 0, fx: new OneEuro(), fy: new OneEuro() };
function elGerekli() { return S.kontrol !== "goz" || S.tikYontem === "cimdik" || !!aktif?.elIster; }
async function elYukle() {
  if (elModeli || elYukleniyor) return;
  elYukleniyor = true;
  try {
    const dosyalar = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    elModeli = await HandLandmarker.createFromOptions(dosyalar, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: S.gpu === "gpu" ? "GPU" : "CPU" },
      runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
    });
  } catch (e) { $("kameraNot").textContent = "El modeli yüklenemedi: " + (e?.message || e); }
  elYukleniyor = false;
}
function elIsle(t) {
  if (!elModeli) { elYukle(); return; }
  let r;
  try { r = elModeli.detectForVideo(video, t); } catch { return; }
  const lm = r.landmarks?.[0];
  EL.cimdikOlay = false; EL.cimdikBirak = false;
  if (!lm) {
    if (EL.cimdik) { EL.cimdikBirak = true; EL.cimdikSure = t - EL.cimdikBasT; }
    EL.var = EL.isaret = EL.iki = EL.cimdik = EL.avuc = EL.surukle = EL.yumruk = false; EL.avucBasi = 0; return;
  }
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  const acik = (uc, eklem) => d(uc, 0) > d(eklem, 0) * 1.15;
  const isaret = acik(8, 6), orta = acik(12, 10), yuzuk = acik(16, 14), serce = acik(20, 18);
  EL.var = true;
  // Açık avuç: dört parmak açık (geri hareketi için)
  EL.avuc = isaret && orta && yuzuk && serce && d(4, 8) / Math.max(1e-3, d(0, 9)) > 0.5;
  if (EL.avuc) { if (!EL.avucBasi) EL.avucBasi = t; } else EL.avucBasi = 0;
  // Çimdik: başparmak ucu ile işaret ucu birleşti (el boyuna göre). Açılıp kapanmada titreşmesin diye iki eşik.
  const boy = Math.max(1e-3, d(0, 9)), aralik = d(4, 8) / boy;
  const oncekiCimdik = EL.cimdik;
  EL.cimdik = !orta && !yuzuk && !serce && (oncekiCimdik ? aralik < 0.45 : aralik < 0.28);
  EL.iki = !EL.cimdik && isaret && orta && !yuzuk && !serce;
  EL.isaret = EL.cimdik || (isaret && !orta && !yuzuk && !serce);
  // Yumruk: dört parmak da kapalı (çimdik değilken)
  EL.yumruk = !EL.cimdik && !isaret && !orta && !yuzuk && !serce;
  if (EL.yumruk) EL.sonYumruk = t;
  // Takip noktası: yumrukta orta parmak kökü (sabit), çimdikte iki ucun ortası, iki parmakta uçların ortası, yoksa işaret ucu
  const [ux, uy] = EL.yumruk ? [lm[9].x, lm[9].y] : EL.cimdik ? [(lm[4].x + lm[8].x) / 2, (lm[4].y + lm[8].y) / 2]
    : EL.iki ? [(lm[8].x + lm[12].x) / 2, (lm[8].y + lm[12].y) / 2] : [lm[8].x, lm[8].y];
  EL.x = EL.fx.filtre(1 - ux, t, 2, 0.5);
  EL.y = EL.fy.filtre(uy, t, 2, 0.5);
  if (EL.cimdik && !oncekiCimdik) {
    EL.cimdikBasX = EL.x; EL.cimdikBasY = EL.y; EL.cimdikBasT = t; EL.suruklendi = false;
    if (t - EL.sonCimdik > 400) { EL.cimdikOlay = true; EL.sonCimdik = t; }
  }
  if (EL.cimdik && Math.hypot(EL.x - EL.cimdikBasX, EL.y - EL.cimdikBasY) > 0.03) EL.suruklendi = true;
  EL.surukle = EL.cimdik && EL.suruklendi;
  if (!EL.cimdik && oncekiCimdik) { EL.cimdikBirak = true; EL.cimdikSure = t - EL.cimdikBasT; }
  if (EL.isaret) EL.sonIsaret = t;
  if (EL.iki) EL.sonIki = t;
}
let akim = null;

async function modelYukle() {
  $("surum").textContent = "model yükleniyor…";
  try {
    const dosyalar = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    const eski = yuzModeli;
    yuzModeli = null;
    eski?.close();
    yuzModeli = await FaceLandmarker.createFromOptions(dosyalar, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: S.gpu === "gpu" ? "GPU" : "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    $("surum").textContent = `${SURUM} · ${S.gpu === "gpu" ? "GPU" : "CPU"}`;
    $("bKamera").disabled = false;
  } catch (e) {
    $("surum").textContent = "model yüklenemedi";
    $("kameraNot").textContent = "Yüz modeli yüklenemedi: " + (e?.message || e) + ". GPU seçiliyse CPU'ya geçip sayfayı yenile.";
  }
}

async function kameraBaslat() {
  try {
    akim = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video.srcObject = akim;
    await video.play();
    $("bKamera").textContent = "Kamera açık";
    $("bKamera").disabled = true;
    for (const b of ["bKalibre", "bCanli", "bIsabet", "bKilitTest", "bDokunKal", "bDokunEkle", "bParmakTest", "bTelefonTest"]) $(b).disabled = false;
    requestAnimationFrame(dongu);
  } catch (e) {
    $("kameraNot").textContent = "Kamera açılamadı: " + (e?.message || e) + ". Tarayıcıya kamera izni verip tekrar dene.";
  }
}

const isikTuval = document.createElement("canvas");
isikTuval.width = 16; isikTuval.height = 12;
const isikCtx = isikTuval.getContext("2d", { willReadFrequently: true });
let sonKareZamani = 0;
let isik = 0, kareSay = 0, sonVideoZaman = -1, fpsSay = 0, fpsBasi = performance.now(), fps = 0, algilamaMs = 0;

function dongu() {
  requestAnimationFrame(dongu);
  if (!yuzModeli || video.readyState < 2 || video.currentTime === sonVideoZaman) return;
  sonVideoZaman = video.currentTime;
  const t = performance.now();
  sonKareZamani = t;
  let r;
  try { r = yuzModeli.detectForVideo(video, t); } catch { return; }
  algilamaMs = algilamaMs * 0.9 + (performance.now() - t) * 0.1;
  if (++kareSay % 10 === 0) {
    isikCtx.drawImage(video, 0, 0, 16, 12);
    const d = isikCtx.getImageData(0, 0, 16, 12).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    isik = s / (d.length / 4);
  }
  fpsSay++;
  if (t - fpsBasi > 1000) { fps = (fpsSay * 1000) / (t - fpsBasi); fpsSay = 0; fpsBasi = t; durumCiz(); }
  const k = cikar(r, video.videoWidth, video.videoHeight, t);
  k.guvenilir = guvenilirMi(k);
  if (k.f && k.guvenilir) { gecmis.push({ t, f: k.f.slice() }); while (gecmis.length && t - gecmis[0].t > 1500) gecmis.shift(); }
  tahminGuncelle(k);
  if (elGerekli()) elIsle(t); else EL.var = EL.isaret = EL.iki = false;
  sonKare = k;
  aktif?.kare?.(k, t);
}
let sonKare = null;
const gecmis = [];

// Chrome, sayfadan çıkıp dönünce (ekran kaydı, bildirim, uygulama değişimi) kamerayı duraklatabilir:
// geri dönünce devam ettir, kamera kapandıysa yeniden aç.
async function kameraCanlandir() {
  if (!akim) return;
  const iz = akim.getVideoTracks()[0];
  if (!iz || iz.readyState === "ended") {
    try { akim.getTracks().forEach((x) => x.stop()); } catch {}
    try {
      akim = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      video.srcObject = akim;
    } catch (e) { $("kameraNot").textContent = "Kamera yeniden açılamadı: " + (e?.message || e); return; }
  }
  if (video.paused) video.play().catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") kameraCanlandir(); });
setInterval(() => { if (akim && document.visibilityState === "visible" && performance.now() - sonKareZamani > 1500) kameraCanlandir(); }, 1000);
const kameraDurdu = () => akim && performance.now() - sonKareZamani > 1500;

// Kotlin: Algilayici.isle
function cikar(r, w, h, t) {
  const k = { t, yuz: false, f: null, s: { sol: 0, sag: 0, bakisX: 0, bakisY: 0, donus: 0, egim: 0 } };
  if (!r.faceLandmarks?.length) return k;
  k.yuz = true;
  const lm = r.faceLandmarks[0];
  const bs = {};
  for (const c of r.faceBlendshapes?.[0]?.categories ?? []) bs[c.categoryName] = c.score;
  const g = (a) => bs[a] ?? 0;
  const s = k.s;
  s.sol = g("eyeBlinkLeft"); s.sag = g("eyeBlinkRight");
  s.bakisX = (g("eyeLookOutRight") + g("eyeLookInLeft") - g("eyeLookOutLeft") - g("eyeLookInRight")) / 2;
  s.bakisY = (g("eyeLookUpLeft") + g("eyeLookUpRight") - g("eyeLookDownLeft") - g("eyeLookDownRight")) / 2;
  const M = r.facialTransformationMatrixes?.[0]?.data;
  if (!M || lm.length < 478) return k;
  s.egim = -deg(Math.atan2(M[6], M[10]));
  s.donus = deg(Math.asin(kis(-M[2], -1, 1)));

  const goz = (a, b, m) => {
    const ax = lm[a].x * w, ay = lm[a].y * h, dx = lm[b].x * w - ax, dy = lm[b].y * h - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return [0.5, 0];
    const vx = lm[m].x * w - ax, vy = lm[m].y * h - ay;
    return [(vx * dx + vy * dy) / l2, (vx * dy - vy * dx) / l2];
  };
  const kapakOran = (a, b, ust, alt, m) => {
    const ax = lm[a].x * w, ay = lm[a].y * h, dx = lm[b].x * w - ax, dy = lm[b].y * h - ay;
    const l = Math.hypot(dx, dy);
    if (l < 1e-3) return null;
    const dik = (i) => ((lm[i].x * w - ax) * dy - (lm[i].y * h - ay) * dx) / l;
    const u = dik(ust), d = dik(alt);
    if (Math.abs(d - u) < l * 0.08) return null;
    return (dik(m) - u) / (d - u);
  };
  const sg = goz(33, 133, 468), sl = goz(362, 263, 473);
  const ks = kapakOran(33, 133, 159, 145, 468), kl = kapakOran(362, 263, 386, 374, 473);
  // Kapak ölçülemiyorsa (göz kapalı) bu karenin göz ölçümü güvenilmez: hiç kullanma.
  if (ks == null && kl == null) return k;
  const kapak = ks != null && kl != null ? (ks + kl) / 2 : ks ?? kl;
  k.f = [(sg[0] + sl[0]) / 2, (sg[1] + sl[1]) / 2, s.bakisX, s.bakisY, s.donus, s.egim, M[12], M[13], -M[14], kapak];
  return k;
}

function durumCiz() {
  const k = sonKare;
  $("cYuz").textContent = k?.f ? "Net" : k?.yuz ? "Kısmi" : "Yok";
  $("cYuz").className = k?.f ? "iyi" : "uyari";
  $("cFps").textContent = fps.toFixed(0);
  $("cFps").className = fps >= 24 ? "iyi" : fps >= 15 ? "uyari" : "kotu";
  $("cMs").textContent = algilamaMs.toFixed(0) + " ms";
  const u = k?.f?.[UZAKLIK];
  $("cUz").textContent = u ? `~${u.toFixed(0)} cm` : "–";
  $("cUz").className = u && uzaklikDurumu(u) !== 0 ? "uyari" : "";
  $("cIsik").textContent = isik.toFixed(0);
  $("cIsik").className = isik >= 45 && isik <= 215 ? "iyi" : "uyari";
}

function uzaklikDurumu(u) {
  if (!P.aralik) return 0;
  return u < P.aralik[0] * 0.9 ? -1 : u > P.aralik[1] * 1.1 ? 1 : 0;
}

// ------------------------------------------------------------------ bakış tahmini (Kotlin: Izgara.tahminGuncelle)
const G = { x: 0.5, y: 0.5, hamX: 0.5, hamY: 0.5, gecerli: false, sonOz: [] };
const fX = new OneEuro(), fY = new OneEuro();

function kirpiyor(s) {
  const asagi = kis(-s.bakisY, 0, 1);
  return Math.max(s.sol, s.sag) > Math.min(S.kirpTaban + S.kirpEgim * asagi, S.kirpTavan);
}

// Kırpma durumu: kişinin açık göz kırpma puanı (taban) yavaşça takip edilir.
const K = { taban: NaN, son: -1e9 };
function guvenilirMi(k) {
  if (!k.f) { K.son = k.t; return false; }
  const m = Math.max(k.s.sol, k.s.sag);
  const goreli = S.kirpGoreli > 0 && !Number.isNaN(K.taban) && m > K.taban + S.kirpGoreli;
  if (kirpiyor(k.s) || goreli) { K.son = k.t; return false; }
  K.taban = Number.isNaN(K.taban) ? m : K.taban + (m - K.taban) * 0.05;
  return k.t - K.son >= S.kirpSonrasi;
}

const aday = { x: 0, y: 0, n: 0 };
function tahminGuncelle(k) {
  if (!P.model || !k.f) { if (!P.model) G.gecerli = false; return; }
  if (!k.guvenilir) return;
  let [px, py] = P.model.tahmin(k.f);
  px -= P.kayma.x; py -= P.kayma.y;
  G.hamX = px; G.hamY = py;
  // Sıçrama süzgeci: büyük ani sıçrama ancak sonraki karelerde de aynı yerde kalırsa kabul edilir.
  // Ardışık karelerin birbirine yakın olması şart değil (doğal titreme bunu bozar):
  // uzakta kalmaya devam etmesi yeterli. Kırpmadaki 1–2 karelik sıçrama geri döndüğü için elenir.
  if (G.gecerli && S.sicramaKare > 0 && Math.hypot(px - G.x, py - G.y) > S.sicramaEsik) {
    aday.n++;
    if (aday.n <= S.sicramaKare) return;
    fX.sifirla(); fY.sifirla();
  }
  aday.n = 0;
  if (!G.gecerli) { fX.sifirla(); fY.sifirla(); }
  G.x = kis(fX.filtre(px, k.t, S.kesim, S.beta), 0, 0.999);
  G.y = kis(fY.filtre(py, k.t, S.kesim, S.beta), 0, 0.999);
  G.gecerli = true;
  G.sonOz.push(k.f.slice());
  if (G.sonOz.length > 6) G.sonOz.shift();
}

// ------------------------------------------------------------------ sahne
const sahne = $("sahne"), tuval = $("tuval"), ctx = tuval.getContext("2d");
let aktif = null, W = innerWidth, H = innerHeight;

function boyutla() {
  W = innerWidth; H = innerHeight;
  const dpr = devicePixelRatio || 1;
  tuval.width = Math.round(W * dpr); tuval.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", () => { if (aktif) boyutla(); });

function sahneAc(h) {
  aktif = h;
  sahne.hidden = false;
  navigator.wakeLock?.request("screen").then((k) => { h.uyanik = k; }).catch(() => {});
  boyutla();
  hud("", "", "");
  hudUst.style.visibility = hudAltEl.style.visibility = "visible";
  dugmeler([]);
  $("bekleKutu").hidden = true;
  h.ac?.();
  requestAnimationFrame(cizDongu);
}

function sahneKapat() {
  const h = aktif;
  aktif = null;
  h?.kapat?.();
  h?.uyanik?.release?.().catch(() => {});
  sahne.hidden = true;
}

function cizDongu(t) {
  if (!aktif) return;
  ctx.clearRect(0, 0, W, H);
  aktif.ciz?.(t);
  if (kameraDurdu()) {
    ctx.fillStyle = "rgba(255,138,76,.95)"; ctx.font = "700 16px system-ui"; ctx.textAlign = "center";
    ctx.fillText("Kamera görüntüsü gelmiyor · yeniden başlatılıyor", W / 2, H / 2 - 80);
    ctx.textAlign = "start";
  }
  requestAnimationFrame(cizDongu);
}

// Hedef yazıların ya da düğmelerin altına düşerse o yazılar o an gizlenir (dokunma da hedefe gider).
const hudUst = document.querySelector(".hud.ust"), hudAltEl = document.querySelector(".hud.alt");
function hudKacin(noktalar) {
  const pay = 40;
  for (const el of [hudUst, hudAltEl]) {
    el.style.visibility = "visible";
    const r = el.getBoundingClientRect();
    const cakisiyor = noktalar.some(([x, y]) => y > r.top - pay && y < r.bottom + pay);
    el.style.visibility = cakisiyor ? "hidden" : "visible";
  }
}

function hud(baslik, alt, bilgi) {
  if (baslik !== null) $("hudBaslik").textContent = baslik;
  if (alt !== null) $("hudAlt").textContent = alt;
  if (bilgi !== null) { $("hudBilgi").textContent = bilgi; $("hudBilgiKutu").hidden = !bilgi; }
}

function dugmeler(liste) {
  // Bitiş ekranları düğme koyar: gizlenmiş yazıları geri getir.
  hudUst.style.visibility = hudAltEl.style.visibility = "visible";
  const kap = $("hudDugmeler");
  kap.innerHTML = "";
  for (const [ad, fn, ana] of [...liste, ["Çık", sahneKapat]]) {
    const b = document.createElement("button");
    b.className = "btn" + (ana ? " ana" : "");
    b.textContent = ad;
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    kap.appendChild(b);
  }
}

tuval.addEventListener("pointerdown", () => aktif?.bas?.());
tuval.addEventListener("pointerup", (e) => aktif?.dokun?.(e.clientX / W, e.clientY / H));

// çizim yardımcıları
const RENK = { vurgu: "#ffc24b", mavi: "#5aa2ff", iyi: "#4ade80", uyari: "#ff8a4c", cizgi: "rgba(255,255,255,.16)", yazi: "#e8edf3" };
function daire(x, y, r, dolgu, kenar, kalinlik = 2) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (dolgu) { ctx.fillStyle = dolgu; ctx.fill(); }
  if (kenar) { ctx.strokeStyle = kenar; ctx.lineWidth = kalinlik; ctx.stroke(); }
}
function izgaraCiz(cols, rows, hucre, renk = RENK.cizgi) {
  ctx.strokeStyle = renk; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]);
  ctx.beginPath();
  for (let i = 1; i < cols; i++) { ctx.moveTo((W * i) / cols, 0); ctx.lineTo((W * i) / cols, H); }
  for (let i = 1; i < rows; i++) { ctx.moveTo(0, (H * i) / rows); ctx.lineTo(W, (H * i) / rows); }
  ctx.stroke(); ctx.setLineDash([]);
  if (hucre >= 0) {
    const c = hucre % cols, r = Math.floor(hucre / cols);
    ctx.fillStyle = "rgba(255,194,75,.14)";
    ctx.fillRect((c * W) / cols, (r * H) / rows, W / cols, H / rows);
    ctx.strokeStyle = RENK.vurgu; ctx.lineWidth = 3;
    ctx.strokeRect((c * W) / cols + 2, (r * H) / rows + 2, W / cols - 4, H / rows - 4);
  }
}
function imlecCiz(x, y, kilitli, ilerleme, parmak = false) {
  daire(x, y, 22, parmak ? "rgba(90,162,255,.2)" : "rgba(255,194,75,.18)", kilitli ? RENK.iyi : parmak ? RENK.mavi : RENK.vurgu, 3);
  if (kilitli) {
    ctx.strokeStyle = RENK.iyi; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.moveTo(x - 18, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 18, y);
    ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 18); ctx.stroke();
  } else daire(x, y, 3, RENK.vurgu);
  if (ilerleme > 0) {
    ctx.beginPath(); ctx.arc(x, y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ilerleme));
    ctx.strokeStyle = RENK.yazi; ctx.lineWidth = 3; ctx.stroke();
  }
}

// ------------------------------------------------------------------ imleç motoru (Kotlin: Motor.imleciIsle + Izgara)
// Lab'da tıklama "bakıp bekle" ile yapılır; uygulamadaki hareketle tıklamanın yerine geçer.
// Kotlin: KontrolServisi.yakinButon — merkezi en yakın hedef; iki aday neredeyse eşitse yapışma.
function yakinHedef(x, y, liste) {
  const ad = liste.filter((h) => Math.max(0, Math.hypot(h.x - x, h.y - y) - h.r) <= 70)
    .map((h) => [h, Math.hypot(h.x - x, h.y - y)]).sort((a, b) => a[1] - b[1]);
  if (!ad.length) return null;
  if (ad.length >= 2 && ad[0][1] > 10 && ad[1][1] < ad[0][1] * 1.5) return null;
  return ad[0][1] < 90 ? ad[0][0] : null;
}

function imlecMotoru(hedefler = () => []) {
  const m = {
    x: W / 2, y: H / 2, kilitli: false, ilerleme: 0, asama: 1, zoom: null,
    takip: new HucreTakip(P.cols, P.rows),
    basD: NaN, basE: 0, refD: 0, refE: 0, kilitX: 0, kilitY: 0,
    sabitX: -1e4, sabitY: -1e4, sabitBasi: 0, uzakBasi: 0, secili: null, hazir: true,
    bekleX: -1e4, bekleY: -1e4, bekleBasi: 0, tetik: false, sonTik: -1e9,
  };
  const miknatis = (x, y) => {
    const h = S.miknatis === "acik" ? yakinHedef(x, y, hedefler()) : null;
    return h ? [h.x, h.y] : [x, y];
  };
  m.kilitBirak = () => { m.kilitli = false; m.sabitX = -1e4; m.uzakBasi = 0; m.secili = null; };
  m.zoomBitir = () => { m.asama = 1; m.zoom = null; m.takip.sifirla(); };

  /** @returns {x,y} tıklama olduysa */
  m.guncelle = (k, t) => {
    const mod = $("aMod").value;
    // Gözleri kapatıp açarak tıklama: göz kapalıyken imleç donuk olduğu için tıklama imlecin olduğu yere gider
    let kapamaTik = false;
    if (S.tikYontem === "kapat" && k.yuz) {
      const kapali = Math.min(k.s.sol, k.s.sag) > 0.5;
      if (kapali) { if (!m.kapaliBasi) m.kapaliBasi = t; m.kapaIlerleme = (t - m.kapaliBasi) / S.tikKapatMs; }
      else {
        const sure = m.kapaliBasi ? t - m.kapaliBasi : 0;
        kapamaTik = sure >= S.tikKapatMs && sure < 2500 && t - m.sonTik >= S.tikAra;
        m.kapaliBasi = 0; m.kapaIlerleme = 0;
      }
    }
    // Parmak: sadece parmak modunda her zaman, göz + parmakta işaret parmağı kalkınca imleci parmak yönetir
    if (S.kontrol !== "goz") parmakGuncelle(t);
    // Çimdik: tıklama, parmaklar birleşmeye başlamadan önceki imleç yerine gider
    let cimdikTik = null;
    if (S.tikYontem === "cimdik") {
      m.gecmis = m.gecmis || [];
      m.gecmis.push({ t, x: m.x, y: m.y });
      while (m.gecmis.length && t - m.gecmis[0].t > 400) m.gecmis.shift();
      if (EL.cimdikOlay) { const once = m.gecmis.find((g) => g.t >= t - 200) || { x: m.x, y: m.y }; m.cimdikYer = { x: once.x, y: once.y }; }
      // Çimdikle sürükleme açıksa tıklama bırakınca olur (kısa ve hareketsiz çimdik = tıklama, hareketli = kaydırma)
      const birakta = S.kaydirModu === "cimdik";
      if (m.cimdikYer && t - m.sonTik >= S.tikAra &&
        (birakta ? EL.cimdikBirak && !EL.suruklendi && EL.cimdikSure < 700 : EL.cimdikOlay)) {
        cimdikTik = { ...m.cimdikYer }; m.sonTik = t;
      }
      if (EL.cimdik && m.cimdikYer) { m.x = m.cimdikYer.x; m.y = m.cimdikYer.y; }
      if (!EL.cimdik && !EL.cimdikBirak) m.cimdikYer = null;
    }
    if (cimdikTik) { if (m.kilitli) m.kilitBirak(); return cimdikTik; }
    if (m.parmakAktif) {
      if (kapamaTik) { m.sonTik = t; return { x: m.x, y: m.y }; }
      return bekleTik(t, S.bekleEsik, S.bekleTikMs);
    }
    if (S.kontrol === "parmak") { m.ilerleme = 0; return null; }
    if (mod === "izgara") return G.gecerli ? izgaraIsle(t, kapamaTik) : null;
    if (kapamaTik && G.gecerli && (mod !== "kilit" || m.kilitli)) {
      m.sonTik = t;
      const tik = { x: m.x, y: m.y };
      if (mod === "kilit") m.kilitBirak();
      return tik;
    }
    if (!G.gecerli || !k.f || !k.guvenilir) return null;
    const gx = G.x * W, gy = G.y * H;

    // baş açısı yumuşatma
    if (Number.isNaN(m.basD)) { m.basD = k.s.donus; m.basE = k.s.egim; }
    m.basD += (k.s.donus - m.basD) * 0.35;
    m.basE += (k.s.egim - m.basE) * 0.35;

    if (mod === "goz") { [m.x, m.y] = miknatis(gx, gy); }
    else if (!m.kilitli) {
      m.x = gx; m.y = gy; // kilitte mıknatıs yok: aday seçimini kilit kendisi yapar
      if (Math.hypot(gx - m.sabitX, gy - m.sabitY) > S.kilitYaricap) { m.sabitX = gx; m.sabitY = gy; m.sabitBasi = t; }
      else if (t - m.sabitBasi >= S.kilitSabitMs) {
        m.kilitli = true; m.kilitX = m.x; m.kilitY = m.y; m.refD = m.basD; m.refE = m.basE; m.uzakBasi = 0; m.hazir = true;
        // Atlamalı kilit: yakında hedef varsa bakışa en yakın olanın tam ortasına otur
        const yakin = hedefler().filter((h) => Math.hypot(h.x - gx, h.y - gy) < S.atlaYaricap).sort((a, b) => Math.hypot(a.x - gx, a.y - gy) - Math.hypot(b.x - gx, b.y - gy));
        m.secili = yakin[0] || null;
        if (m.secili) { m.x = m.secili.x; m.y = m.secili.y; }
        m.bekleX = m.x; m.bekleY = m.y; m.bekleBasi = t; m.tetik = false;
      }
    } else if (m.secili) {
      // Baş küçük bir hareketle bir yöne çevrilip geri gelince o yöndeki komşu hedefe atla
      const sx = S.basTersX === "ters" ? 1 : -1, sy = S.basTersY === "ters" ? 1 : -1;
      const vx = sx * (m.basD - m.refD), vy = sy * (m.basE - m.refE), v = Math.hypot(vx, vy);
      if (m.hazir && v > S.atlaEsik) {
        const ux = vx / v, uy = vy / v, s0 = m.secili;
        const komsu = hedefler().filter((h) => h !== s0).map((h) => {
          const dx = h.x - s0.x, dy = h.y - s0.y, d = Math.hypot(dx, dy);
          return { h, d, cos: d ? (dx * ux + dy * uy) / d : -1 };
        }).filter((o) => o.cos > 0.5 && o.d < S.atlaYaricap * 2).sort((a, b) => a.d / a.cos - b.d / b.cos)[0];
        if (komsu) { m.secili = komsu.h; m.bekleX = -1e4; }
        m.hazir = false;
      } else if (!m.hazir && v < S.atlaEsik * 0.4) m.hazir = true;
      m.x = m.secili.x; m.y = m.secili.y;
      if (Math.hypot(gx - m.x, gy - m.y) > S.kilitCikis + S.atlaYaricap) {
        if (!m.uzakBasi) m.uzakBasi = t;
        if (t - m.uzakBasi >= 350) { m.kilitBirak(); m.x = gx; m.y = gy; }
      } else m.uzakBasi = 0;
    } else {
      const olu = (v) => (Math.abs(v) < S.kilitOlu ? 0 : v - Math.sign(v) * S.kilitOlu);
      const sx = S.basTersX === "ters" ? 1 : -1, sy = S.basTersY === "ters" ? 1 : -1;
      m.x = kis(m.kilitX + sx * olu(m.basD - m.refD) * S.kilitKazanc, 0, W - 1);
      m.y = kis(m.kilitY + sy * olu(m.basE - m.refE) * S.kilitKazanc, 0, H - 1);
      if (Math.hypot(gx - m.x, gy - m.y) > S.kilitCikis) {
        if (!m.uzakBasi) m.uzakBasi = t;
        if (t - m.uzakBasi >= 350) { m.kilitBirak(); m.x = gx; m.y = gy; }
      } else m.uzakBasi = 0;
    }

    if (mod === "kilit" && !m.kilitli) { m.ilerleme = 0; return null; }
    return bekleTik(t, mod === "kilit" ? 8 : S.bekleEsik, mod === "kilit" ? S.kilitTikMs : S.bekleTikMs);
  };

  // bakıp bekle tıklaması
  function bekleTik(t, esik, sure) {
    const mod = $("aMod").value;
    m.ilerleme = 0;
    if (S.tikYontem !== "bekle") return null;
    if (t - m.sonTik < S.tikAra) { m.bekleX = m.x; m.bekleY = m.y; m.bekleBasi = t; return null; }
    if (Math.hypot(m.x - m.bekleX, m.y - m.bekleY) > esik) { m.bekleX = m.x; m.bekleY = m.y; m.bekleBasi = t; m.tetik = false; }
    else if (!m.tetik) {
      m.ilerleme = (t - m.bekleBasi) / sure;
      if (m.ilerleme >= 1) {
        m.tetik = true; m.ilerleme = 0; m.sonTik = t;
        const tik = { x: m.x, y: m.y };
        if (mod === "kilit") m.kilitBirak();
        return tik;
      }
    }
    return null;
  }

  function parmakGuncelle(t) {
    if (!EL.isaret) {
      // Model eli kısa süre kaçırabilir: 400 ms içinde dönerse kaldığı yerden devam
      if (m.parmakAktif && t - EL.sonIsaret > 400) { m.parmakAktif = false; m.bekleX = -1e4; }
      return;
    }
    if (S.kontrol === "parmak") {
      const a0 = 0.5 - S.elAlan / 2;
      m.x = kis(((EL.x - a0) / S.elAlan) * W, 0, W - 1);
      m.y = kis(((EL.y - a0) / S.elAlan) * H, 0, H - 1);
      m.parmakAktif = true;
      return;
    }
    if (!m.parmakAktif) {
      // Göz + parmak: imlecin o anki yerinden başla (göz ya da kilit)
      m.parmakAktif = true;
      m.pBasX = EL.x; m.pBasY = EL.y;
      m.pAncX = m.kilitli || !G.gecerli ? m.x : G.x * W;
      m.pAncY = m.kilitli || !G.gecerli ? m.y : G.y * H;
      m.kilitBirak();
      m.bekleX = -1e4;
    }
    m.x = kis(m.pAncX + (EL.x - m.pBasX) * S.parmakHassas * W, 0, W - 1);
    m.y = kis(m.pAncY + (EL.y - m.pBasY) * S.parmakHassas * W, 0, H - 1);
  }

  // Izgara: 1. aşamada bölge, içinde tek hedef varsa tıkla, yoksa yakınlaştır; 2. aşamada alt bölgeye tıkla.
  function izgaraIsle(t, kapamaTik) {
    const tk = m.takip;
    if (tk.cols !== P.cols || tk.rows !== P.rows) { tk.cols = P.cols; tk.rows = P.rows; tk.sifirla(); }
    const h = tk.guncelle(G.x, G.y, t);
    if (S.tikYontem === "kapat") {
      m.ilerleme = 0;
      if (!kapamaTik || h < 0) return null;
      m.sonTik = t;
    } else {
      m.ilerleme = (t - tk.basi) / S.bekleTikMs;
      if (m.ilerleme < 1) return null;
      m.ilerleme = 0;
    }
    const c = h % tk.cols, r = Math.floor(h / tk.cols);
    if (m.asama === 1) {
      const alan = { x: (c * W) / tk.cols, y: (r * H) / tk.rows, w: W / tk.cols, h: H / tk.rows };
      const icinde = hedefler().filter((d) => d.x >= alan.x && d.x < alan.x + alan.w && d.y >= alan.y && d.y < alan.y + alan.h);
      tk.sifirla();
      if (icinde.length === 1) return { x: icinde[0].x, y: icinde[0].y };
      m.asama = 2; m.zoom = alan;
      return null;
    }
    const z = m.zoom;
    const alt = { x: z.x + (c * z.w) / tk.cols, y: z.y + (r * z.h) / tk.rows, w: z.w / tk.cols, h: z.h / tk.rows };
    // Uygulamadaki "en iyi nokta": alt bölgeye değen hedefin merkezi, yoksa bölgenin ortası
    const deg = hedefler().find((d) => d.x + d.r > alt.x && d.x - d.r < alt.x + alt.w && d.y + d.r > alt.y && d.y - d.r < alt.y + alt.h);
    m.zoomBitir();
    return deg ? { x: deg.x, y: deg.y } : { x: alt.x + alt.w / 2, y: alt.y + alt.h / 2 };
  }

  /** Hedefleri ve imleci çizer; izgara 2. aşamada hedefleri büyütülmüş gösterir. */
  m.ciz = (hedefCiz) => {
    const mod = $("aMod").value;
    if (m.parmakAktif) { hedefCiz?.(1); imlecCiz(m.x, m.y, false, m.ilerleme, true); return; }
    if (S.kontrol === "parmak") { hedefCiz?.(1); return; }
    if (mod === "izgara") {
      if (m.asama === 2 && m.zoom) {
        const z = m.zoom;
        ctx.save();
        ctx.scale(W / z.w, H / z.h); ctx.translate(-z.x, -z.y);
        hedefCiz?.(z.w / W);
        ctx.restore();
      } else hedefCiz?.(1);
      if (G.gecerli) izgaraCiz(m.takip.cols, m.takip.rows, m.takip.hucre);
      if (m.takip.hucre >= 0 && m.ilerleme > 0) {
        const c = m.takip.hucre % m.takip.cols, r = Math.floor(m.takip.hucre / m.takip.cols);
        imlecCiz(((c + 0.5) * W) / m.takip.cols, ((r + 0.5) * H) / m.takip.rows, false, m.ilerleme);
      }
      return;
    }
    hedefCiz?.(1);
    if (G.gecerli) imlecCiz(m.x, m.y, mod === "kilit" && m.kilitli, m.ilerleme);
  };
  return m;
}

// ------------------------------------------------------------------ kalibrasyon (Kotlin: KalibrasyonActivity)
function kalibrasyon() {
  const k4 = [0.1, 0.37, 0.63, 0.9];
  const tum = k4.flatMap((y, r) => (r % 2 === 0 ? k4 : [...k4].reverse()).map((x) => [x, y]));
  const dama = tum.filter(([x, y]) => (k4.indexOf(x) + k4.indexOf(y)) % 2 === 0);
  const asamali = S.uzaklikAsama === "acik";
  const noktalar = asamali ? [...tum, ...dama, ...[...dama].reverse()] : tum;
  const normalSon = 16, yakinSon = asamali ? 24 : 16;
  const durum = { sira: -1, basi: performance.now(), bekleme: 0, uygunBasi: 0, toplanan: [], nTop: 0, nSay: 0, sonU: 0 };

  function bekleBasla(tur) {
    durum.bekleme = tur; durum.uygunBasi = 0;
    $("bekleKutu").hidden = false;
    $("bekleBaslik").textContent = tur === 1 ? "Telefonu yüzüne yaklaştır" : "Telefonu yüzünden uzaklaştır";
  }
  function atla() {
    const sonraki = durum.bekleme === 1 ? yakinSon : noktalar.length;
    durum.bekleme = 0; $("bekleKutu").hidden = true;
    durum.sira = sonraki; durum.basi = performance.now();
    if (durum.sira >= noktalar.length) bitir(); else bekleBasla(2);
  }
  function bitir() {
    durum.sira = noktalar.length;
    if (durum.toplanan.length < 20) { hud("Yeterli ölçüm alınamadı", "Yüzünün göründüğünden emin olup tekrar dene.", ""); return; }
    P.ornekler = durum.toplanan;
    kaymaSifirla();
    profilKaydet();
    hud("Model eğitiliyor…", "", "");
    setTimeout(() => {
      profilEgit(true);
      const d = P.deger;
      hud("Kalibrasyon bitti", d ? `Kalibrasyon hatası ≈ ${d.hataPx.toFixed(0)} px (${(d.hataPx * 0.159).toFixed(0)} mm) · ızgara ${P.cols}×${P.rows}` : "", "");
      dugmeler([["Canlı bakışa geç", () => { sahneKapat(); sahneAc(canli()); }, true]]);
    }, 50);
  }
  $("bAtla").onclick = atla;

  return {
    ac() { hud("Akıllı kalibrasyon", "Sarı noktaya bak · başını sabit tut", ""); },
    kare(k, t) {
      if (k.f) durum.sonU = k.f[UZAKLIK];
      if (durum.sira < 0 || durum.sira >= noktalar.length || !k.yuz || durum.bekleme) return;
      if (t - durum.basi < S.toplamaBasi || !k.guvenilir || !k.f) return;
      const [x, y] = noktalar[durum.sira];
      durum.toplanan.push({ f: k.f.slice(), x, y, t: 0 });
      if (durum.sira < normalSon) { durum.nTop += k.f[UZAKLIK]; durum.nSay++; }
    },
    ciz(t) {
      t = performance.now();
      const gecen = t - durum.basi;
      if (durum.sira === -1) {
        hud(null, sonKare?.f ? "Hazırlanıyor… sarı noktaya bak" : "Yüzün görünmüyor", null);
        if (gecen > 1200 && sonKare?.f) { durum.sira = 0; durum.basi = t; }
      } else if (durum.bekleme) {
        const n = durum.nTop / Math.max(1, durum.nSay);
        const hedef = durum.bekleme === 1 ? n * 0.8 : n * 1.2;
        const u = durum.sonU;
        const uygun = sonKare?.f && u > 0 && (durum.bekleme === 1 ? u <= hedef : u >= hedef);
        $("bekleYazi").textContent = (u > 0 ? `Şimdi ${u.toFixed(0)} cm · ` : "") +
          (durum.bekleme === 1 ? `${hedef.toFixed(0)} cm'nin altına getir` : `${hedef.toFixed(0)} cm'nin üstüne çıkar`) + "\nYüzün ekranda görünür kalsın";
        if (!uygun) durum.uygunBasi = 0;
        else {
          if (!durum.uygunBasi) durum.uygunBasi = t;
          $("bekleBaslik").textContent = "Böyle tut";
          if (t - durum.uygunBasi >= 1000) { durum.bekleme = 0; $("bekleKutu").hidden = true; durum.basi = t; }
        }
      } else if (durum.sira < noktalar.length && gecen >= S.noktaSure) {
        durum.sira++; durum.basi = t;
        if (durum.sira >= noktalar.length) bitir();
        else if (durum.sira === normalSon && normalSon < noktalar.length) bekleBasla(1);
        else if (durum.sira === yakinSon && yakinSon < noktalar.length) bekleBasla(2);
      }
      if (durum.sira >= 0 && durum.sira < noktalar.length && !durum.bekleme) {
        hud(`Kalibrasyon · ${durum.sira + 1} / ${noktalar.length}`, durum.sira < normalSon ? "Normal uzaklık" : durum.sira < yakinSon ? "Yakın" : "Uzak", null);
      }
      // noktalar
      noktalar.slice(0, 16).forEach(([x, y], i) => daire(x * W, y * H, 5, i < Math.min(durum.sira, 16) ? RENK.iyi : RENK.cizgi));
      if (durum.sira >= 0 && durum.sira < noktalar.length && !durum.bekleme) {
        const [x, y] = noktalar[durum.sira];
        hudKacin([[x * W, y * H]]);
        const p = Math.min(1, (t - durum.basi) / S.noktaSure);
        daire(x * W, y * H, 30, null, RENK.vurgu, 3);
        daire(x * W, y * H, 30 * (1 - 0.6 * p), RENK.vurgu);
        daire(x * W, y * H, 2.5, "#0d1117");
      }
    },
    kapat() { $("bekleKutu").hidden = true; },
  };
}

// ------------------------------------------------------------------ dokunarak kalibrasyon
// Noktanın ortasına bakıp parmakla dokunulur. Dokunmadan hemen önceki kareler (göz hedefteyken)
// o noktanın örneği olur; dokunma anı ve sonrası atılır (el kamerayı ya da yüzü kapatabilir).
function dokunarakKalibrasyon(ekle) {
  const ızg = { 20: [4, 5], 45: [5, 9], 90: [9, 10] }[S.dkSayi] || [5, 9];
  const [c, r] = ızg, pay = 0.07;
  const noktalar = [];
  for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) noktalar.push([pay + ((1 - 2 * pay) * i) / (c - 1), pay + 0.04 + ((1 - 2 * pay - 0.08) * j) / (r - 1)]);
  noktalar.sort(() => Math.random() - 0.5);
  const R = 22;
  const d = { sira: 0, toplanan: [], basma: 0, flas: null, kaçan: 0 };
  function bitir() {
    if (d.toplanan.length < 20) { hud("Yeterli ölçüm alınamadı", "Yüzünün göründüğünden emin olup tekrar dene.", ""); return; }
    P.ornekler = ekle ? [...P.ornekler, ...d.toplanan] : d.toplanan;
    if (!ekle) kaymaSifirla();
    profilKaydet();
    hud("Model eğitiliyor…", "", "");
    setTimeout(() => {
      profilEgit(true);
      const g = P.deger;
      hud("Dokunarak kalibrasyon bitti", g ? `Kalibrasyon hatası ≈ ${g.hataPx.toFixed(0)} px (${(g.hataPx * 0.159).toFixed(0)} mm) · ızgara ${P.cols}×${P.rows}` : "",
        `${noktalar.length - d.kaçan} nokta · ${d.toplanan.length} örnek · ${d.kaçan} tekrar edilen dokunma`);
      dugmeler([["Tıklama testi", () => { sahneKapat(); sahneAc(tiklamaTesti()); }, true], ["İsabet testi", () => { sahneKapat(); sahneAc(isabetTesti()); }]]);
    }, 50);
  }
  return {
    ac() { hud(ekle ? "Dokunarak ekle" : "Dokunarak kalibrasyon", "Noktanın ortasına bak, sonra parmağınla tam ortasına dokun", ""); },
    bas() { d.basma = performance.now(); },
    dokun(nx, ny) {
      if (d.sira >= noktalar.length) return;
      const [hx, hy] = noktalar[d.sira];
      const t0 = d.basma || performance.now();
      if (Math.hypot((nx - hx) * W, (ny - hy) * H) > R * 2) { d.flas = { x: nx * W, y: ny * H, iyi: false, bitis: performance.now() + 500 }; d.kaçan++; return; }
      const kareler = gecmis.filter((g) => g.t >= t0 - S.dkPencere && g.t <= t0 - 60);
      if (kareler.length < 3) { hud(null, "Yüzün görünmedi, aynı noktaya tekrar bakıp dokun", null); d.kaçan++; return; }
      for (const g of kareler) d.toplanan.push({ f: g.f, x: hx, y: hy, t: 0 });
      d.flas = { x: hx * W, y: hy * H, iyi: true, bitis: performance.now() + 400 };
      d.sira++;
      hud(null, "Noktanın ortasına bak, sonra parmağınla tam ortasına dokun", `${d.sira} / ${noktalar.length} · ${d.toplanan.length} örnek`);
      if (d.sira >= noktalar.length) bitir();
    },
    ciz() {
      const t = performance.now();
      if (d.sira < noktalar.length) {
        hud(`Dokunarak kalibrasyon · ${d.sira + 1} / ${noktalar.length}`, null, null);
        const [hx, hy] = noktalar[d.sira];
        hudKacin([[hx * W, hy * H]]);
        daire(hx * W, hy * H, R, "rgba(255,194,75,.22)", RENK.vurgu, 3);
        daire(hx * W, hy * H, 3, "#0d1117");
        daire(hx * W, hy * H, 2, RENK.yazi);
      }
      if (d.flas && t < d.flas.bitis) daire(d.flas.x, d.flas.y, 12, d.flas.iyi ? RENK.iyi : RENK.uyari);
    },
  };
}

// ------------------------------------------------------------------ canlı bakış (Kotlin: GozTest canlı)
function canli() {
  const im = imlecMotoru();
  const oturum = [], hatalar = [];
  let duzeltme = null, tikIz = null;
  const iz = [];

  function ozet() {
    if (!hatalar.length) return "Bir yere bak. İmleç başka yerdeyse baktığın yere dokun, öğrensin.";
    const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    let s = `Bu düzeltme ${hatalar.at(-1).toFixed(0)} px · ${hatalar.length} düzeltme`;
    if (hatalar.length >= 10) s += `\nİlk 10: ${ort(hatalar.slice(0, 10)).toFixed(0)} px → son 10: ${ort(hatalar.slice(-10)).toFixed(0)} px`;
    else s += ` · ortalama ${ort(hatalar).toFixed(0)} px`;
    return s;
  }
  function geriAl() {
    if (!oturum.length) return;
    const son = oturum.at(-1);
    if (son.kayma) { oturum.pop(); hatalar.pop(); kaymaGuncelle(-son.kayma[0], -son.kayma[1]); return; }
    const grup = new Set(oturum.pop());
    hatalar.pop();
    P.ornekler = P.ornekler.filter((o) => !grup.has(o));
    profilKaydet(); P.model = egit(P.ornekler);
  }
  return {
    ac() { dugmeler([["Son düzeltmeyi geri al", geriAl]]); },
    kare(k, t) {
      if (G.gecerli) { iz.push([G.hamX * W, G.hamY * H]); if (iz.length > 10) iz.shift(); }
      const tik = im.guncelle(k, t);
      if (tik) tikIz = { ...tik, bitis: t + 700 };
    },
    dokun(nx, ny) {
      if (!G.gecerli || !G.sonOz.length || !sonKare?.f) { hud(null, "Yüzün görünmüyor, düzeltme eklenmedi", null); return; }
      hatalar.push(Math.hypot((G.x - nx) * W, (G.y - ny) * H));
      duzeltme = { x1: G.x * W, y1: G.y * H, x2: nx * W, y2: ny * H, bitis: performance.now() + 1500 };
      if (S.dokunma === "kayma") { oturum.push({ kayma: [G.x - nx, G.y - ny] }); kaymaGuncelle(G.x - nx, G.y - ny); return; }
      const grup = G.sonOz.map((f) => ({ f: f.slice(), x: nx, y: ny, t: 2 }));
      P.ornekler.push(...grup);
      let fazla = P.ornekler.filter((o) => o.t === 2).length - 600;
      if (fazla > 0) P.ornekler = P.ornekler.filter((o) => !(o.t === 2 && fazla-- > 0));
      oturum.push(grup);
      P.model = egit(P.ornekler);
      profilKaydet();
    },
    ciz() {
      const t = performance.now();
      const mod = $("aMod").value;
      hud(`Canlı bakış · ${{ goz: "Göz", kilit: "Kilitle", izgara: "Izgara" }[mod]}`,
        !sonKare?.f ? "Yüz yok" : !G.gecerli ? "Kırpma / bekleniyor" : mod === "kilit" ? (im.kilitli ? "Kilitli: başını hafifçe oynatarak ince ayar yap" : "Bir noktaya bak, kilitlensin") : "",
        ozet() + `\n${fps.toFixed(0)} fps · ${sonKare?.f ? "~" + sonKare.f[UZAKLIK].toFixed(0) + " cm" : "–"}`);
      for (const [i, [x, y]] of iz.entries()) daire(x, y, i === iz.length - 1 ? 6 : 3, i === iz.length - 1 ? RENK.mavi : "rgba(90,162,255,.35)");
      if (duzeltme && t < duzeltme.bitis) {
        ctx.strokeStyle = RENK.uyari; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(duzeltme.x1, duzeltme.y1); ctx.lineTo(duzeltme.x2, duzeltme.y2); ctx.stroke(); ctx.setLineDash([]);
        daire(duzeltme.x2, duzeltme.y2, 9, RENK.iyi);
      }
      if (tikIz && t < tikIz.bitis) daire(tikIz.x, tikIz.y, 34 * (1 - (tikIz.bitis - t) / 700) + 10, null, RENK.iyi, 3);
      im.ciz();
    },
  };
}

// ------------------------------------------------------------------ isabet testi
function isabetTesti() {
  const k3 = [0.15, 0.5, 0.85];
  const noktalar = k3.flatMap((y) => k3.map((x) => [x, y])).sort(() => Math.random() - 0.5);
  const SURE = 2000, YOK = 800;
  const d = { sira: -1, basi: performance.now(), ornek: [], ozler: [], sonuc: [], eklenecek: [], noktaOz: [] };
  function bitir() {
    const hata = d.sonuc.map((r) => r.hata), sirali = [...hata].sort((a, b) => a - b);
    const ort = hata.reduce((a, b) => a + b, 0) / hata.length;
    const titreme = d.sonuc.reduce((a, r) => a + r.titreme, 0) / d.sonuc.length;
    const isabet = (c, r) => d.sonuc.filter((s) => Math.abs(s.ex) < W / c / 2 && Math.abs(s.ey) < H / r / 2).length / d.sonuc.length;
    const kx = d.sonuc.reduce((a, r) => a + r.ex, 0) / d.sonuc.length, ky = d.sonuc.reduce((a, r) => a + r.ey, 0) / d.sonuc.length;
    const kayma = Math.hypot(kx, ky);
    const yon = `${Math.abs(kx).toFixed(0)} px ${kx >= 0 ? "sağa" : "sola"}, ${Math.abs(ky).toFixed(0)} px ${ky >= 0 ? "aşağı" : "yukarı"}`;
    const ozet = { kaymaPx: Math.round(kayma), kaymaX: Math.round(kx), kaymaY: Math.round(ky), ortPx: Math.round(ort), ortancaPx: Math.round(sirali[sirali.length >> 1]), enKotuPx: Math.round(sirali.at(-1)), titremePx: Math.round(titreme), i3x3: Math.round(isabet(3, 3) * 100), i3x4: Math.round(isabet(3, 4) * 100) };
    sonucEkle("İsabet", ozet, `ort ${ozet.ortPx} px (≈${Math.round(ozet.ortPx * 0.159)} mm) · ortanca ${ozet.ortancaPx} · titreme ±${ozet.titremePx} · 3×3 %${ozet.i3x3}`);
    // Sabit kayma payı: hatanın ne kadarı tüm noktalarda aynı yöne olan kayma
    const kalan = Math.sqrt(d.sonuc.reduce((a, r) => a + (r.ex - kx) ** 2 + (r.ey - ky) ** 2, 0) / d.sonuc.length);
    hud("İsabet testi bitti", `Ortalama hata ${ozet.ortPx} px ≈ ${Math.round(ozet.ortPx * 0.159)} mm · titreme ±${ozet.titremePx} px`,
      `Sabit kayma: ${yon} (${ozet.kaymaPx} px)\nKayma çıkınca kalan hata: ${kalan.toFixed(0)} px\nOrtanca ${ozet.ortancaPx} px · en kötü ${ozet.enKotuPx} px\n3×3 isabet %${ozet.i3x3} · 3×4 isabet %${ozet.i3x4}`);
    // Model karşılaştırması: aynı test ölçümleri, profildeki aynı örneklerle eğitilmiş farklı modeller
    const egitimSeti = P.ornekler.filter((o) => o.t !== 2);
    const satirlar = [];
    for (const [set, ad] of [["yeni", "Yeni"], ["eski", "Eski"], ["goz", "Göz"]]) {
      for (const lam of [0.02, 0.1, 0.5]) {
        const m = egit(egitimSeti, set, lam);
        if (!m || !d.noktaOz.length) continue;
        const e = d.noktaOz.map((n) => {
          let tx = 0, ty = 0;
          for (const f of n.ozler) { const [a, b] = m.tahmin(f); tx += a; ty += b; }
          return [(tx / n.ozler.length - n.x) * W, (ty / n.ozler.length - n.y) * H];
        });
        const ort = e.reduce((a, [x, y]) => a + Math.hypot(x, y), 0) / e.length;
        const mx = e.reduce((a, [x]) => a + x, 0) / e.length, my = e.reduce((a, [, y]) => a + y, 0) / e.length;
        const kal = Math.sqrt(e.reduce((a, [x, y]) => a + (x - mx) ** 2 + (y - my) ** 2, 0) / e.length);
        satirlar.push({ ad: `${ad} λ${lam}`, set, lam, ort, kayma: Math.hypot(mx, my), kal });
      }
    }
    satirlar.sort((a, b) => a.ort - b.ort);
    const tablo = satirlar.map((r, i) => `${i === 0 ? "▶" : " "} ${r.ad.padEnd(11)} ${r.ort.toFixed(0).padStart(4)} px  kayma ${r.kayma.toFixed(0).padStart(4)}  kalan ${r.kal.toFixed(0).padStart(4)}`).join("\n");
    if (satirlar.length) {
      ozet.karsilastirma = satirlar.map((r) => ({ model: r.ad, ort: Math.round(r.ort), kayma: Math.round(r.kayma), kalan: Math.round(r.kal) }));
      sonuclar[0].ozet = ozet; yaz("gk-sonuc", sonuclar);
      $("hudBilgi").textContent += `\n\nMODEL KARŞILAŞTIRMA (hata · sabit kayma · kalan)\n${tablo}`;
    }
    const enIyi = satirlar[0];
    const enIyiyiSec = () => {
      ayarDegisti("ozellik", enIyi.set); ayarDegisti("lambda", enIyi.lam);
      ayarlariCiz();
      hud("Seçildi", `Model: ${enIyi.ad}. Tekrar test ederek doğrula.`, null);
      dugmeler([["Tekrar test et", () => { sahneKapat(); sahneAc(isabetTesti()); }, true]]);
    };
    const ekle = () => {
      P.ornekler.push(...d.eklenecek);
      let fazla = P.ornekler.filter((o) => o.t === 2).length - 600;
      if (fazla > 0) P.ornekler = P.ornekler.filter((o) => !(o.t === 2 && fazla-- > 0));
      profilKaydet(); profilEgit(false);
      hud("Eklendi", `${d.eklenecek.length} örnek profile eklendi. Tekrar test ederek farkı gör.`, null);
      dugmeler([["Tekrar test et", () => { sahneKapat(); sahneAc(isabetTesti()); }, true]]);
    };
    dugmeler([["Tekrar", () => { sahneKapat(); sahneAc(isabetTesti()); }, true],
      ...(enIyi && (enIyi.set !== S.ozellik || enIyi.lam !== S.lambda) ? [["En iyi modeli seç", enIyiyiSec]] : []),
      ...(d.sonuc.length ? [["Kaymayı düzelt", () => {
        kaymaGuncelle(kx / W, ky / H, 1);
        hud("Kayma düzeltildi", `Tüm tahminler ${Math.round(Math.hypot(kx, ky))} px geri kaydırıldı. Tekrar test ederek farkı gör.`, null);
        dugmeler([["Tekrar test et", () => { sahneKapat(); sahneAc(isabetTesti()); }, true]]);
      }]] : []),
      ...(d.eklenecek.length ? [["Bu ölçümleri profile ekle", ekle]] : [])]);
  }
  return {
    ac() { hud("İsabet testi", "Beliren noktaya bak. İmleç gösterilmez (kovalama olmasın).", ""); },
    kare(k, t) {
      if (d.sira < 0 || d.sira >= noktalar.length) return;
      if (t - d.basi >= YOK && G.gecerli && k.f) { d.ornek.push([G.x * W, G.y * H]); if (k.guvenilir) d.ozler.push(k.f.slice()); }
    },
    ciz() {
      const t = performance.now();
      if (!P.model) { hud("Önce kalibre et", "", ""); return; }
      if (d.sira === -1) { if (t - d.basi > 1000) { d.sira = 0; d.basi = t; } return; }
      if (d.sira >= noktalar.length) return;
      const [nx, ny] = noktalar[d.sira];
      hudKacin([[nx * W, ny * H]]);
      const p = Math.min(1, (t - d.basi) / SURE);
      daire(nx * W, ny * H, 26, null, RENK.vurgu, 3);
      daire(nx * W, ny * H, 6, RENK.vurgu);
      ctx.beginPath(); ctx.arc(nx * W, ny * H, 34, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.strokeStyle = RENK.cizgi; ctx.lineWidth = 3; ctx.stroke();
      hud(`İsabet testi · ${d.sira + 1} / ${noktalar.length}`, null, null);
      if (t - d.basi >= SURE) {
        if (d.ornek.length >= 5) {
          const mx = d.ornek.reduce((a, o) => a + o[0], 0) / d.ornek.length, my = d.ornek.reduce((a, o) => a + o[1], 0) / d.ornek.length;
          const titreme = Math.sqrt(d.ornek.reduce((a, o) => a + (o[0] - mx) ** 2 + (o[1] - my) ** 2, 0) / d.ornek.length);
          d.sonuc.push({ ex: mx - nx * W, ey: my - ny * H, hata: Math.hypot(mx - nx * W, my - ny * H), titreme });
        }
        for (const f of d.ozler) d.eklenecek.push({ f, x: nx, y: ny, t: 2 });
        if (d.ozler.length >= 3) d.noktaOz.push({ x: nx, y: ny, ozler: d.ozler });
        d.ornek = []; d.ozler = []; d.sira++; d.basi = t;
        if (d.sira >= noktalar.length) { d.sonuc.length >= 5 ? bitir() : hud("Yeterli ölçüm yok", "Yüzünün göründüğünden emin ol", ""); }
      }
    },
  };
}

// ------------------------------------------------------------------ tıklama testi
function tiklamaTesti() {
  const SAYI = 8, R = 18, ZAMAN = 25000;
  const pay = 50;
  const yeniHedef = () => ({ x: pay + Math.random() * (W - 2 * pay), y: pay + 60 + Math.random() * (H - 2 * pay - 180), r: R });
  // Izgara modunda yakınlaştırma anlamlı olsun diye yanına iki tuzak hedef koy
  const tuzaklar = (h) => [0, 1].map(() => ({ x: kis(h.x + (Math.random() - 0.5) * 140, pay, W - pay), y: kis(h.y + (Math.random() - 0.5) * 140, pay, H - pay), r: R, tuzak: true }));
  const d = { sira: 0, basi: performance.now(), hedef: null, tuzak: [], dogru: 0, yanlis: 0, sureler: [], kacan: 0, flas: null };
  const im = imlecMotoru(() => (d.hedef ? [d.hedef, ...d.tuzak] : []));
  const sonraki = () => { d.hedef = yeniHedef(); d.tuzak = tuzaklar(d.hedef); d.basi = performance.now(); im.kilitBirak(); im.zoomBitir(); };
  function bitir() {
    const mod = $("aMod").value;
    const ortSure = d.sureler.length ? d.sureler.reduce((a, b) => a + b, 0) / d.sureler.length / 1000 : 0;
    const ozet = { mod, dogru: d.dogru, yanlis: d.yanlis, kacan: d.kacan, ortSureSn: +ortSure.toFixed(1) };
    sonucEkle("Tıklama", ozet, `${mod} · ${d.dogru}/${SAYI} doğru · ${d.yanlis} yanlış tık · ${d.kacan} kaçan · ort ${ortSure.toFixed(1)} sn`);
    hud("Tıklama testi bitti", `${d.dogru} / ${SAYI} hedef · ${d.yanlis} yanlış tık · ortalama ${ortSure.toFixed(1)} sn`, "");
    d.hedef = null; d.tuzak = [];
    dugmeler([["Tekrar", () => { sahneKapat(); sahneAc(tiklamaTesti()); }, true]]);
  }
  return {
    ac() {
      sonraki();
      hud("Tıklama testi", S.kontrol === "parmak" ? `İşaret parmağınla imleci sarı hedefe götür, ${S.tikYontem === "kapat" ? "gözlerini yarım saniye kapatıp açarak tıkla" : S.tikYontem === "cimdik" ? "başparmakla işaret parmağını birleştirerek tıkla" : "bekle"}.`
        : S.kontrol === "gozParmak" ? `Sarı hedefe bak; gerekirse işaret parmağını kaldırıp imleci kaydır, ${S.tikYontem === "kapat" ? "gözlerini yarım saniye kapatıp açarak tıkla" : S.tikYontem === "cimdik" ? "başparmakla işaret parmağını birleştirerek tıkla" : "bekle"}.`
        : $("aMod").value === "kilit"
        ? `Sarı hedefe bak. Artı yanlış hedefteyse başını o yöne hafifçe çevirip geri getir. ${S.tikYontem === "kapat" ? "Gözlerini yarım saniye kapatıp açarak tıkla." : "Sonra bekle."}`
        : `Sarı hedefe bak, ${S.tikYontem === "kapat" ? "gözlerini yarım saniye kapatıp açarak tıkla" : S.tikYontem === "cimdik" ? "başparmakla işaret parmağını birleştirerek tıkla" : "bekle"}. Gri hedefler tuzak.`, "");
    },
    kare(k, t) {
      if (!d.hedef) return;
      const tik = im.guncelle(k, t);
      if (tik) {
        const isabet = Math.hypot(tik.x - d.hedef.x, tik.y - d.hedef.y) <= R + 2;
        d.flas = { ...tik, iyi: isabet, bitis: t + 600 };
        if (isabet) {
          if (S.ogren === "kayma") kaymaGuncelle(G.x - d.hedef.x / W, G.y - d.hedef.y / H);
          if (S.ogren === "ornek" && G.sonOz.length) {
            // Doğru tıklamada kullanıcının nereye baktığı kesin: o anki göz ölçümünü hedefin yeriyle öğren
            P.ornekler.push(...G.sonOz.map((f) => ({ f: f.slice(), x: d.hedef.x / W, y: d.hedef.y / H, t: 1 })));
            let fazla = P.ornekler.filter((o) => o.t === 1).length - 300;
            if (fazla > 0) P.ornekler = P.ornekler.filter((o) => !(o.t === 1 && fazla-- > 0));
            P.model = egit(P.ornekler); profilKaydet();
          }
          d.dogru++; d.sureler.push(t - d.basi); d.sira++; d.sira >= SAYI ? bitir() : sonraki();
        }
        else d.yanlis++;
      } else if (t - d.basi > ZAMAN) { d.kacan++; d.sira++; d.sira >= SAYI ? bitir() : sonraki(); }
    },
    ciz() {
      const t = performance.now();
      if (!P.model && S.kontrol !== "parmak") { hud("Önce kalibre et (ya da Ayarlar → İmleç kontrolü: Sadece parmak)", "", ""); return; }
      if (d.hedef) hudKacin([[d.hedef.x, d.hedef.y], ...d.tuzak.map((h) => [h.x, h.y])]);
      if (d.hedef) hud(`Tıklama testi · ${d.sira + 1} / ${SAYI}`, null, `${d.dogru} doğru · ${d.yanlis} yanlış · kalan ${Math.max(0, (ZAMAN - (t - d.basi)) / 1000).toFixed(0)} sn`);
      im.ciz((olcek) => {
        for (const h of d.tuzak) daire(h.x, h.y, h.r, "rgba(255,255,255,.18)", "rgba(255,255,255,.4)", 2 * olcek);
        if (d.hedef) { daire(d.hedef.x, d.hedef.y, R, "rgba(255,194,75,.35)", RENK.vurgu, 3 * olcek); daire(d.hedef.x, d.hedef.y, 2.5 * olcek, RENK.vurgu); }
      });
      if (d.flas && t < d.flas.bitis) daire(d.flas.x, d.flas.y, 10, d.flas.iyi ? RENK.iyi : RENK.uyari);
    },
  };
}

// Joystick: ölü bölgeden sonra karesel hız (az çekince hassas, çok çekince hızlı)
function joystickHiz(dy) {
  const a = Math.abs(dy) - S.kaydirOlu;
  if (a <= 0) return 0;
  return Math.sign(dy) * (a / 0.1) ** 2 * S.kaydirHiz;
}
// Kaydırma bitince en yakın satıra yumuşakça otur. hiza: satır başlarının hizalanacağı ofset kayması
function satiraOtur(off, satir, hiza, dt) {
  if (S.kaydirOtur !== "acik") return off;
  const hedef = Math.round((off - hiza) / satir) * satir + hiza;
  return off + (hedef - off) * Math.min(1, dt * 10);
}

// Ortak kaydırma: kd = { off, bas, v }. Kaydırma hareketi sürüyorsa true döner (o an imleç tıklaması yapılmasın).
function kaydirGuncelle(kd, t, dt, satir, hiza, enFazla) {
  kd.v = kd.v || 0;
  let surer = false;
  if (S.kaydirModu === "cimdik" || S.kaydirModu === "yumruk") {
    // Yumruk: kısa algılama boşluklarında (200 ms) bırakılmış sayılmasın
    const tutuyor = S.kaydirModu === "yumruk" ? EL.var && (EL.yumruk || (kd.bas && t - EL.sonYumruk < 200)) : EL.surukle;
    if (tutuyor && S.kaydirModu === "yumruk" && !EL.yumruk) {
      surer = true; // kısa boşluk: el açılırken takip noktası değişir, konumu kullanma
    } else if (tutuyor) {
      if (!kd.bas) kd.bas = { y: EL.y, off: kd.off };
      const yeni = kd.bas.off + (S.surukleYon === "ters" ? 1 : -1) * (EL.y - kd.bas.y) * S.kaydirMesafe * H;
      if (dt > 0) kd.v = kd.v * 0.5 + ((yeni - kd.off) / dt) * 0.5;
      kd.off = yeni; surer = true;
    } else {
      kd.bas = null;
      if (Math.abs(kd.v) > 40) { kd.off += kd.v * dt; kd.v *= Math.exp(-dt * 3); }  // bırakınca savrulma
      else { kd.v = 0; kd.off = satiraOtur(kd.off, satir, hiza, dt); }
    }
  } else {
    const iki = EL.iki || (EL.var && t - EL.sonIki < 300);
    if (iki) {
      if (!kd.bas) kd.bas = { y: EL.y, off: kd.off };
      const dy = EL.y - kd.bas.y;
      if (S.kaydirModu === "joystick") {
        const v = joystickHiz(dy);
        kd.off += v * dt;
        if (v === 0) kd.off = satiraOtur(kd.off, satir, hiza, dt);
      } else kd.off = kd.bas.off + dy * S.kaydirMesafe * H;
      surer = true;
    } else { kd.bas = null; kd.off = satiraOtur(kd.off, satir, hiza, dt); }
  }
  const once = kd.off;
  kd.off = kis(kd.off, 0, enFazla);
  if (kd.off !== once) kd.v = 0;
  return surer;
}

// ------------------------------------------------------------------ parmak testi (kaydırma)
// İki parmakla (işaret + orta) aşağı-yukarı kaydırarak istenen satırı ortadaki banda getir.
function parmakTesti() {
  const SATIR = 80, SH = 56, UST = 90, HEDEF_SAYI = 4;
  const hedefler = Array.from({ length: HEDEF_SAYI }, (_, i) => 10 + Math.floor(Math.random() * (SATIR - 20)));
  const d = { off: 0, i: 0, bas: null, sonT: 0, oncekiOff: 0, sabitBasi: 0, basi: performance.now(), sureler: [], bitti: false };
  const enFazla = () => Math.max(0, SATIR * SH - (H - UST - 60));
  function bitir() {
    d.bitti = true;
    const ort = d.sureler.reduce((a, b) => a + b, 0) / d.sureler.length / 1000;
    sonucEkle("Kaydırma", { mod: S.kaydirModu, ortSureSn: +ort.toFixed(1) }, `${S.kaydirModu} · ${HEDEF_SAYI} satır · ort ${ort.toFixed(1)} sn`);
    hud("Parmak testi bitti", `${HEDEF_SAYI} satır · ortalama ${ort.toFixed(1)} sn (${{ yumruk: "yumrukla çek", cimdik: "çimdikle sürükle", joystick: "joystick", mesafe: "mesafe" }[S.kaydirModu]})`, "");
    dugmeler([["Tekrar", () => { sahneKapat(); sahneAc(parmakTesti()); }, true]]);
  }
  return {
    elIster: true,
    ac() { hud("Parmak testi", S.kaydirModu === "yumruk" ? "Elini yumruk yap, aşağı-yukarı götür, elini aç" : S.kaydirModu === "cimdik" ? "Başparmak ve işaret parmağıyla çimdik yap, tutarken elini yukarı-aşağı götür, bırak" : "İşaret ve orta parmağını göster, aşağı-yukarı hareket ettirerek kaydır", ""); },
    kare(k, t) {
      if (d.bitti) return;
      const dt = d.sonT ? Math.min(0.1, (t - d.sonT) / 1000) : 0;
      d.sonT = t;
      kaydirGuncelle(d, t, dt, SH, UST + SH / 2 - H / 2, enFazla());
      // Hedef satır bantta ve kaydırma durmuşsa 0,8 sn sonra başarılı
      const merkez = UST + hedefler[d.i] * SH + SH / 2 - d.off;
      const bantta = Math.abs(merkez - H / 2) < SH / 2;
      if (Math.abs(d.off - d.oncekiOff) > 0.5 || !bantta) d.sabitBasi = t;
      d.oncekiOff = d.off;
      if (bantta && t - d.sabitBasi > 800) {
        d.sureler.push(t - d.basi);
        d.i++; d.basi = t; d.sabitBasi = t;
        if (d.i >= HEDEF_SAYI) bitir();
      }
    },
    ciz() {
      if (d.bitti) return;
      const hedef = hedefler[d.i];
      hud(`Parmak testi · ${d.i + 1} / ${HEDEF_SAYI}`, null, `Satır ${hedef + 1}'i ortadaki banda getir\n${d.bas ? "Kaydırıyor" : EL.yumruk ? "Yumruk" : EL.cimdik ? "Çimdik" : EL.var ? "El görünüyor" : "El görünmüyor"} · ${{ yumruk: "yumrukla çek", cimdik: "çimdikle sürükle", joystick: "joystick", mesafe: "mesafe" }[S.kaydirModu]}`);
      ctx.font = "600 16px system-ui"; ctx.textBaseline = "middle";
      const ilk = Math.max(0, Math.floor((d.off - UST) / SH) - 1), son = Math.min(SATIR, ilk + Math.ceil(H / SH) + 3);
      for (let i = ilk; i < son; i++) {
        const y = UST + i * SH - d.off;
        ctx.fillStyle = i === hedef ? "rgba(255,194,75,.35)" : i % 2 ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.08)";
        ctx.fillRect(16, y + 2, W - 32, SH - 4);
        ctx.fillStyle = i === hedef ? RENK.vurgu : RENK.yazi;
        ctx.fillText(`Satır ${i + 1}`, 32, y + SH / 2);
      }
      ctx.strokeStyle = RENK.mavi; ctx.lineWidth = 2;
      ctx.strokeRect(8, H / 2 - SH / 2, W - 16, SH);
      if (d.bas && EL.var) {
        // Joystick göstergesi: başlangıçtan parmağa çizgi
        ctx.strokeStyle = RENK.mavi; ctx.beginPath(); ctx.moveTo(W - 30, H / 2); ctx.lineTo(W - 30, H / 2 + (EL.y - d.bas.y) * H); ctx.stroke();
        daire(W - 30, H / 2 + (EL.y - d.bas.y) * H, 7, RENK.mavi);
      }
      ctx.textBaseline = "alphabetic";
    },
  };
}

// ------------------------------------------------------------------ telefon testi
// Gerçek bir Android ekranını taklit eder: ana ekran, mesaj listesi, kişi ekranı, geri.
function telefonTesti() {
  const UYG = ["Telefon", "Mesajlar", "Kamera", "Galeri", "Ayarlar", "Saat", "Hava", "Harita", "Müzik", "Notlar", "Takvim", "Hesap", "Posta", "Tarayıcı", "Dosyalar", "Radyo", "Kitap", "Oyun", "Sağlık", "Market"];
  const RENKLER = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#64748b", "#8b5cf6", "#0ea5e9", "#10b981", "#ef4444", "#eab308"];
  const KISI = ["Ahmet", "Ayşe", "Mehmet", "Fatma", "Ali", "Zeynep", "Mustafa", "Elif", "Hasan", "Emine", "Hüseyin", "Hatice", "İbrahim", "Merve", "Osman", "Esra", "Yusuf", "Büşra", "Murat", "Selin", "Emre", "Derya", "Burak", "Gizem", "Can", "Ece", "Kerem", "Seda", "Onur", "Pınar", "Serkan", "Tuğba", "Cem", "Aslı", "Volkan", "Gamze", "Barış", "İrem", "Kaan", "Nazlı"];
  const isim = KISI[18 + Math.floor(Math.random() * 20)];
  const UST = 90, ALT = 100, SATIR = 72;
  const gorevler = [
    { metin: "Mesajlar'ı aç", olay: "ac:Mesajlar" },
    { metin: `${isim} adlı kişiye kadar kaydır ve aç`, olay: `kisi:${isim}` },
    { metin: "Gönder'e bas", olay: "gonder" },
    { metin: "Geri dön (geri düğmesi ya da açık avuç)", olay: "geri:liste" },
    { metin: "Ana ekrana dön", olay: "geri:ana" },
    { metin: "Saat'i aç", olay: "ac:Saat" },
  ];
  const d = { ekran: "ana", uyg: null, kisi: null, off: 0, bas: null, sonT: 0, i: 0, basi: performance.now(), gorevBasi: performance.now(), yanlis: 0, sureler: [], flas: null, bitti: false, sonGeri: 0 };
  const im = imlecMotoru(() => ogeler().map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.min(o.w, o.h) / 2 })));
  const listeBoyu = () => Math.max(0, KISI.length * SATIR - (H - UST - 60 - ALT));

  function ogeler() {
    const l = [];
    if (d.ekran === "ana") {
      const cw = W / 4;
      UYG.forEach((ad, i) => l.push({ id: "uyg:" + ad, ad, i, x: (i % 4) * cw + cw / 2 - 34, y: UST + 20 + Math.floor(i / 4) * 100, w: 68, h: 84 }));
      return l;
    }
    l.push({ id: "geri", x: 8, y: UST + 4, w: 52, h: 52 });
    if (d.ekran === "liste") {
      const y0 = UST + 60;
      KISI.forEach((ad, i) => {
        const y = y0 + i * SATIR - d.off;
        if (y + SATIR > y0 && y < H - ALT) l.push({ id: "kisi:" + ad, ad, i, x: 0, y: y + 2, w: W, h: SATIR - 4 });
      });
    } else if (d.ekran === "kisi") {
      l.push({ id: "ara", x: 24, y: H - ALT - 72, w: 120, h: 56 });
      l.push({ id: "gonder", x: W - 144, y: H - ALT - 72, w: 120, h: 56 });
    }
    return l;
  }

  function olay(o) {
    const g = gorevler[d.i];
    if (g && g.olay === o) {
      const t = performance.now();
      d.sureler.push(t - d.gorevBasi); d.gorevBasi = t; d.i++;
      if (d.i >= gorevler.length) bitir();
      return true;
    }
    return false;
  }
  function geri() {
    if (d.ekran === "kisi") { d.ekran = "liste"; return olay("geri:liste"); }
    if (d.ekran === "liste" || d.ekran === "uyg") { d.ekran = "ana"; d.off = 0; return olay("geri:ana"); }
    return false;
  }
  function tikla(p) {
    const o = ogeler().find((e) => p.x >= e.x - 4 && p.x <= e.x + e.w + 4 && p.y >= e.y - 4 && p.y <= e.y + e.h + 4);
    let dogru = false;
    if (o) {
      if (o.id === "geri") dogru = geri();
      else if (o.id.startsWith("uyg:")) { d.ekran = o.ad === "Mesajlar" ? "liste" : "uyg"; d.uyg = o.ad; d.off = 0; dogru = olay("ac:" + o.ad); }
      else if (o.id.startsWith("kisi:")) { d.ekran = "kisi"; d.kisi = o.ad; dogru = olay("kisi:" + o.ad); }
      else if (o.id === "gonder") dogru = d.kisi === isim && olay("gonder");
    }
    // Geri düğmesi yanlış sayılmaz (yanlış ekrandan dönmek için gerekir)
    if (!dogru && o?.id !== "geri") d.yanlis++;
    d.flas = { ...p, iyi: dogru || o?.id === "geri", bitis: performance.now() + 500 };
  }
  function bitir() {
    d.bitti = true;
    const top = (performance.now() - d.basi) / 1000;
    const ozet = { kontrol: S.kontrol, tik: S.tikYontem, sureSn: +top.toFixed(1), yanlis: d.yanlis, gorevSn: d.sureler.map((x) => +(x / 1000).toFixed(1)) };
    sonucEkle("Telefon", ozet, `${S.kontrol} · ${top.toFixed(0)} sn · ${d.yanlis} yanlış · görevler ${ozet.gorevSn.join("/")} sn`);
    hud("Telefon testi bitti", `${gorevler.length} görev ${top.toFixed(0)} saniyede · ${d.yanlis} yanlış tık`, `Görev süreleri: ${ozet.gorevSn.join(" · ")} sn`);
    dugmeler([["Tekrar", () => { sahneKapat(); sahneAc(telefonTesti()); }, true]]);
  }

  return {
    elIster: true,
    ac() { dugmeler([]); },
    kare(k, t) {
      if (d.bitti) return;
      const dt = d.sonT ? Math.min(0.1, (t - d.sonT) / 1000) : 0;
      d.sonT = t;
      // Kaydırma: iki parmak (liste ekranında)
      const iki = S.kaydirModu === "yumruk" ? EL.yumruk : S.kaydirModu !== "cimdik" && (EL.iki || (EL.var && t - EL.sonIki < 300));
      if (d.ekran === "liste") kaydirGuncelle(d, t, dt, SATIR, 0, listeBoyu());
      // Geri: açık avuç 0,6 sn
      if (EL.avuc && EL.avucBasi && t - EL.avucBasi > 600 && t - d.sonGeri > 1200) { d.sonGeri = t; geri(); }
      if (iki) return;
      const tik = im.guncelle(k, t);
      if (tik) tikla(tik);
    },
    ciz() {
      if (d.bitti) return;
      const t = performance.now();
      const g = gorevler[d.i];
      hud(`Görev ${d.i + 1} / ${gorevler.length}: ${g.metin}`, null, "");
      im.ciz(() => cizEkran());
      if (d.flas && t < d.flas.bitis) daire(d.flas.x, d.flas.y, 12, d.flas.iyi ? RENK.iyi : RENK.uyari);
      if (EL.avuc && EL.avucBasi) {
        const p = Math.min(1, (t - EL.avucBasi) / 600);
        ctx.fillStyle = "rgba(90,162,255,.9)"; ctx.font = "700 15px system-ui"; ctx.textAlign = "center";
        ctx.fillText(`Geri ${Math.round(p * 100)}%`, W / 2, H - ALT + 30); ctx.textAlign = "start";
      }
    },
  };

  function cizEkran() {
    ctx.fillStyle = "#0b1220"; ctx.fillRect(0, UST - 10, W, H - UST - ALT + 10);
    ctx.textBaseline = "middle";
    if (d.ekran === "ana") {
      for (const o of ogeler()) {
        const cx = o.x + o.w / 2;
        daire(cx, o.y + 28, 26, RENKLER[o.i % RENKLER.length]);
        ctx.fillStyle = "#fff"; ctx.font = "700 20px system-ui"; ctx.textAlign = "center";
        ctx.fillText(o.ad[0], cx, o.y + 29);
        ctx.fillStyle = RENK.yazi; ctx.font = "13px system-ui";
        ctx.fillText(o.ad, cx, o.y + 72);
      }
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      return;
    }
    // üst çubuk
    ctx.fillStyle = "#111a2b"; ctx.fillRect(0, UST, W, 60);
    ctx.fillStyle = RENK.yazi; ctx.font = "700 30px system-ui"; ctx.fillText("‹", 24, UST + 30);
    ctx.font = "700 18px system-ui";
    ctx.fillText(d.ekran === "liste" ? "Mesajlar" : d.ekran === "kisi" ? d.kisi : d.uyg, 72, UST + 30);
    if (d.ekran === "liste") {
      ctx.save(); ctx.beginPath(); ctx.rect(0, UST + 60, W, H - UST - 60 - ALT); ctx.clip();
      for (const o of ogeler()) {
        if (o.id === "geri") continue;
        ctx.fillStyle = o.ad === isim ? "rgba(255,194,75,.12)" : "rgba(255,255,255,.03)";
        ctx.fillRect(0, o.y, W, o.h);
        daire(40, o.y + o.h / 2, 22, RENKLER[o.i % RENKLER.length]);
        ctx.fillStyle = "#fff"; ctx.font = "700 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(o.ad[0], 40, o.y + o.h / 2 + 1); ctx.textAlign = "start";
        ctx.fillStyle = RENK.yazi; ctx.font = "700 16px system-ui"; ctx.fillText(o.ad, 76, o.y + o.h / 2 - 10);
        ctx.fillStyle = "#8a96a8"; ctx.font = "14px system-ui"; ctx.fillText("Son mesaj: yarın görüşelim mi?", 76, o.y + o.h / 2 + 12);
      }
      ctx.restore();
    } else if (d.ekran === "kisi") {
      ctx.fillStyle = "#1c2a44"; ctx.fillRect(24, UST + 90, W * 0.6, 44);
      ctx.fillStyle = RENK.yazi; ctx.font = "15px system-ui"; ctx.fillText("Merhaba, nasılsın?", 36, UST + 112);
      for (const o of ogeler()) {
        if (o.id === "geri") continue;
        ctx.fillStyle = o.id === "gonder" ? "#3b82f6" : "#334155";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = "#fff"; ctx.font = "700 16px system-ui"; ctx.textAlign = "center";
        ctx.fillText(o.id === "gonder" ? "Gönder" : "Ara", o.x + o.w / 2, o.y + o.h / 2); ctx.textAlign = "start";
      }
    } else {
      ctx.fillStyle = "#8a96a8"; ctx.font = "16px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`${d.uyg} açıldı`, W / 2, H / 2); ctx.textAlign = "start";
    }
    ctx.textBaseline = "alphabetic";
  }
}

// ------------------------------------------------------------------ sonuçlar
let sonuclar = oku("gk-sonuc", []);
function sonucEkle(tur, ozet, yazi) {
  sonuclar.unshift({ zaman: new Date().toISOString().slice(0, 16).replace("T", " "), tur, mod: $("aMod").value, ozet, yazi, ayar: { ...S }, ornek: P.ornekler.length });
  sonuclar = sonuclar.slice(0, 50);
  yaz("gk-sonuc", sonuclar);
  sonucCiz();
}
function sonucCiz() {
  if (!sonuclar.length) { $("sonuclar").innerHTML = `<p class="not" style="margin:0">Test yaptıkça burada birikir; ayar değiştirip tekrar test ederek karşılaştır.</p>`; return; }
  $("sonuclar").innerHTML = `<table><tr><th>Zaman</th><th>Test</th><th>Sonuç</th><th>Özellik</th><th>Kesim/beta</th></tr>${sonuclar.map((s) =>
    `<tr><td>${s.zaman.slice(5)}</td><td>${s.tur}</td><td>${s.yazi}</td><td>${s.ayar.ozellik}</td><td>${s.ayar.kesim}/${s.ayar.beta}</td></tr>`).join("")}</table>`;
}

// ------------------------------------------------------------------ bağlantılar
$("bKamera").addEventListener("click", kameraBaslat);
$("bKalibre").addEventListener("click", () => sahneAc(kalibrasyon()));
$("bCanli").addEventListener("click", () => sahneAc(canli()));
$("bIsabet").addEventListener("click", () => sahneAc(isabetTesti()));
$("bKilitTest").addEventListener("click", () => sahneAc(tiklamaTesti()));
$("bDokunKal").addEventListener("click", () => sahneAc(dokunarakKalibrasyon(false)));
$("bDokunEkle").addEventListener("click", () => sahneAc(dokunarakKalibrasyon(true)));
$("bParmakTest").addEventListener("click", () => sahneAc(parmakTesti()));
$("bTelefonTest").addEventListener("click", () => sahneAc(telefonTesti()));
$("bProfilSil").addEventListener("click", () => { P.ornekler = []; profilKaydet(); kaymaSifirla(); profilEgit(true); });
$("bKaymaSifirla").addEventListener("click", () => {
  kaymaSifirla();
  const b = $("bKaymaSifirla");
  b.textContent = "Sıfırlandı ✓";
  setTimeout(() => (b.textContent = "Kaymayı sıfırla"), 1500);
});
$("bSonucSil").addEventListener("click", () => { sonuclar = []; yaz("gk-sonuc", sonuclar); sonucCiz(); });
$("bVarsayilan").addEventListener("click", () => { S = { ...VARSAYILAN }; yaz("gk-ayar", S); ayarlariCiz(); profilEgit(true); });
$("aMod").value = oku("gk-mod", "goz");
$("aMod").addEventListener("change", () => yaz("gk-mod", $("aMod").value));
$("bKopyala").addEventListener("click", async () => {
  const metin = JSON.stringify({ surum: SURUM, ayarlar: S, sonuclar: sonuclar.slice(0, 15).map(({ ayar, ...s }) => s), profil: P.deger }, null, 1);
  try { await navigator.clipboard.writeText(metin); $("bKopyala").textContent = "Kopyalandı"; setTimeout(() => ($("bKopyala").textContent = "Sonuçları ve ayarları kopyala"), 1500); }
  catch { const k = $("kopyaKutu"); k.hidden = false; k.textContent = metin; getSelection().selectAllChildren(k); }
});

ayarlariCiz();
sonucCiz();
profilEgit(true);
modelYukle();
