// Indian number formatting helpers. Never uses the em dash character.

export function formatINR(value, opts = {}) {
  const { decimals = 0, sign = false } = opts;
  if (value == null || isNaN(value)) return "\u20B90";
  const neg = value < 0;
  const abs = Math.abs(value);
  const str = abs.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = neg ? "-" : sign ? "+" : "";
  return `${prefix}\u20B9${str}`;
}

// Compact Lakh / Crore formatting for executive views.
export function formatINRCompact(value) {
  if (value == null || isNaN(value)) return "\u20B90";
  const neg = value < 0;
  const abs = Math.abs(value);
  let out;
  if (abs >= 1e7) out = `${(abs / 1e7).toFixed(2)} Cr`;
  else if (abs >= 1e5) out = `${(abs / 1e5).toFixed(2)} L`;
  else if (abs >= 1e3) out = `${(abs / 1e3).toFixed(1)} K`;
  else out = `${abs.toFixed(0)}`;
  return `${neg ? "-" : ""}\u20B9${out}`;
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return "0";
  return Number(value).toLocaleString("en-IN");
}

export function formatPct(value, decimals = 1) {
  if (value == null || isNaN(value)) return "0%";
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
