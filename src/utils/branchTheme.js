const FALLBACK_PRIMARY = "#7553e1";
const FALLBACK_SECONDARY = "#8d65f7";

const normalizeHex = (value, fallback) => {
  if (!value) return fallback;
  const raw = String(value).trim();
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
};

export const hexToRgbTriplet = (hex) => {
  const safeHex = normalizeHex(hex, FALLBACK_PRIMARY).slice(1);
  const value = Number.parseInt(safeHex, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

export const getBranchThemeColors = (branch) => {
  const primary = normalizeHex(
    branch?.configuracion?.colores?.primario || branch?.primaryColor,
    FALLBACK_PRIMARY,
  );
  const secondary = normalizeHex(
    branch?.configuracion?.colores?.secundario || branch?.secondaryColor,
    FALLBACK_SECONDARY,
  );

  return {
    primary,
    secondary,
    primaryRgb: hexToRgbTriplet(primary),
    secondaryRgb: hexToRgbTriplet(secondary),
  };
};

export const getBranchThemeStyle = (branch) => {
  const colors = getBranchThemeColors(branch);

  return {
    "--color-primary": colors.primary,
    "--color-primary-light": colors.secondary,
    "--color-primary-rgb": colors.primaryRgb,
    "--color-primary-light-rgb": colors.secondaryRgb,
    "--shop-accent": colors.primary,
    "--shop-accent-dark": colors.secondary,
    "--shop-accent-rgb": colors.primaryRgb,
  };
};
