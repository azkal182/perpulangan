/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
/**
 * Fungsi untuk memfilter kabupaten berdasarkan provinsi_id
 * @param {number} provinsiId - ID Provinsi yang ingin dicari
 */
function filterKabupatenByProvince(provinsiId:number) {
    try {
        // 1. Membaca file kabupaten.json
        const rawData = fs.readFileSync('kabupaten.json', 'utf8');
        
        // 2. Mengubah string JSON menjadi object JavaScript
        const daftarKabupaten = JSON.parse(rawData);

        // 3. Melakukan filter berdasarkan provinsi_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasilFilter = daftarKabupaten.filter((item: any) => item.provinsi_id === provinsiId);

        // 4. Menampilkan hasil
        if (hasilFilter.length > 0) {
            console.log(`Menampilkan ${hasilFilter.length} data untuk Provinsi ID: ${provinsiId}`);
            console.table(hasilFilter);
        } else {
            console.log("Data tidak ditemukan untuk ID Provinsi tersebut.");
        }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("Gagal membaca atau memproses file:", error.message);
    }
}

// Contoh penggunaan: Mencari kabupaten dengan provinsi_id 1
filterKabupatenByProvince(6);


/**
 * Fungsi untuk memfilter kabupaten berdasarkan daftar provinsi_id
 * dan mengelompokkan khusus untuk Jawa Timur (ID: 11)
 */
function filterKabupatenByProvinces(provinsiIds: number[]) {
    try {
        const rawData = fs.readFileSync('kabupaten.json', 'utf8');
        const daftarKabupaten = JSON.parse(rawData);

        // 1. Filter data berdasarkan daftar ID yang diberikan
        const hasilFilter = daftarKabupaten.filter((item: any) => 
            provinsiIds.includes(item.provinsi_id)
        );

        // 2. Logika pengelompokan Jatim 1 & Jatim 2
        const maduraNames = ["Sampang", "Bangkalan", "Sumenep", "Pamekasan"];
        
        const rombongan = {
            "Jawa Timur 1": [] as number[],
            "Jawa Timur 2": [] as number[],
            "Lainnya": [] as any[]
        };

        hasilFilter.forEach((kab: any) => {
            if (kab.provinsi_id === 11) { // Jika Jawa Timur
                if (maduraNames.includes(kab.name)) {
                    rombongan["Jawa Timur 1"].push(kab.id);
                } else {
                    rombongan["Jawa Timur 2"].push(kab.id);
                }
            } else {
                rombongan["Lainnya"].push(kab);
            }
        });

        // 3. Output Hasil
        console.log("--- HASIL PENGELOMPOKAN ID ---");
        console.log("Jawa Timur 1 (Madura):", rombongan["Jawa Timur 1"]);
        console.log("Jawa Timur 2 (Luar Madura):", rombongan["Jawa Timur 2"]);
        
        if (rombongan["Lainnya"].length > 0) {
            console.log("\n--- DATA PROVINSI LAIN ---");
            console.table(rombongan["Lainnya"]);
        }

    } catch (error: any) {
        console.error("Gagal memproses file:", error.message);
    }
}

// Contoh penggunaan: Memasukkan ID Provinsi Jawa Timur (11) dan lainnya
// filterKabupatenByProvinces([6]);