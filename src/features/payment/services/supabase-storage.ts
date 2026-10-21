import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function storageAuthHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    // Legacy service_role keys are JWTs. New sb_secret keys belong in apikey only.
    ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }),
  };
}

function storageResponseUrl(projectUrl: string, returnedPath: string) {
  if (/^https?:\/\//i.test(returnedPath)) return new URL(returnedPath).toString();
  if (returnedPath.startsWith("/storage/v1/")) return `${projectUrl}${returnedPath}`;
  return `${projectUrl}/storage/v1/${returnedPath.replace(/^\/+/, "")}`;
}

function config() {
  // Accept the project URL, and tolerate users pasting the Storage/Data API base URL.
  const url = process.env.SUPABASE_URL?.trim().replace(/\/(storage|rest)\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PAYMENT_EVIDENCE_BUCKET;
  if (!url || !key || !bucket) throw new Error("Storage bukti belum dikonfigurasi. Atur SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SUPABASE_PAYMENT_EVIDENCE_BUCKET.");
  if (bucket.includes("/") || bucket.trim() !== bucket) throw new Error("SUPABASE_PAYMENT_EVIDENCE_BUCKET harus berisi nama bucket saja, tanpa garis miring atau spasi.");
  if (key.startsWith("sb_publishable_")) throw new Error("SUPABASE_SERVICE_ROLE_KEY berisi publishable key. Ganti dengan Supabase secret key (sb_secret_...) atau legacy service_role key.");
  if (key.startsWith("eyJ")) {
    try {
      const role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role;
      if (role !== "service_role") throw new Error("SUPABASE_SERVICE_ROLE_KEY bukan service_role key (key saat ini berperan sebagai anon). Ganti key ini dengan service_role atau sb_secret_.");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("SUPABASE_SERVICE_ROLE_KEY")) throw error;
      throw new Error("SUPABASE_SERVICE_ROLE_KEY tidak dapat dibaca. Gunakan secret key server atau legacy service_role key.");
    }
  } else if (!key.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY harus berupa Supabase secret key (sb_secret_...) atau legacy service_role key.");
  }
  return { url, key, bucket };
}

export function allowedEvidenceMime(mime: string) {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime);
}

export function isValidEvidenceStorageKey(storageKey: string, evidenceId: string, mimeType: string) {
  const extensionByMime: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensionByMime[mimeType];
  return Boolean(extension && /^[0-9a-f-]{36}$/i.test(evidenceId) && storageKey === `evidence/${evidenceId}.${extension}`);
}

export function createEvidenceCleanupToken(userId: string, storageKey: string) {
  const { key } = config();
  return createHmac("sha256", key).update(`${userId}:${storageKey}`).digest("hex");
}

export function isValidEvidenceCleanupToken(userId: string, storageKey: string, token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) return false;
  const expected = Buffer.from(createEvidenceCleanupToken(userId, storageKey), "hex");
  const actual = Buffer.from(token, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSignedEvidenceUpload(storageKey: string) {
  const { url, key, bucket } = config();
  const response = await fetch(`${url}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${storageKey.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { ...storageAuthHeaders(key), "Content-Type": "application/json" }, body: JSON.stringify({ upsert: false }), cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { url?: string; signedURL?: string; token?: string; message?: string; error?: string } | null;
  if (!response.ok || !(result?.url || result?.signedURL)) throw new Error(`${result?.message || result?.error || "Supabase menolak pembuatan URL upload."} (HTTP ${response.status}; bucket: ${bucket}). Periksa SUPABASE_URL dan nama bucket.`);
  // Storage returns paths relative to its API base (`/storage/v1`), not the project root.
  const signedUrl = storageResponseUrl(url, result.url ?? result.signedURL!);
  return { signedUrl, token: result.token ?? new URL(signedUrl).searchParams.get("token") };
}

export async function verifyEvidenceObject(storageKey: string, expectedMime: string, expectedSize: number) {
  if (!allowedEvidenceMime(expectedMime) || !Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > MAX_EVIDENCE_BYTES) throw new Error("Metadata bukti tidak valid atau melebihi 10 MB.");
  const { url, key, bucket } = config();
  const objectUrl = `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(objectUrl, { headers: storageAuthHeaders(key), cache: "no-store" });
  if (!response.ok) throw new Error("Bukti belum berhasil diunggah ke Supabase Storage.");
  const reportedSize = Number(response.headers.get("content-length"));
  if (reportedSize > MAX_EVIDENCE_BYTES) throw new Error("Bukti di storage melebihi batas 10 MB.");
  const bytes = Buffer.from(await response.arrayBuffer());
  const size = bytes.length;
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (size !== expectedSize || mime !== expectedMime) throw new Error("Ukuran atau tipe berkas di storage tidak cocok dengan berkas yang dipilih.");
  const signatureValid = expectedMime === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : expectedMime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : expectedMime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!signatureValid) throw new Error("Isi bukti tidak cocok dengan format berkas yang diizinkan.");
  return createHash("sha256").update(bytes).digest("hex");
}

export async function createSignedEvidenceDownload(storageKey: string) {
  const { url, key, bucket } = config();
  const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${storageKey.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { ...storageAuthHeaders(key), "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }), cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { signedURL?: string; message?: string } | null;
  if (!response.ok || !result?.signedURL) throw new Error(result?.message || "Gagal membuat tautan bukti.");
  return storageResponseUrl(url, result.signedURL);
}

export async function deleteEvidenceObject(storageKey: string) {
  const { url, key, bucket } = config();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${storageKey.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE", headers: storageAuthHeaders(key), cache: "no-store",
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(body?.message || body?.error || `Supabase menolak penghapusan bukti (HTTP ${response.status}).`);
  }
}
