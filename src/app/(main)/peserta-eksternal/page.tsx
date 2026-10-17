import prisma from "@/lib/prisma";
import {
  getExternalParticipantQueue,
  saveExternalParticipant,
} from "@/features/santri/actions/external-participant.actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getRegionalAccessScope } from "@/server/access-scope";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";

export default async function ExternalParticipantsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const scope = await getRegionalAccessScope();
  const [queue, kordas] = await Promise.all([
    getExternalParticipantQueue(),
    prisma.korda.findMany({
      where: scope.role === "admin"
        ? {}
        : scope.role === "korwil"
          ? { korwilId: scope.korwilId ?? "__NO_ACCESS__" }
          : { id: scope.kordaId ?? "__NO_ACCESS__" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const displayGender = (gender: string | null) => normalizeExternalParticipantGender(gender) ?? "";

  return (
    <main className="space-y-6">
      {params?.notice && (
        <Alert><AlertDescription>{params.notice}</AlertDescription></Alert>
      )}
      {params?.error && (
        <Alert variant="destructive"><AlertDescription>{params.error}</AlertDescription></Alert>
      )}

      <div>
        <h1 className="text-2xl font-semibold">Peserta eksternal</h1>
        <p className="text-sm text-muted-foreground">
          Isi nama, jenis kelamin, alamat, dan Korda tujuan. Semua field wajib diisi agar profil langsung dapat digunakan untuk registrasi.
        </p>
      </div>

      <form
        action={async (form) => { "use server"; await saveExternalParticipant(form); }}
        className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
      >
        <label className="grid gap-1 text-sm">
          Nama *
          <input name="name" required className="rounded-md border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          Jenis kelamin *
          <select name="gender" required className="rounded-md border px-3 py-2">
            <option value="">Pilih</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Korda tujuan *
          <select name="intendedKordaId" required className="rounded-md border px-3 py-2">
            <option value="">Pilih Korda</option>
            {kordas.map((korda) => <option key={korda.id} value={korda.id}>{korda.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Alamat *
          <textarea name="address" required rows={3} className="rounded-md border px-3 py-2" />
        </label>
        <div className="md:col-span-2">
          <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Simpan profil lengkap</button>
          <p className="mt-2 text-xs text-muted-foreground">
            Semua role yang berwenang pada Korda tujuan dapat menyimpan profil lengkap. Profil lama yang masih Draf dapat dilengkapi oleh petugas yang berwenang. Sistem menandai kemungkinan duplikat berdasarkan nama dan alamat.
          </p>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Antrean profil ({queue.length})</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada profil eksternal.</p>
        ) : queue.map((participant) => {
          const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
          const duplicate = queue.some((other) =>
            other.id !== participant.id &&
            normalize(other.name) === normalize(participant.name) &&
            !!other.address && normalize(other.address) === normalize(participant.address ?? ""),
          );
          const missing = [
            !participant.gender && "jenis kelamin",
            !participant.address && "alamat",
          ].filter(Boolean);
          const genderLabel = displayGender(participant.gender);

          return (
            <article key={participant.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{participant.name}</strong>
                <span className="text-sm">{participant.status === "COMPLETE" ? "Lengkap" : "Draf — belum difinalkan"}</span>
              </div>
              <p className="text-sm text-muted-foreground">Korda tujuan: {participant.intendedKorda.name}</p>
              {genderLabel && <p className="mt-1 text-sm">Jenis kelamin: {genderLabel}</p>}
              {missing.length > 0 && <p className="mt-1 text-sm">Belum lengkap: {missing.join(", ")}</p>}
              {participant.status === "DRAFT" && missing.length === 0 && <p className="mt-1 text-sm">Data sudah terisi. Simpan ulang profil untuk memfinalkannya.</p>}
              {participant.address && <p className="mt-2 whitespace-pre-wrap text-sm">Alamat: {participant.address}</p>}
              {duplicate && <p className="mt-1 text-sm text-amber-700">Kemungkinan duplikat: nama dan alamat cocok dengan profil lain.</p>}

              <details className="mt-3">
                <summary className="cursor-pointer text-sm underline">Lengkapi/perbarui profil</summary>
                <form
                  action={async (form) => { "use server"; await saveExternalParticipant(form); }}
                  className="mt-3 grid gap-3 md:grid-cols-2"
                >
                  <input type="hidden" name="id" value={participant.id} />
                  <input type="hidden" name="intendedKordaId" value={participant.intendedKordaId} />
                  <label className="grid gap-1 text-sm">
                    Nama *
                    <input name="name" required defaultValue={participant.name} className="rounded-md border px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Jenis kelamin *
                    <select name="gender" required defaultValue={displayGender(participant.gender)} className="rounded-md border px-3 py-2">
                      <option value="">Pilih</option>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    Alamat *
                    <textarea name="address" required rows={3} defaultValue={participant.address ?? ""} className="rounded-md border px-3 py-2" />
                  </label>
                  <button className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground">Simpan perubahan</button>
                </form>
              </details>
            </article>
          );
        })}
      </section>
    </main>
  );
}
