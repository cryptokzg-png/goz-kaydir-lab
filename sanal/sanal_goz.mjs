// Sanal göz: MediaPipe FaceLandmarker yerine geçer. Sanal kullanıcı tuvaldeki sarı hedefe bakar;
// bakış yönünden göz köşeleri, göz bebeği, kapaklar, göz ifadeleri ve baş dönüşüm matrisi üretilir.
// Ayarlar window.SANAL üzerinden (sürücü betiği değiştirir).
const V = (window.SANAL = Object.assign({
  f: 460,            // kamera odak uzaklığı (px), 640x480
  D: 45,             // yüz-telefon uzaklığı (cm)
  ekranCm: [6.8, 15.0], // ekranın görünen alanı (cm)
  kameraUst: 1.0,    // kamera ekranın üst kenarından bu kadar yukarıda (cm)
  gozYaricap: 1.2,   // göz küresi yarıçapı (cm)
  irisGurultu: 0.45, // göz bebeği noktası, kare başına (px)
  koseGurultu: 0.3,  // göz köşeleri / kapaklar (px)
  ifadeGurultu: 0.04,// göz ifadeleri (0–1)
  basGurultu: 0.4,   // baş açısı ölçümü (derece)
  basKayma: 0,       // baş duruşunun yavaş kayması (derece / dakika, rastgele yön)
  basTakip: 0.0,     // baş hedefe doğru ne kadar döner (0–1)
  basSallanma: 0.6,  // doğal küçük baş hareketi (derece)
  sapma: 0.3,        // bakışın hedeften rastgele sapması (derece, mikro sakkad)
  kirpAra: 4000,     // ortalama göz kırpma aralığı (ms)
  tohum: 1,
}, window.SANAL || {}));

let tohum = V.tohum;
const rnd = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const R = Math.PI / 180;

// Durum
const S = {
  hedef: [0.5, 0.5], bakis: [0.5, 0.5], sakkadZaman: 0, yeniHedef: null,
  basYaw: 0, basPitch: -8, basX: 0, basY: -6, D: V.D, kaymaYaw: 0, kaymaPitch: 0, sonT: 0,
  kirpBas: -1, sonrakiKirp: 2000, mod: "bak", basHareket: null,
};
window.SANAL_DURUM = S;

// Tuvalde sarı hedefi bul (hedefin rengi #ffc24b). Küçük kopyada tara.
const kucuk = document.createElement("canvas");
kucuk.width = 120; kucuk.height = 240;
const kctx = kucuk.getContext("2d", { willReadFrequently: true });
let sonTarama = 0;
function hedefBul(t) {
  if (t - sonTarama < 80) return;
  sonTarama = t;
  const tv = document.getElementById("tuval"), sahne = document.getElementById("sahne");
  if (!tv || sahne.hidden) { S.yeniHedef = [0.5, 0.5]; return; }
  kctx.clearRect(0, 0, 120, 240);
  kctx.drawImage(tv, 0, 0, 120, 240);
  const d = kctx.getImageData(0, 0, 120, 240).data;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 180 && d[i + 1] > 120 && d[i + 1] < 230 && d[i + 2] < 140 && d[i + 3] > 100) {
      const p = i / 4; sx += p % 120; sy += Math.floor(p / 120); n++;
    }
  }
  if (n > 3) S.yeniHedef = [(sx / n + 0.5) / 120, (sy / n + 0.5) / 240];
}

function guncelle(t) {
  const dt = S.sonT ? Math.min(0.2, (t - S.sonT) / 1000) : 0;
  S.sonT = t;
  hedefBul(t);
  // Uzaklık adımları (kalibrasyon "yaklaştır/uzaklaştır" isterse)
  const bk = document.getElementById("bekleKutu");
  if (bk && !bk.hidden) {
    const b = document.getElementById("bekleBaslik").textContent + document.getElementById("bekleYazi").textContent;
    if (/yaklaştır|altına/.test(b)) S.D += (V.D * 0.72 - S.D) * Math.min(1, dt * 3);
    else if (/uzaklaştır|üstüne/.test(b)) S.D += (V.D * 1.3 - S.D) * Math.min(1, dt * 3);
  } else S.D += (V.D - S.D) * Math.min(1, dt * 2);
  // Hedef değişince 200 ms sonra sakkad
  const yh = S.yeniHedef;
  if (yh && Math.hypot(yh[0] - S.hedef[0], yh[1] - S.hedef[1]) > 0.01) { S.hedef = yh; S.sakkadZaman = t + 200; }
  if (t >= S.sakkadZaman) S.bakis = S.hedef.slice();
  // Baş: yavaş duruş kayması + hedefe kısmen dönme + doğal sallanma (+ baş hareketi kalibrasyonunda büyük salınım)
  S.kaymaYaw += gauss() * V.basKayma / 60 * Math.sqrt(dt * 60) * 0.5;
  S.kaymaPitch += gauss() * V.basKayma / 60 * Math.sqrt(dt * 60) * 0.5;
  const hb = document.getElementById("hudAlt")?.textContent || "";
  const basHareketi = /başını yavaşça çevir|başını yavaşça sağa/.test(hb);
  const salYaw = basHareketi ? 10 * Math.sin(t / 900) : V.basSallanma * Math.sin(t / 2300);
  const salPitch = basHareketi ? 7 * Math.sin(t / 1300 + 1) : V.basSallanma * Math.sin(t / 3100 + 2);
  const [tx, ty] = hedefCm(S.bakis);
  S.basYaw = S.kaymaYaw + salYaw + V.basTakip * Math.atan2(tx - S.basX, S.D) / R;
  S.basPitch = -8 + S.kaymaPitch + salPitch + V.basTakip * Math.atan2(ty - S.basY, S.D) / R;
  // Kırpma
  if (S.kirpBas < 0 && t > S.sonrakiKirp) S.kirpBas = t;
  if (S.kirpBas >= 0 && t - S.kirpBas > 220) { S.kirpBas = -1; S.sonrakiKirp = t + V.kirpAra * (0.5 + rnd()); }
}

// Ekran noktası (0–1) → kamera koordinatı (cm): x sağ, y yukarı, kamera başlangıç noktası
function hedefCm([x, y]) {
  return [(x - 0.5) * V.ekranCm[0], -(V.kameraUst + y * V.ekranCm[1])];
}

function kirpma(t) {
  if (S.kirpBas < 0) return 0;
  const p = (t - S.kirpBas) / 220;
  return Math.sin(Math.PI * Math.min(1, p)); // 0 → 1 → 0
}

function landmarklar(t) {
  const W = 640, Hh = 480, f = V.f;
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const yuzX = 320 + (S.basX * f) / S.D, yuzY = 240 - ((S.basY + 6) * f) / S.D - 20;
  const gozAra = (3.2 * f) / S.D, gozEn = (2.9 * f) / S.D;
  const b = kirpma(t);
  const [tx, ty] = hedefCm(S.bakis);
  const ifade = {};
  const gozler = [
    { kose: [33, 133], iris: 468, ust: 159, alt: 145, isaret: -1, ad: "Right" },
    { kose: [362, 263], iris: 473, ust: 386, alt: 374, isaret: 1, ad: "Left" },
  ];
  for (const g of gozler) {
    const ex = S.basX + g.isaret * -1 * 3.2, ey = S.basY; // göz konumu (cm); görüntüde aynalanmamış
    const sap = [gauss() * V.sapma, gauss() * V.sapma];
    const gazeYaw = Math.atan2(tx - ex, S.D) / R + sap[0];
    const gazePitch = Math.atan2(ty - ey, S.D) / R + sap[1];
    const gYaw = (gazeYaw - S.basYaw) * R, gPitch = (gazePitch - S.basPitch) * R;
    const cx = yuzX + (g.isaret > 0 ? gozAra / 2 : -gozAra / 2), cy = yuzY;
    // Aynalanmamış görüntü: kişi sağa bakınca göz bebeği görüntüde sola gider
    const ix = cx - Math.sin(gYaw) * V.gozYaricap * f / S.D + gauss() * V.irisGurultu;
    const iy = cy - Math.sin(gPitch) * V.gozYaricap * f / S.D + gauss() * V.irisGurultu;
    const k = (px, py, s = V.koseGurultu) => ({ x: (px + gauss() * s) / W, y: (py + gauss() * s) / Hh, z: 0 });
    lm[g.kose[0]] = k(cx - gozEn / 2, cy);
    lm[g.kose[1]] = k(cx + gozEn / 2, cy);
    lm[g.iris] = { x: ix / W, y: iy / Hh, z: 0 };
    // Kapaklar: üst kapak bakışla birlikte iner, kırpmada alt kapağa yaklaşır
    const altK = cy + gozEn * 0.16;
    const ustAcik = cy - gozEn * 0.22 + (iy - cy) * 0.6;
    lm[g.ust] = k(cx, ustAcik + (altK - ustAcik) * b * 0.95);
    lm[g.alt] = k(cx, altK);
    const lookX = (gYaw / R) / 22, lookY = (gPitch / R) / 18;
    const n = () => gauss() * V.ifadeGurultu;
    const cl = (v) => Math.max(0, Math.min(1, v));
    ifade["eyeBlink" + g.ad] = cl(0.06 + b * 0.9 + Math.max(0, -lookY) * 0.25 + n());
    // Kişinin sağı: sağ gözde "Out", sol gözde "In"
    if (g.ad === "Right") { ifade.eyeLookOutRight = cl(lookX + n()); ifade.eyeLookInRight = cl(-lookX + n()); }
    else { ifade.eyeLookInLeft = cl(lookX + n()); ifade.eyeLookOutLeft = cl(-lookX + n()); }
    ifade["eyeLookUp" + g.ad] = cl(lookY + n());
    ifade["eyeLookDown" + g.ad] = cl(-lookY + n());
  }
  return { lm, ifade };
}

function matris() {
  const a = (S.basYaw + gauss() * V.basGurultu) * R, bb = (S.basPitch + gauss() * V.basGurultu) * R;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(bb), sb = Math.sin(bb);
  // R = Ry(a)·Rx(b), sütun öncelikli (lab: donus = asin(-M2), egim = -atan2(M6, M10))
  const Rm = [
    [ca, sa * sb, sa * cb],
    [0, cb, -sb],
    [-sa, ca * sb, ca * cb],
  ];
  const m = new Array(16).fill(0);
  for (let c = 0; c < 3; c++) for (let rr = 0; rr < 3; rr++) m[c * 4 + rr] = Rm[rr][c];
  m[12] = S.basX + gauss() * 0.1; m[13] = S.basY + gauss() * 0.1; m[14] = -S.D + gauss() * 0.3; m[15] = 1;
  return m;
}

export class FaceLandmarker {
  static async createFromOptions() {
    return {
      detectForVideo(video, t) {
        guncelle(t);
        const { lm, ifade } = landmarklar(t);
        return {
          faceLandmarks: [lm],
          faceBlendshapes: [{ categories: Object.entries(ifade).map(([categoryName, score]) => ({ categoryName, score })) }],
          facialTransformationMatrixes: [{ data: matris() }],
        };
      },
      close() {},
    };
  }
}
export class HandLandmarker { static async createFromOptions() { return { detectForVideo() { return {}; } }; } }
export const FilesetResolver = { forVisionTasks: async () => ({}) };
