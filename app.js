// GözKaydır Lab — Android uygulamasındaki göz takip hattının tarayıcı sürümü.
// Özellikler, model, filtre, kırpma eşiği, kalibrasyon ve imleç modları Kotlin koduyla birebir aynı mantıkta;
// buradaki ayarlar bulunduktan sonra uygulamaya aktarılır.
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const SURUM = "lab 2";
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
  { k: "ozellik", ad: "Göz özellikleri", secenek: [["yeni", "Yeni (uzaklık + kapak, 10)"], ["eski", "Eski (6)"]], v: "yeni", not: "Değiştirince model aynı örneklerle yeniden eğitilir: farkı hemen ölçebilirsin." },
  { k: "lambda", ad: "Düzenleme (lambda)", min: 0.002, max: 0.2, adim: 0.002, v: 0.02, not: "Yüksek = daha kararlı ama daha az esnek model." },
  { k: "izgara", ad: "Izgara", secenek: [["oto", "Otomatik"], ["2x3", "2×3"], ["2x4", "2×4"], ["3x3", "3×3"], ["3x4", "3×4"]], v: "oto" },
  { k: "bolgeMs", ad: "Bölge değişme süresi (ms)", min: 0, max: 1000, adim: 50, v: 300 },
  { b: "Kalibrasyon" },
  { k: "noktaSure", ad: "Nokta başına süre (ms)", min: 1000, max: 3000, adim: 100, v: 1800 },
  { k: "toplamaBasi", ad: "Toplamaya başlama (ms)", min: 300, max: 1500, adim: 50, v: 700, not: "Göz noktaya varana kadar beklenen süre." },
  { k: "uzaklikAsama", ad: "Yakın ve uzak aşamaları", secenek: [["acik", "Açık"], ["kapali", "Kapalı"]], v: "acik" },
  { b: "Kilitle modu" },
  { k: "kilitSabitMs", ad: "Kilitlenme süresi (ms)", min: 200, max: 1500, adim: 50, v: 500 },
  { k: "kilitYaricap", ad: "Sabit bakış yarıçapı (px)", min: 20, max: 100, adim: 5, v: 45 },
  { k: "kilitKazanc", ad: "Baş ince ayar hızı (px/derece)", min: 4, max: 30, adim: 1, v: 12 },
  { k: "kilitOlu", ad: "Baş ölü bölgesi (derece)", min: 0, max: 2, adim: 0.1, v: 0.6 },
  { k: "kilitCikis", ad: "Kilidi açma uzaklığı (px)", min: 60, max: 250, adim: 10, v: 130 },
  { k: "basTersX", ad: "Baş yönü sağ-sol", secenek: [["normal", "Normal"], ["ters", "Ters"]], v: "normal" },
  { k: "basTersY", ad: "Baş yönü yukarı-aşağı", secenek: [["normal", "Normal"], ["ters", "Ters"]], v: "normal" },
  { b: "Tıklama (bakıp bekle)" },
  { k: "bekleTikMs", ad: "Bekleme süresi (ms)", min: 400, max: 2500, adim: 50, v: 1000 },
  { k: "bekleEsik", ad: "Sabit sayılma eşiği, göz modu (px)", min: 8, max: 60, adim: 2, v: 28 },
  { b: "Performans" },
  { k: "gpu", ad: "Yüz modeli işlemcisi", secenek: [["cpu", "CPU"], ["gpu", "GPU"]], v: "cpu", not: "GPU daha yüksek kare hızı verebilir; değiştirince model yeniden yüklenir." },
];
const VARSAYILAN = Object.fromEntries(AYAR_TANIM.filter((a) => a.k).map((a) => [a.k, a.v]));
let S = { ...VARSAYILAN };
function oku(anahtar, yedek) { try { const v = localStorage.getItem(anahtar); return v ? JSON.parse(v) : yedek; } catch { return yedek; } }
function yaz(anahtar, v) { try { localStorage.setItem(anahtar, JSON.stringify(v)); } catch {} }
S = { ...VARSAYILAN, ...oku("gk-ayar", {}) };

function ayarlariCiz() {
  const kap = $("ayarlar");
  kap.innerHTML = "";
  let grup = null;
  for (const a of AYAR_TANIM) {
    if (a.b) {
      grup = document.createElement("details");
      if (a.b === "Yumuşatma ve kırpma" || a.b === "Model") grup.open = true;
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

function egit(ornekler, set = S.ozellik) {
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
  const wx = sirt(X, ornekler.map((o) => o.x), W);
  const wy = sirt(X, ornekler.map((o) => o.y), W);
  return wx && wy ? new Model(mu, sd, wx, wy, set) : null;
}

function sirt(X, y, w) {
  const n = X[0].length;
  const m = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (let k = 0; k < X.length; k++) {
    const r = X[k], a = w[k];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) m[i][j] += a * r[i] * r[j];
      m[i][n] += a * r[i] * y[k];
    }
  }
  const lambda = S.lambda * X.length;
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
const P = { ornekler: oku("gk-profil", []), model: null, deger: null, cols: 3, rows: 3, aralik: null };

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
  $("profilOzet").textContent = `${kal} kalibrasyon + ${duz} düzeltme örneği · özellik: ${S.ozellik}${ar} · seçili ızgara ${P.cols}×${P.rows}` + (P.model ? "" : " · model eğitilemedi");
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
    for (const b of ["bKalibre", "bCanli", "bIsabet", "bKilitTest"]) $(b).disabled = false;
    requestAnimationFrame(dongu);
  } catch (e) {
    $("kameraNot").textContent = "Kamera açılamadı: " + (e?.message || e) + ". Tarayıcıya kamera izni verip tekrar dene.";
  }
}

const isikTuval = document.createElement("canvas");
isikTuval.width = 16; isikTuval.height = 12;
const isikCtx = isikTuval.getContext("2d", { willReadFrequently: true });
let isik = 0, kareSay = 0, sonVideoZaman = -1, fpsSay = 0, fpsBasi = performance.now(), fps = 0, algilamaMs = 0;

function dongu() {
  requestAnimationFrame(dongu);
  if (!yuzModeli || video.readyState < 2 || video.currentTime === sonVideoZaman) return;
  sonVideoZaman = video.currentTime;
  const t = performance.now();
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
  tahminGuncelle(k);
  sonKare = k;
  aktif?.kare?.(k, t);
}
let sonKare = null;

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
  const [px, py] = P.model.tahmin(k.f);
  G.hamX = px; G.hamY = py;
  // Sıçrama süzgeci: büyük ani sıçrama ancak sonraki karelerde de aynı yerde kalırsa kabul edilir.
  if (G.gecerli && S.sicramaKare > 0 && Math.hypot(px - G.x, py - G.y) > S.sicramaEsik) {
    if (aday.n > 0 && Math.hypot(px - aday.x, py - aday.y) < S.sicramaEsik / 2) aday.n++;
    else { aday.x = px; aday.y = py; aday.n = 1; }
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
  requestAnimationFrame(cizDongu);
}

function hud(baslik, alt, bilgi) {
  if (baslik !== null) $("hudBaslik").textContent = baslik;
  if (alt !== null) $("hudAlt").textContent = alt;
  if (bilgi !== null) { $("hudBilgi").textContent = bilgi; $("hudBilgiKutu").hidden = !bilgi; }
}

function dugmeler(liste) {
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
function imlecCiz(x, y, kilitli, ilerleme) {
  daire(x, y, 22, "rgba(255,194,75,.18)", kilitli ? RENK.iyi : RENK.vurgu, 3);
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
function imlecMotoru(hedefler = () => []) {
  const m = {
    x: W / 2, y: H / 2, kilitli: false, ilerleme: 0, asama: 1, zoom: null,
    takip: new HucreTakip(P.cols, P.rows),
    basD: NaN, basE: 0, refD: 0, refE: 0, kilitX: 0, kilitY: 0,
    sabitX: -1e4, sabitY: -1e4, sabitBasi: 0, uzakBasi: 0,
    bekleX: -1e4, bekleY: -1e4, bekleBasi: 0, tetik: false,
  };
  m.kilitBirak = () => { m.kilitli = false; m.sabitX = -1e4; m.uzakBasi = 0; };
  m.zoomBitir = () => { m.asama = 1; m.zoom = null; m.takip.sifirla(); };

  /** @returns {x,y} tıklama olduysa */
  m.guncelle = (k, t) => {
    if (!G.gecerli || !k.f || !k.guvenilir) return null;
    const mod = $("aMod").value;
    const gx = G.x * W, gy = G.y * H;
    if (mod === "izgara") return izgaraIsle(t);

    // baş açısı yumuşatma
    if (Number.isNaN(m.basD)) { m.basD = k.s.donus; m.basE = k.s.egim; }
    m.basD += (k.s.donus - m.basD) * 0.35;
    m.basE += (k.s.egim - m.basE) * 0.35;

    if (mod === "goz") { m.x = gx; m.y = gy; }
    else if (!m.kilitli) {
      m.x = gx; m.y = gy;
      if (Math.hypot(gx - m.sabitX, gy - m.sabitY) > S.kilitYaricap) { m.sabitX = gx; m.sabitY = gy; m.sabitBasi = t; }
      else if (t - m.sabitBasi >= S.kilitSabitMs) {
        m.kilitli = true; m.kilitX = m.x; m.kilitY = m.y; m.refD = m.basD; m.refE = m.basE; m.uzakBasi = 0;
        m.bekleX = m.x; m.bekleY = m.y; m.bekleBasi = t; m.tetik = false;
      }
    } else {
      const olu = (v) => (Math.abs(v) < S.kilitOlu ? 0 : v - Math.sign(v) * S.kilitOlu);
      const sx = S.basTersX === "ters" ? -1 : 1, sy = S.basTersY === "ters" ? 1 : -1;
      m.x = kis(m.kilitX + sx * olu(m.basD - m.refD) * S.kilitKazanc, 0, W - 1);
      m.y = kis(m.kilitY + sy * olu(m.basE - m.refE) * S.kilitKazanc, 0, H - 1);
      if (Math.hypot(gx - m.x, gy - m.y) > S.kilitCikis) {
        if (!m.uzakBasi) m.uzakBasi = t;
        if (t - m.uzakBasi >= 350) { m.kilitBirak(); m.x = gx; m.y = gy; }
      } else m.uzakBasi = 0;
    }

    // bakıp bekle tıklaması
    m.ilerleme = 0;
    if (mod === "kilit" && !m.kilitli) return null;
    const esik = mod === "kilit" ? 8 : S.bekleEsik;
    if (Math.hypot(m.x - m.bekleX, m.y - m.bekleY) > esik) { m.bekleX = m.x; m.bekleY = m.y; m.bekleBasi = t; m.tetik = false; }
    else if (!m.tetik) {
      m.ilerleme = (t - m.bekleBasi) / S.bekleTikMs;
      if (m.ilerleme >= 1) {
        m.tetik = true; m.ilerleme = 0;
        const tik = { x: m.x, y: m.y };
        if (mod === "kilit") m.kilitBirak();
        return tik;
      }
    }
    return null;
  };

  // Izgara: 1. aşamada bölge, içinde tek hedef varsa tıkla, yoksa yakınlaştır; 2. aşamada alt bölgeye tıkla.
  function izgaraIsle(t) {
    const tk = m.takip;
    if (tk.cols !== P.cols || tk.rows !== P.rows) { tk.cols = P.cols; tk.rows = P.rows; tk.sifirla(); }
    const h = tk.guncelle(G.x, G.y, t);
    m.ilerleme = (t - tk.basi) / S.bekleTikMs;
    if (m.ilerleme < 1) return null;
    m.ilerleme = 0;
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
        const p = Math.min(1, (t - durum.basi) / S.noktaSure);
        daire(x * W, y * H, 30, null, RENK.vurgu, 3);
        daire(x * W, y * H, 30 * (1 - 0.6 * p), RENK.vurgu);
        daire(x * W, y * H, 2.5, "#0d1117");
      }
    },
    kapat() { $("bekleKutu").hidden = true; },
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
      const grup = G.sonOz.map((f) => ({ f: f.slice(), x: nx, y: ny, t: 2 }));
      P.ornekler.push(...grup);
      let fazla = P.ornekler.filter((o) => o.t === 2).length - 600;
      if (fazla > 0) P.ornekler = P.ornekler.filter((o) => !(o.t === 2 && fazla-- > 0));
      oturum.push(grup);
      P.model = egit(P.ornekler);
      profilKaydet();
      duzeltme = { x1: G.x * W, y1: G.y * H, x2: nx * W, y2: ny * H, bitis: performance.now() + 1500 };
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
  const d = { sira: -1, basi: performance.now(), ornek: [], sonuc: [] };
  function bitir() {
    const hata = d.sonuc.map((r) => r.hata), sirali = [...hata].sort((a, b) => a - b);
    const ort = hata.reduce((a, b) => a + b, 0) / hata.length;
    const titreme = d.sonuc.reduce((a, r) => a + r.titreme, 0) / d.sonuc.length;
    const isabet = (c, r) => d.sonuc.filter((s) => Math.abs(s.ex) < W / c / 2 && Math.abs(s.ey) < H / r / 2).length / d.sonuc.length;
    const ozet = { ortPx: Math.round(ort), ortancaPx: Math.round(sirali[sirali.length >> 1]), enKotuPx: Math.round(sirali.at(-1)), titremePx: Math.round(titreme), i3x3: Math.round(isabet(3, 3) * 100), i3x4: Math.round(isabet(3, 4) * 100) };
    sonucEkle("İsabet", ozet, `ort ${ozet.ortPx} px (≈${Math.round(ozet.ortPx * 0.159)} mm) · ortanca ${ozet.ortancaPx} · titreme ±${ozet.titremePx} · 3×3 %${ozet.i3x3}`);
    hud("İsabet testi bitti", `Ortalama hata ${ozet.ortPx} px ≈ ${Math.round(ozet.ortPx * 0.159)} mm · titreme ±${ozet.titremePx} px`, `Ortanca ${ozet.ortancaPx} px · en kötü ${ozet.enKotuPx} px\n3×3 isabet %${ozet.i3x3} · 3×4 isabet %${ozet.i3x4}`);
    dugmeler([["Tekrar", () => { sahneKapat(); sahneAc(isabetTesti()); }, true]]);
  }
  return {
    ac() { hud("İsabet testi", "Beliren noktaya bak. İmleç gösterilmez (kovalama olmasın).", ""); },
    kare(k, t) {
      if (d.sira < 0 || d.sira >= noktalar.length) return;
      if (t - d.basi >= YOK && G.gecerli && k.f) d.ornek.push([G.x * W, G.y * H]);
    },
    ciz() {
      const t = performance.now();
      if (!P.model) { hud("Önce kalibre et", "", ""); return; }
      if (d.sira === -1) { if (t - d.basi > 1000) { d.sira = 0; d.basi = t; } return; }
      if (d.sira >= noktalar.length) return;
      const [nx, ny] = noktalar[d.sira];
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
        d.ornek = []; d.sira++; d.basi = t;
        if (d.sira >= noktalar.length) { d.sonuc.length >= 5 ? bitir() : hud("Yeterli ölçüm yok", "Yüzünün göründüğünden emin ol", ""); }
      }
    },
  };
}

// ------------------------------------------------------------------ tıklama testi
function tiklamaTesti() {
  const SAYI = 8, R = 18, ZAMAN = 15000;
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
    ac() { sonraki(); hud("Tıklama testi", "Sarı hedefe bakıp bekle. Gri hedefler tuzak.", ""); },
    kare(k, t) {
      if (!d.hedef) return;
      const tik = im.guncelle(k, t);
      if (tik) {
        const isabet = Math.hypot(tik.x - d.hedef.x, tik.y - d.hedef.y) <= R + 2;
        d.flas = { ...tik, iyi: isabet, bitis: t + 600 };
        if (isabet) { d.dogru++; d.sureler.push(t - d.basi); d.sira++; d.sira >= SAYI ? bitir() : sonraki(); }
        else d.yanlis++;
      } else if (t - d.basi > ZAMAN) { d.kacan++; d.sira++; d.sira >= SAYI ? bitir() : sonraki(); }
    },
    ciz() {
      const t = performance.now();
      if (!P.model) { hud("Önce kalibre et", "", ""); return; }
      if (d.hedef) hud(`Tıklama testi · ${d.sira + 1} / ${SAYI}`, null, `${d.dogru} doğru · ${d.yanlis} yanlış · kalan ${Math.max(0, (ZAMAN - (t - d.basi)) / 1000).toFixed(0)} sn`);
      im.ciz((olcek) => {
        for (const h of d.tuzak) daire(h.x, h.y, h.r, "rgba(255,255,255,.18)", "rgba(255,255,255,.4)", 2 * olcek);
        if (d.hedef) { daire(d.hedef.x, d.hedef.y, R, "rgba(255,194,75,.35)", RENK.vurgu, 3 * olcek); daire(d.hedef.x, d.hedef.y, 2.5 * olcek, RENK.vurgu); }
      });
      if (d.flas && t < d.flas.bitis) daire(d.flas.x, d.flas.y, 10, d.flas.iyi ? RENK.iyi : RENK.uyari);
    },
  };
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
$("bProfilSil").addEventListener("click", () => { P.ornekler = []; profilKaydet(); profilEgit(true); });
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
