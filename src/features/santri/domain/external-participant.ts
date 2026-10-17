export function normalizeExternalParticipantGender(gender: string | null | undefined) {
  switch (gender?.trim()) {
    case "L":
    case "Laki-laki":
      return "Laki-laki";
    case "P":
    case "Perempuan":
      return "Perempuan";
    default:
      return null;
  }
}
