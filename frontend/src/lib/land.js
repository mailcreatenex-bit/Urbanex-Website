// Land units and plot-area maths. Base unit: square feet.
// West Bengal convention: 1 bigha = 20 katha, 1 katha = 16 chatak. The size of a katha is NOT the same everywhere
// (720 sq ft is the usual figure around Burdwan), so it is a parameter the visitor can change.
export const DEFAULT_KATHA = 720;

export function unitTable(kathaSqft = DEFAULT_KATHA) {
  return [
    { id: "sqft", label: "Square feet", short: "sq ft", f: 1 },
    { id: "sqm", label: "Square metres", short: "sq m", f: 10.76391041671 },
    { id: "sqyd", label: "Square yards", short: "sq yd", f: 9 },
    { id: "decimal", label: "Decimal (shatak)", short: "decimal", f: 435.6 },
    { id: "katha", label: "Katha (cottah)", short: "katha", f: kathaSqft },
    { id: "chatak", label: "Chatak", short: "chatak", f: kathaSqft / 16 },
    { id: "bigha", label: "Bigha (Bengal)", short: "bigha", f: kathaSqft * 20 },
    { id: "acre", label: "Acre", short: "acre", f: 43560 },
    { id: "hectare", label: "Hectare", short: "hectare", f: 107639.1041671 },
  ];
}

export const toSqft = (value, unitId, katha = DEFAULT_KATHA) => value * unitTable(katha).find(u => u.id === unitId).f;
export const fromSqft = (sqft, unitId, katha = DEFAULT_KATHA) => sqft / unitTable(katha).find(u => u.id === unitId).f;

// lengths -> feet
export const LENGTH = { ft: 1, m: 3.280839895, yd: 3, in: 1 / 12, hath: 1.5 };   // 1 hath (cubit) is taken as 1.5 ft
export const LENGTH_LABEL = { ft: "feet", m: "metres", yd: "yards", in: "inches", hath: "hath (1.5 ft)" };

// "5 ft 6 in" style: feet + inches fields
export const feetInches = (ft, inch) => (Number(ft) || 0) + (Number(inch) || 0) / 12;

export function triangleArea(a, b, c) {
  if (a <= 0 || b <= 0 || c <= 0) return 0;
  if (a + b <= c || a + c <= b || b + c <= a) return NaN;      // the three sides cannot meet
  const s = (a + b + c) / 2;
  return Math.sqrt(s * (s - a) * (s - b) * (s - c));
}

// four sides and one diagonal: sides a, b, c, d go round the plot; the diagonal joins the corner between a-b... to between c-d
// (a, b meet at one end of the diagonal, c, d at the other)
export function quadArea(a, b, c, d, diag) {
  const t1 = triangleArea(a, b, diag), t2 = triangleArea(c, d, diag);
  return Number.isNaN(t1) || Number.isNaN(t2) ? NaN : t1 + t2;
}

export const trapeziumArea = (p, q, h) => ((p + q) / 2) * h;
export const rectangleArea = (l, w) => l * w;

export function fmt(n, d = 2) {
  if (!Number.isFinite(n)) return "—";
  const v = Math.abs(n) >= 100 ? Math.round(n * 10) / 10 : Math.round(n * 10 ** d) / 10 ** d;
  return v.toLocaleString("en-IN", { maximumFractionDigits: d });
}

// "5 katha 3 chatak" from square feet (for people who think in katha and chatak)
export function kathaChatak(sqft, katha = DEFAULT_KATHA) {
  const chatak = katha / 16;
  const total = Math.round((sqft / chatak) * 100) / 100;
  const k = Math.floor(total / 16 + 1e-9);
  const c = Math.round((total - k * 16) * 100) / 100;
  return { katha: k, chatak: c };
}
