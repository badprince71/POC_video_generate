// Aspect ratio normalization utility
// Maps common shorthand ratios to valid Runway aspect strings supported by our pipeline

export const VALID_ASPECT_RATIOS = [
  "1280:720",
  "720:1280",
  "1104:832",
  "832:1104",
  "960:960",
  "1584:672",
  "1280:768",
  "768:1280",
] as const;

const shorthandToValid: Record<string, (typeof VALID_ASPECT_RATIOS)[number]> = {
  // Gen-4
  "16:9": "1280:720",
  "9:16": "720:1280",
  // Closest supported to 4:3 and 3:4
  "4:3": "1104:832",
  "3:4": "832:1104",
  // Square
  "1:1": "960:960",
  // Cinematic 2.35:1 approximated by 1584:672 (≈2.357)
  "2.35:1": "1584:672",
  "21:9": "1584:672",
};

export function normalizeAspectRatio(input?: string): (typeof VALID_ASPECT_RATIOS)[number] {
  const defaultRatio = "1280:720" as const;
  if (!input || typeof input !== "string") return defaultRatio;

  // Already valid
  if ((VALID_ASPECT_RATIOS as readonly string[]).includes(input)) {
    return input as (typeof VALID_ASPECT_RATIOS)[number];
  }

  // Normalize whitespace and case
  const cleaned = input.trim().toLowerCase();
  if (cleaned in shorthandToValid) {
    return shorthandToValid[cleaned];
  }

  // Try to coerce numeric ratios like "1.777:1" or "1.33"
  // If a single number is provided, map to closest known
  const simple = cleaned.replace(/\s+/g, "");
  if (/^\d+(?:\.\d+)?$/.test(simple)) {
    const n = parseFloat(simple);
    if (!Number.isNaN(n)) {
      if (Math.abs(n - 1.777) < 0.1) return "1280:720";
      if (Math.abs(n - 0.5625) < 0.1) return "720:1280";
      if (Math.abs(n - 1.333) < 0.1) return "1104:832";
      if (Math.abs(n - 0.75) < 0.1) return "832:1104";
      if (Math.abs(n - 1.0) < 0.1) return "960:960";
      if (Math.abs(n - 2.35) < 0.15) return "1584:672";
    }
  }

  // Try form like "w:h" as numbers and pick closest supported
  const match = cleaned.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (match) {
    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);
    if (w > 0 && h > 0) {
      const r = w / h;
      const candidates: Array<{ val: (typeof VALID_ASPECT_RATIOS)[number]; ratio: number }> = [
        ["1280:720", 1280 / 720],
        ["720:1280", 720 / 1280],
        ["1104:832", 1104 / 832],
        ["832:1104", 832 / 1104],
        ["960:960", 1],
        ["1584:672", 1584 / 672],
        ["1280:768", 1280 / 768],
        ["768:1280", 768 / 1280],
      ].map(([val, ratio]) => ({ val: val as (typeof VALID_ASPECT_RATIOS)[number], ratio }));
      candidates.sort((a, b) => Math.abs(a.ratio - r) - Math.abs(b.ratio - r));
      return candidates[0].val;
    }
  }

  return defaultRatio;
}


