"""Ham veri analizi: kalibrasyon ile isabet testi arasında hangi ölçüm farklı davranıyor?

Kullanım: python3 sanal/analiz.py gozkaydir-ham-....json

Her özellik için kalibrasyonda "özellik ≈ a + b·x + c·y" uydurulur (hedefin ekrandaki yeri).
Sonra aynı denklem test noktalarına uygulanır: test ölçümü beklenenden ne kadar sapıyor,
eğim (y'ye duyarlılık) testte de aynı mı? Sapan özellik, tahmini bozan özelliktir.
"""
import json
import sys

import numpy as np

ADLAR = ["irisX", "irisY", "bakisX", "bakisY", "donus", "egim", "basX", "basY", "uzaklik", "kapak"]

d = json.load(open(sys.argv[1]))
kal = [o for o in d["kalibrasyon"] if o["t"] == 0]
print(f"sürüm {d['surum']} · model {d['model']} · kamera {d['kamera']} · ekran {d['ekran']}")
print(f"kalibrasyon örneği {len(kal)} (toplam {len(d['kalibrasyon'])})")
if not d.get("test"):
    sys.exit("testte kare yok")
kareler = [k for k in d["test"]["kareler"] if k["ms"] >= 800]
gec = [k for k in kareler if k["g"] and k["f"]]
print(f"test karesi {len(kareler)} · güvenilir {len(gec)} ({100 * len(gec) / max(1, len(kareler)):.0f}%)")


def nokta_ortanca(ornekler, f_al, xy_al):
    gr = {}
    for o in ornekler:
        gr.setdefault(xy_al(o), []).append(f_al(o))
    xy = np.array(list(gr.keys()))
    f = np.array([np.median(np.array(v), axis=0) for v in gr.values()])
    return xy, f


kxy, kf = nokta_ortanca(kal, lambda o: o["f"], lambda o: (round(o["x"], 3), round(o["y"], 3)))
txy, tf = nokta_ortanca(gec, lambda k: k["f"], lambda k: (k["x"], k["y"]))
A = np.c_[np.ones(len(kxy)), kxy]
coef, *_ = np.linalg.lstsq(A, kf, rcond=None)
At = np.c_[np.ones(len(txy)), txy]
coef_t, *_ = np.linalg.lstsq(At, tf, rcond=None)
beklenen = At @ coef
artik_kal = kf - A @ coef
print("\nözellik     kal eğim x  test eğim x | kal eğim y  test eğim y | test sapması (kal gürültüsü kadar)")
for i, ad in enumerate(ADLAR):
    sap = np.mean(tf[:, i] - beklenen[:, i])
    gur = np.std(artik_kal[:, i]) + 1e-9
    isaret = "  <--" if abs(sap) > 3 * gur or abs(coef_t[2, i]) < 0.5 * abs(coef[2, i]) else ""
    print(f"{ad:9} {coef[1, i]:11.4f} {coef_t[1, i]:12.4f} | {coef[2, i]:10.4f} {coef_t[2, i]:12.4f} | {sap:9.4f} ({sap / gur:+.1f}σ){isaret}")

# Kırpma puanları: açık göz değeri kalibrasyonda ve testte (göz kapağı daha mı kapalı?)
kk = np.array([o["k"] for o in kal if o.get("k")])
tk = np.array([k["s"][:2] for k in gec])
if len(kk):
    print(f"\nkırpma puanı (sol, sağ) kalibrasyon {kk.mean(0).round(3)} · test {tk.mean(0).round(3)}")
# Satır satır: üst / orta / alt test noktalarında kapak ve irisY
print("\ntest satırı   y     kapak(test/kal-beklenen)  irisY(test/beklenen)  bakisY(test/beklenen)")
for j in np.argsort(txy[:, 1]):
    print(f"  ({txy[j, 0]:.2f},{txy[j, 1]:.2f})   {tf[j, 9]:.3f}/{beklenen[j, 9]:.3f}            {tf[j, 1]:.4f}/{beklenen[j, 1]:.4f}       {tf[j, 3]:.3f}/{beklenen[j, 3]:.3f}")
