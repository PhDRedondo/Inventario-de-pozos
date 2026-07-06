export interface OperatorBrand {
  slug: string;
  shortName: string;
  initials: string;
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
}

const CURATED_BRANDS: Array<{ match: RegExp; brand: Omit<OperatorBrand, "slug"> }> = [
  {
    match: /AMERISUR|GEOPARK/i,
    brand: {
      shortName: "GeoPark Colombia",
      initials: "GP",
      primary: "#007A4D",
      secondary: "#00A86B",
      accent: "#E8F5EF",
      gradient: "linear-gradient(135deg, #007A4D 0%, #00A86B 100%)",
    },
  },
  {
    match: /ECOPETROL/i,
    brand: {
      shortName: "Ecopetrol",
      initials: "EC",
      primary: "#FFCD00",
      secondary: "#00843D",
      accent: "#FFF9E6",
      gradient: "linear-gradient(135deg, #00843D 0%, #FFCD00 100%)",
    },
  },
  {
    match: /PACIFIC RUBIALES|RUBIALES/i,
    brand: {
      shortName: "Pacific Rubiales",
      initials: "PR",
      primary: "#003DA5",
      secondary: "#0066CC",
      accent: "#E8F0FA",
      gradient: "linear-gradient(135deg, #003DA5 0%, #0066CC 100%)",
    },
  },
  {
    match: /FRONTERA/i,
    brand: {
      shortName: "Frontera Energy",
      initials: "FE",
      primary: "#C8102E",
      secondary: "#E63946",
      accent: "#FDECEF",
      gradient: "linear-gradient(135deg, #C8102E 0%, #E63946 100%)",
    },
  },
  {
    match: /CANACOL/i,
    brand: {
      shortName: "Canacol Energy",
      initials: "CN",
      primary: "#005EB8",
      secondary: "#0077C8",
      accent: "#E6F2FA",
      gradient: "linear-gradient(135deg, #005EB8 0%, #0077C8 100%)",
    },
  },
  {
    match: /PAREX/i,
    brand: {
      shortName: "Parex Resources",
      initials: "PX",
      primary: "#2D5016",
      secondary: "#4A7C2A",
      accent: "#EEF4EA",
      gradient: "linear-gradient(135deg, #2D5016 0%, #4A7C2A 100%)",
    },
  },
  {
    match: /GRAN TIERRA/i,
    brand: {
      shortName: "Gran Tierra Energy",
      initials: "GT",
      primary: "#8B4513",
      secondary: "#B5651D",
      accent: "#F5EDE4",
      gradient: "linear-gradient(135deg, #8B4513 0%, #B5651D 100%)",
    },
  },
  {
    match: /OCCIDENTAL|OXY/i,
    brand: {
      shortName: "Occidental",
      initials: "OXY",
      primary: "#ED1C24",
      secondary: "#FF4D54",
      accent: "#FDE8E9",
      gradient: "linear-gradient(135deg, #ED1C24 0%, #FF4D54 100%)",
    },
  },
  {
    match: /SHELL/i,
    brand: {
      shortName: "Shell Colombia",
      initials: "SH",
      primary: "#DD1D21",
      secondary: "#FFC600",
      accent: "#FFF8E1",
      gradient: "linear-gradient(135deg, #DD1D21 0%, #FFC600 100%)",
    },
  },
  {
    match: /CHEVRON/i,
    brand: {
      shortName: "Chevron",
      initials: "CV",
      primary: "#0066B2",
      secondary: "#E31837",
      accent: "#E8F2FA",
      gradient: "linear-gradient(135deg, #0066B2 0%, #E31837 100%)",
    },
  },
];

const FALLBACK_PALETTE = [
  { primary: "#0F766E", secondary: "#14B8A6", accent: "#ECFDF5" },
  { primary: "#1D4ED8", secondary: "#3B82F6", accent: "#EFF6FF" },
  { primary: "#7C3AED", secondary: "#A78BFA", accent: "#F5F3FF" },
  { primary: "#B45309", secondary: "#D97706", accent: "#FFFBEB" },
  { primary: "#BE185D", secondary: "#EC4899", accent: "#FDF2F8" },
  { primary: "#0369A1", secondary: "#0EA5E9", accent: "#F0F9FF" },
  { primary: "#4338CA", secondary: "#6366F1", accent: "#EEF2FF" },
  { primary: "#15803D", secondary: "#22C55E", accent: "#F0FDF4" },
] as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildInitials(name: string): string {
  const stopWords = new Set(["DE", "DEL", "LA", "EL", "Y", "EN", "CO", "SAS", "SA", "LLC", "SUCURSAL", "COLOMBIA"]);
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[\s/\-.,]+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.slice(0, 3);
  }
  if (words.length === 1) return words[0].slice(0, 3);
  return "OP";
}

function buildShortName(name: string): string {
  const trimmed = name.trim();
  const beforeLegal = trimmed.split(/\s+(EXPLORACIÓN|EXPLORACION|OPERATING|COMPANY|S\.?A\.?S?\.?|LLC|SUCURSAL)/i)[0]?.trim();
  if (beforeLegal && beforeLegal.length >= 3 && beforeLegal.length <= 40) return beforeLegal;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 3) return trimmed;
  return words.slice(0, 3).join(" ");
}

export function resolveOperatorBrand(operadora: string | null | undefined): OperatorBrand | null {
  if (!operadora?.trim()) return null;

  const normalized = operadora.trim();
  for (const entry of CURATED_BRANDS) {
    if (entry.match.test(normalized)) {
      return { slug: slugify(normalized), ...entry.brand };
    }
  }

  const palette = FALLBACK_PALETTE[hashString(normalized) % FALLBACK_PALETTE.length];
  const shortName = buildShortName(normalized);
  return {
    slug: slugify(normalized),
    shortName,
    initials: buildInitials(normalized),
    primary: palette.primary,
    secondary: palette.secondary,
    accent: palette.accent,
    gradient: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%)`,
  };
}
