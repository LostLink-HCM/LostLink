"""Sinh các biểu đồ SVG cho tài liệu thuật toán ghép cặp (docs/design/matching-algorithm.md).

Chạy: python docs/assets/scripts/generate_matching_charts.py [thư_mục_ra]
Mặc định ghi đè các file trong docs/assets/images/. Chỉ dùng thư viện chuẩn của Python.

- matching-time-decay.svg, matching-location-score.svg: biểu đồ động bằng CSS.
  Mặc định (và khi người xem bật giảm chuyển động) SVG hiện khung tĩnh cuối cùng;
  chỉ khi prefers-reduced-motion: no-preference thì lớp animation mới bật.
- matching-evidence-example.svg: biểu đồ tĩnh trọng số từng tiêu chí của ví dụ ở mục 7.

Số liệu là tham số minh họa của tài liệu; đổi tham số thì sửa ở đây rồi chạy lại.
"""
import math
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "images")
os.makedirs(OUT, exist_ok=True)
FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
EPS = 0.01  # % giữa hai keyframe nhảy bậc


def base_style(extra_light, extra_dark, anim_css):
    return f"""<style>
svg {{ --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#6f6d68; --grid:#e1e0d9; --axis:#c3c2b7; --panel:#ffffff; --panel-line:#e1e0d9;{extra_light} }}
@media (prefers-color-scheme: dark) {{ svg {{ --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#a3a29b; --grid:#2c2c2a; --axis:#4a4a46; --panel:#242423; --panel-line:#383835;{extra_dark} }} }}
text {{ font-family: {FONT}; fill: var(--ink2); font-size: 13px; }}
.title {{ fill: var(--ink); font-size: 17px; font-weight: 600; }}
.tick {{ fill: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }}
.lab {{ fill: var(--ink); }}
.val {{ fill: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }}
.grid {{ stroke: var(--grid); stroke-width: 1; }}
.axis {{ stroke: var(--axis); stroke-width: 1; }}
.guide {{ stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }}
.bg {{ fill: var(--surface); }}
.panel {{ fill: var(--panel); stroke: var(--panel-line); stroke-width: 1; }}
.anim {{ visibility: hidden; }}
@media (prefers-reduced-motion: no-preference) {{
.anim {{ visibility: visible; }}
{anim_css}
}}
</style>"""


def svg_open(w, h, title, desc):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-labelledby="t d">\n<title id="t">{title}</title>\n<desc id="d">{desc}</desc>\n')


def path(points):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in points)


def fmt(v, n=2):
    """Số có dấu, dùng dấu trừ thật (U+2212)."""
    return f"{v:+.{n}f}".replace("-", "\u2212")


def dot(x, y, var, cls=""):
    c = f' class="{cls}"' if cls else ""
    return f'<circle{c} cx="{x:.1f}" cy="{y:.1f}" r="4.5" fill="var({var})" stroke="var(--surface)" stroke-width="2"/>'


class Timeline:
    """Dòng thời gian gồm các đoạn: ('wait', giây) hoặc ('sweep', giây, ngày_đầu, ngày_cuối)."""

    def __init__(self, segments):
        self.segs, t = [], 0.0
        for s in segments:
            self.segs.append((t, *s))
            t += s[1]
        self.total = t

    def pct(self, t):
        return 100 * t / self.total

    def day_at(self, t):
        day = 0.0
        for start, kind, dur, *rest in self.segs:
            if kind == "sweep":
                d0, d1 = rest
                if t <= start:
                    return day
                if t <= start + dur:
                    return d0 + (d1 - d0) * (t - start) / dur
                day = d1
        return day

    def time_of(self, day):
        """Lần đầu dòng thời gian chạm tới ngày này."""
        for start, kind, dur, *rest in self.segs:
            if kind == "sweep":
                d0, d1 = rest
                if d0 <= day <= d1:
                    return start + dur * (day - d0) / (d1 - d0)
        raise ValueError(day)

    def start_of(self, index):
        return self.segs[index][0]


def keyframes(name, stops):
    """stops: [(phần trăm, css)], tự thêm 0% và 100% nếu thiếu."""
    stops = sorted(stops, key=lambda s: s[0])
    if stops[0][0] > 0:
        stops.insert(0, (0, stops[0][1]))
    if stops[-1][0] < 100:
        stops.append((100, stops[-1][1]))
    body = " ".join(f"{p:.3f}% {{ {css} }}" for p, css in stops)
    return f"@keyframes {name} {{ {body} }}"


def window(name, tl, t_on, t_off=None):
    """Hiện trong [t_on, t_off), ẩn ngoài khoảng đó."""
    on = tl.pct(t_on)
    stops = [(0, "opacity:0"), (on - EPS, "opacity:0"), (on, "opacity:1")] if on > 0 else [(0, "opacity:1")]
    if t_off is not None:
        off = tl.pct(t_off)
        stops += [(off - EPS, "opacity:1"), (off, "opacity:0"), (100, "opacity:0")]
    else:
        stops += [(100, "opacity:1")]
    return keyframes(name, stops)


def run(cls, name, tl):
    return f".{cls} {{ animation: {name} {tl.total:.2f}s linear infinite; }}"


def readout_panel(x, y, w, rows):
    """rows: [(css var màu hoặc None, nhãn, giá trị)]; dòng đầu là tiêu đề."""
    h = 14 + 20 * len(rows)
    o = [f'<rect class="panel" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>']
    for i, (var, label, value) in enumerate(rows):
        ty = y + 22 + 20 * i
        if var is None:
            o.append(f'<text class="val" x="{x+12}" y="{ty}">{label}</text>')
            continue
        o.append(f'<line x1="{x+12}" y1="{ty-4}" x2="{x+28}" y2="{ty-4}" stroke="var({var})" stroke-width="2.5" stroke-linecap="round"/>')
        o.append(f'<text x="{x+36}" y="{ty}">{label}</text>')
        o.append(f'<text class="val" x="{x+w-12}" y="{ty}" text-anchor="end">{value}</text>')
    return "".join(o)


# ---------- 1. Điểm thời gian: vạch Δt chạy từ 0 đến 30 ngày ----------
def weibull(t, lam, k):
    return math.exp(-((t / lam) ** k))


def chart_time():
    W, H = 760, 440
    L, R, T, B = 64, 150, 120, 64
    pw, ph = W - L - R, H - T - B
    X = lambda t: L + t / 30 * pw
    Y = lambda s: T + (1 - s) * ph
    series = [("--s1", "Thú cưng", 20, 0.7), ("--s3", "Trang sức, phụ kiện", 5, 1), ("--s2", "Ví, giấy tờ", 2, 1.5)]
    tl = Timeline([("wait", 1.6), ("sweep", 2.2, 0, 7), ("wait", 1.8), ("sweep", 3.4, 7, 30),
                   ("wait", 1.0), ("wait", 3.0)])
    t_draw_end, t_hold = tl.start_of(1), tl.start_of(5)

    css = []
    # đường cong tự vẽ trong giai đoạn đầu
    css.append(keyframes("draw", [(0, "stroke-dashoffset:1"), (tl.pct(t_draw_end), "stroke-dashoffset:0")]))
    css.append(f".draw {{ stroke-dasharray: 1 1; animation: draw {tl.total:.2f}s linear infinite; }}")
    # lớp chạy (vạch, chấm, bảng số) hiện từ lúc vẽ xong tới lúc giữ khung cuối
    css.append(window("sweepwin", tl, t_draw_end, t_hold))
    css.append(run("sweep", "sweepwin", tl))
    # khung cuối hiện khi giữ
    css.append(window("finalwin", tl, t_hold))
    css.append(run("final", "finalwin", tl))

    # chuyển động theo ngày, lấy mẫu dày để bám đường cong
    samples = sorted({round(t, 3) for t in [i * tl.total / 150 for i in range(151)] +
                      [tl.start_of(i) for i in range(len(tl.segs))]})
    move = {"vline": []} | {f"d{i}": [] for i in range(len(series))}
    for t in samples:
        d, p = tl.day_at(t), tl.pct(t)
        move["vline"].append((p, f"transform: translate({X(d)-L:.1f}px, 0px)"))
        for i, (_, _, lam, k) in enumerate(series):
            move[f"d{i}"].append((p, f"transform: translate({X(d):.1f}px, {Y(weibull(d, lam, k)):.1f}px)"))
    for k, stops in move.items():
        css.append(keyframes(f"m{k}", stops))
        css.append(run(f"m-{k}", f"m{k}", tl))

    # bảng số theo từng ngày nguyên
    for day in range(31):
        t_on = tl.time_of(day)
        t_off = tl.time_of(day + 1) if day < 30 else t_hold
        css.append(window(f"r{day}", tl, t_on, t_off))
        css.append(run(f"r-{day}", f"r{day}", tl))

    o = [svg_open(W, H, "Điểm thời gian S_time theo khoảng chờ",
                  "Biểu đồ động: vạch Δt chạy từ 0 đến 30 ngày, dừng ở ngày 7. Đường Weibull của ba danh mục: "
                  "sau 7 ngày thú cưng còn 0.62 điểm, trang sức và phụ kiện còn 0.25, ví và giấy tờ còn 0.00; "
                  "sau 30 ngày thú cưng vẫn còn 0.26.")]
    o.append(base_style(" --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a;",
                        " --s1:#3987e5; --s2:#d95926; --s3:#199e70;", "\n".join(css)))
    o.append(f'<rect class="bg" width="{W}" height="{H}" rx="8"/>')
    o.append(f'<text class="title" x="24" y="34">Sau 7 ngày, bài nhặt thú cưng vẫn giữ 0.62 điểm thời gian</text>')
    o.append(f'<text x="24" y="56">Điểm thời gian S_time = exp(−(Δt/λ)^k), tham số minh họa</text>')
    for i, (var, name, lam, k) in enumerate(series):
        x0 = 24 + i * 240
        o.append(f'<line x1="{x0}" y1="84" x2="{x0+22}" y2="84" stroke="var({var})" stroke-width="2.5" stroke-linecap="round"/>')
        o.append(f'<text x="{x0+30}" y="88">{name} (λ = {lam}, k = {k})</text>')
    for s in [0, 0.25, 0.5, 0.75, 1.0]:
        y = Y(s)
        o.append(f'<line class="{"axis" if s == 0 else "grid"}" x1="{L}" y1="{y:.1f}" x2="{L+pw}" y2="{y:.1f}"/>')
        o.append(f'<text class="tick" x="{L-10}" y="{y+4:.1f}" text-anchor="end">{s:.2f}</text>')
    for t in range(0, 31, 5):
        o.append(f'<text class="tick" x="{X(t):.1f}" y="{T+ph+20}" text-anchor="middle">{t}</text>')
    o.append(f'<text class="tick" x="{L+pw/2}" y="{H-14}" text-anchor="middle">Khoảng chờ Δt (ngày)</text>')
    o.append(f'<text class="tick" x="{L-10}" y="{T-14}" text-anchor="end">S_time</text>')
    for var, name, lam, k in series:
        pts = [(X(t / 5), Y(weibull(t / 5, lam, k))) for t in range(0, 151)]
        o.append(f'<path class="draw" pathLength="1" d="{path(pts)}" fill="none" stroke="var({var})" '
                 f'stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')

    # khung cuối (cũng là khung tĩnh)
    o.append('<g class="final">')
    o.append(f'<line class="guide" x1="{X(7):.1f}" y1="{T-4}" x2="{X(7):.1f}" y2="{T+ph}"/>')
    o.append(f'<text class="tick" x="{X(7):.1f}" y="{T-10}" text-anchor="middle">7 ngày</text>')
    for var, name, lam, k in series:
        v = weibull(7, lam, k)
        o.append(dot(X(7), Y(v), var))
        o.append(f'<text class="val" x="{X(7)+10:.1f}" y="{Y(v)-10:.1f}">{v:.2f}</text>')
    pet30 = weibull(30, 20, 0.7)
    o.append(f'<text class="lab" x="{X(30)+10:.1f}" y="{Y(pet30)-4:.1f}">Thú cưng</text>')
    o.append(f'<text class="val" x="{X(30)+10:.1f}" y="{Y(pet30)+13:.1f}">{pet30:.2f}</text>')
    o.append(f'<text class="lab" x="{X(30)+10:.1f}" y="{Y(0)-10:.1f}">Trang sức</text>')
    o.append(f'<text class="lab" x="{X(30)+10:.1f}" y="{Y(0)+8:.1f}">Ví, giấy tờ</text>')
    o.append('</g>')

    # lớp chạy
    o.append('<g class="anim sweep">')
    o.append(f'<line class="guide m-vline" x1="{L}" y1="{T-4}" x2="{L}" y2="{T+ph}"/>')
    for i, (var, *_) in enumerate(series):
        o.append(dot(0, 0, var, f"m-d{i}"))
    px, py, pwid = X(18.5), T + 8, 205
    for day in range(31):
        o.append(f'<g class="r-{day}">' + readout_panel(px, py, pwid, [(None, f"Δt = {day} ngày", "")] + [
            (var, name, f"{weibull(day, lam, k):.2f}") for var, name, lam, k in series
        ]) + '</g>')
    o.append('</g>')
    o.append('</svg>\n')
    return "\n".join(o)


# ---------- 2. Điểm vị trí: vùng tìm nở ra theo Δt ----------
def chart_location():
    W, H = 760, 460
    L, R, T, B = 64, 40, 120, 84
    pw, ph = W - L - R, H - T - B
    DMAX = 10
    X = lambda d: L + d / DMAX * pw
    Y = lambda s: T + (1 - s) * ph
    sigma0, D = 800, 150000
    sig = lambda dt: math.sqrt(sigma0 ** 2 + 2 * D * dt) / 1000  # km
    s1km = lambda dt: math.exp(-1 / (2 * sig(dt) ** 2))
    traces = [("--o1", 0), ("--o2", 7), ("--o3", 30)]
    tl = Timeline([("wait", 1.4), ("sweep", 2.6, 0, 7), ("wait", 1.4), ("sweep", 3.4, 7, 30),
                   ("wait", 0.8), ("wait", 3.0)])
    t_hold = tl.start_of(5)

    css = []
    # đường chạy: một đường Gauss gốc (σ lớn nhất) co giãn theo trục ngang quanh gốc tọa độ
    smax = sig(30)
    samples = sorted({round(t, 3) for t in [i * tl.total / 150 for i in range(151)] +
                      [tl.start_of(i) for i in range(len(tl.segs))]})
    mv = {"curve": [], "dot": [], "tick": []}
    for t in samples:
        dt, p = tl.day_at(t), tl.pct(t)
        sc = sig(dt) / smax
        mv["curve"].append((p, f"transform: translate({L}px, 0px) scale({sc:.4f}, 1) translate({-L}px, 0px)"))
        mv["dot"].append((p, f"transform: translate({X(1):.1f}px, {Y(s1km(dt)):.1f}px)"))
        mv["tick"].append((p, f"transform: translate({X(min(3 * sig(dt), DMAX)) - L:.1f}px, 0px)"))
    for k, stops in mv.items():
        css.append(keyframes(f"m{k}", stops))
        css.append(run(f"m-{k}", f"m{k}", tl))
    css.append(window("sweepwin", tl, 0, t_hold))
    css.append(run("sweep", "sweepwin", tl))
    # vệt của 0, 7, 30 ngày xuất hiện khi vạch chạy tới và ở lại tới hết vòng
    for var, dt in traces:
        css.append(window(f"tr{dt}", tl, tl.time_of(dt) if dt else 0.0))
        css.append(run(f"trace-{dt}", f"tr{dt}", tl))
    for day in range(31):
        t_on = tl.time_of(day) if day else 0.0
        t_off = tl.time_of(day + 1) if day < 30 else t_hold
        css.append(window(f"r{day}", tl, t_on, t_off))
        css.append(run(f"r-{day}", f"r{day}", tl))

    o = [svg_open(W, H, "Điểm vị trí S_loc theo khoảng cách",
                  "Biểu đồ động: đường Gauss của danh mục thú cưng nở rộng khi Δt tăng từ 0 đến 30 ngày, "
                  "để lại ba vệt tại 0, 7 và 30 ngày. Cùng khoảng cách 1 km cho điểm 0.46, 0.83 và 0.95.")]
    o.append(base_style(" --o1:#2a78d6; --o2:#eb6834; --o3:#1baf7a; --mv:#898781;",
                        " --o1:#3987e5; --o2:#d95926; --o3:#199e70; --mv:#898781;", "\n".join(css)))
    o.append(f'<defs><clipPath id="plot"><rect x="{L}" y="{T-6}" width="{pw}" height="{ph+12}"/></clipPath></defs>')
    o.append(f'<rect class="bg" width="{W}" height="{H}" rx="8"/>')
    o.append(f'<text class="title" x="24" y="34">Cùng cách 1 km: điểm vị trí tăng từ 0.46 lúc mất lên 0.95 sau 30 ngày</text>')
    o.append(f'<text x="24" y="56">Điểm vị trí S_loc của danh mục thú cưng, σ₀ = 800 m, D = 150 000 m²/ngày</text>')
    for i, (var, dt) in enumerate(traces):
        x0 = 24 + i * 150
        o.append(f'<line x1="{x0}" y1="84" x2="{x0+22}" y2="84" stroke="var({var})" stroke-width="2.5" stroke-linecap="round"/>')
        o.append(f'<text x="{x0+30}" y="88">Δt = {dt} ngày</text>')
    for s in [0, 0.25, 0.5, 0.75, 1.0]:
        y = Y(s)
        o.append(f'<line class="{"axis" if s == 0 else "grid"}" x1="{L}" y1="{y:.1f}" x2="{L+pw}" y2="{y:.1f}"/>')
        o.append(f'<text class="tick" x="{L-10}" y="{y+4:.1f}" text-anchor="end">{s:.2f}</text>')
    for d in range(0, DMAX + 1, 2):
        o.append(f'<text class="tick" x="{X(d):.1f}" y="{T+ph+20}" text-anchor="middle">{d}</text>')
    o.append(f'<text class="tick" x="{L+pw/2}" y="{T+ph+40}" text-anchor="middle">Khoảng cách d (km)</text>')
    o.append(f'<text class="tick" x="{L-10}" y="{T-14}" text-anchor="end">S_loc</text>')
    o.append(f'<line class="guide" x1="{X(1):.1f}" y1="{T-4}" x2="{X(1):.1f}" y2="{T+ph}"/>')
    o.append(f'<text class="tick" x="{X(1):.1f}" y="{T-10}" text-anchor="middle">1 km</text>')
    o.append(f'<text class="tick" x="{L}" y="{H-12}">Vạch đứng ở trục hoành: bán kính lọc 3σ (2.4 km, 5.0 km, 9.3 km)</text>')

    # ba vệt (cũng là khung tĩnh)
    for var, dt in traces:
        s = sig(dt)
        f = lambda d: math.exp(-d * d / (2 * s * s))
        pts = [(X(d / 20), Y(f(d / 20))) for d in range(0, DMAX * 20 + 1)]
        v = f(1)
        txt = f"{v:.3f}" if v < 0.01 else f"{v:.2f}"
        o.append(f'<g class="trace-{dt}">')
        o.append(f'<path d="{path(pts)}" fill="none" stroke="var({var})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')
        o.append(dot(X(1), Y(v), var))
        o.append(f'<text class="val" x="{X(1)+10:.1f}" y="{Y(v)-10:.1f}">{txt}</text>')
        o.append(f'<line x1="{X(3*s):.1f}" y1="{T+ph-6}" x2="{X(3*s):.1f}" y2="{T+ph+6}" stroke="var({var})" stroke-width="2"/>')
        o.append('</g>')

    # lớp chạy
    base = [(X(d / 30), Y(math.exp(-(d / 30) ** 2 / (2 * smax ** 2)))) for d in range(0, DMAX * 30 + 1)]
    base.append((L + 12 * pw, Y(0)))  # kéo dài để khi co lại vẫn phủ hết trục
    o.append('<g class="anim sweep">')
    o.append(f'<g clip-path="url(#plot)"><path class="m-curve" d="{path(base)}" fill="none" stroke="var(--mv)" '
             f'stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/></g>')
    o.append(f'<line class="m-tick" x1="{L}" y1="{T+ph-8}" x2="{L}" y2="{T+ph+8}" stroke="var(--mv)" stroke-width="2"/>')
    o.append(dot(0, 0, "--mv", "m-dot"))
    px, py, pwid = X(6.2), T + 8, 245
    for day in range(31):
        o.append(f'<g class="r-{day}">' + readout_panel(px, py, pwid, [
            (None, f"Δt = {day} ngày", ""),
            ("--mv", "Bán kính lọc 3σ", f"{3 * sig(day):.1f} km"),
            ("--mv", "S_loc tại 1 km", f"{s1km(day):.3f}" if s1km(day) < 0.01 else f"{s1km(day):.2f}"),
        ]) + '</g>')
    o.append('</g>')
    o.append('</svg>\n')
    return "\n".join(o)


# ---------- 3. Bằng chứng từng tiêu chí của hai ví dụ ----------
def bar(x0, x1, y, h, var, r=4):
    # vuông ở đường gốc x0, bo tròn ở đầu dữ liệu x1
    if abs(x1 - x0) < 0.5:
        return ""
    sgn = 1 if x1 > x0 else -1
    r = min(r, abs(x1 - x0))
    xa = x1 - sgn * r
    sweep = 1 if sgn > 0 else 0
    d = (f"M{x0:.1f},{y:.1f} L{xa:.1f},{y:.1f} "
         f"A{r},{r} 0 0 {sweep} {x1:.1f},{y+r:.1f} L{x1:.1f},{y+h-r:.1f} "
         f"A{r},{r} 0 0 {sweep} {xa:.1f},{y+h:.1f} L{x0:.1f},{y+h:.1f} Z")
    return f'<path d="{d}" fill="var({var})"/>'


def chart_evidence():
    crit = ["Danh mục", "Thời gian", "Vị trí", "Loài", "Giống", "Màu", "Mô tả"]
    A = [4.98, -0.58, 2.97, 0.79, 2.17, 1.58, 0.16]
    B = [4.98, 1.58, 3.94, 0.79, -3.00, -2.81, -1.91]
    W = 760
    L, R = 120, 40
    pw = W - L - R
    VMIN, VMAX = -4, 6
    X = lambda v: L + (v - VMIN) / (VMAX - VMIN) * pw
    row, bh = 28, 18
    panel_h = len(crit) * row + 70
    T0 = 100
    H = T0 + 2 * panel_h + 30
    o = [svg_open(W, H, "Bằng chứng từng tiêu chí của hai ví dụ",
                  f"Bài A tổng W = {sum(A):+.1f} bit, bài B tổng W = {sum(B):+.1f} bit. "
                  "B gần cả thời gian lẫn vị trí nhưng khác giống, khác màu, mô tả không khớp nên bị trừ điểm.")]
    o.append(base_style(" --pos:#2a78d6; --neg:#e34948;", " --pos:#3987e5; --neg:#e66767;", ""))
    o.append(f'<rect class="bg" width="{W}" height="{H}" rx="8"/>')
    o.append(f'<text class="title" x="24" y="34">Mâu thuẫn bị trừ điểm, nên gần về thời gian và vị trí không đủ để thành gợi ý</text>')
    o.append(f'<text x="24" y="56">Trọng số wᵢ (bit) của từng tiêu chí, ví dụ ở mục 7</text>')
    for i, (var, name) in enumerate([("--pos", "Ủng hộ (cộng điểm)"), ("--neg", "Chống lại (trừ điểm)")]):
        x0 = 24 + i * 200
        o.append(f'<rect x="{x0}" y="70" width="12" height="12" rx="3" fill="var({var})"/>')
        o.append(f'<text x="{x0+20}" y="81">{name}</text>')
    for p, (label, vals) in enumerate([("Bài A: Poodle nâu, sau 11.5 ngày, cách 1.2 km", A),
                                       ("Bài B: Corgi vàng, cùng tối, cách 200 m", B)]):
        top = T0 + p * panel_h
        tot = sum(vals)
        o.append(f'<text class="lab" x="24" y="{top+14}" font-weight="600">{label}</text>')
        y0 = top + 28
        for v in range(VMIN, VMAX + 1, 2):
            cls = "axis" if v == 0 else "grid"
            o.append(f'<line class="{cls}" x1="{X(v):.1f}" y1="{y0-4}" x2="{X(v):.1f}" y2="{y0+len(crit)*row}"/>')
        for i, (c, v) in enumerate(zip(crit, vals)):
            y = y0 + i * row + (row - bh) / 2
            o.append(f'<text x="{L-12}" y="{y+bh/2+4:.1f}" text-anchor="end">{c}</text>')
            o.append(bar(X(0), X(v), y, bh, "--pos" if v >= 0 else "--neg"))
            tx = X(v) + (8 if v >= 0 else -8)
            anc = "start" if v >= 0 else "end"
            o.append(f'<text class="val" x="{tx:.1f}" y="{y+bh/2+4:.1f}" text-anchor="{anc}">{fmt(v)}</text>')
        yb = y0 + len(crit) * row + 4
        for v in range(VMIN, VMAX + 1, 2):
            o.append(f'<text class="tick" x="{X(v):.1f}" y="{yb+14}" text-anchor="middle">{fmt(v, 0)}</text>')
        o.append(f'<text class="val" x="{L+pw}" y="{top+14}" text-anchor="end">Tổng W = {fmt(tot, 1)} bit</text>')
    o.append('</svg>\n')
    return "\n".join(o)


CHARTS = [
    ("matching-time-decay.svg", chart_time),
    ("matching-location-score.svg", chart_location),
    ("matching-evidence-example.svg", chart_evidence),
]

if __name__ == "__main__":
    for name, fn in CHARTS:
        target = os.path.join(OUT, name)
        with open(target, "w", encoding="utf-8", newline="\n") as f:
            f.write(fn())
        print("wrote", os.path.normpath(target), os.path.getsize(target), "bytes")
