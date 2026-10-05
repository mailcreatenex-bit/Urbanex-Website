// Mirrors the server's phone rules (backend clean_phone) so people get an instant message.
// The server stays the authority: it re-checks and normalises to +91XXXXXXXXXX (or +<country><number>).
const fake = (d) => {
  if (new Set(d).size <= 2) return true;
  if (/(\d)\1{6,}/.test(d)) return true;
  for (const step of [1, -1]) {
    let run = 1;
    for (let i = 1; i < d.length; i++) {
      run = Number(d[i]) - Number(d[i - 1]) === step ? run + 1 : 1;
      if (run >= 7) return true;
    }
  }
  return false;
};

export function checkPhone(raw) {
  const s = String(raw || "").trim();
  if (!/^\+?[0-9()\-\s]{6,20}$/.test(s)) return { ok: false, error: "Enter a valid phone number." };
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("+") && !digits.startsWith("91")) {          // overseas (NRI) number
    return digits.length >= 8 && digits.length <= 15 && new Set(digits).size > 2
      ? { ok: true, value: `+${digits}` }
      : { ok: false, error: "Enter a valid phone number including the country code." };
  }
  if (s.startsWith("+")) digits = digits.slice(2);
  else if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10 || !"6789".includes(digits[0])) {
    return { ok: false, error: "Enter a valid 10-digit mobile number (it starts with 6, 7, 8 or 9)." };
  }
  if (fake(digits)) return { ok: false, error: "Please enter your real phone number." };
  return { ok: true, value: `+91${digits}` };
}

// Best human-readable message from an API error (FastAPI/pydantic or plain detail).
export function apiError(e, fallback = "Something went wrong. Please try again.") {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, "");
  return fallback;
}
