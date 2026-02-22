export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_ALLOWED_PATTERN = /^[a-zA-Z0-9_.]+$/;
export const DUMMY_EMAIL_DOMAIN = "dummy-auth.perpulangan.local";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);

  if (!username) {
    return "Username wajib diisi.";
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username minimal ${USERNAME_MIN_LENGTH} karakter.`;
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username maksimal ${USERNAME_MAX_LENGTH} karakter.`;
  }

  if (!USERNAME_ALLOWED_PATTERN.test(username)) {
    return "Username hanya boleh huruf, angka, titik, dan underscore.";
  }

  return null;
}

function encodeToHex(value: string): string {
  return Array.from(value)
    .map((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint ? codePoint.toString(16).padStart(2, "0") : "";
    })
    .join("");
}

export function buildDummyEmailFromUsername(value: string): string {
  const username = normalizeUsername(value);
  return `u${encodeToHex(username)}@${DUMMY_EMAIL_DOMAIN}`;
}
