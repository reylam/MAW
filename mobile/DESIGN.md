# DESIGN.md: MAW Petugas (Aplikasi Monitoring Palang)

> Aplikasi pendamping sistem **MAW (Monitoring, Alert, Warning)** untuk petugas perlintasan sebidang.
> Fokusnya cuma satu: **menampilkan nilai Fusion Score secara real-time dan memberi instruksi jelas kapan palang harus DITUTUP atau BOLEH DIBUKA.**

---

## 1. Ringkasan

| Item | Keterangan |
|---|---|
| Nama | MAW Petugas |
| Pengguna utama | Petugas Perlintasan Sebidang / Petugas Jaga Lintasan (PT KAI / Dishub) |
| Perangkat | HP atau tablet di pos jaga (mobile-first, portrait). Tetap bisa dibuka di desktop. |
| Sumber data | Sensor Node (ESP32) → LoRa → Gateway Node → MQTT `broker.emqx.io` (TCP 1883 / WSS 8084), topik `mqx/node/data` → Backend Express.js → WebSocket → Frontend React |
| Rumus | `Fusion Score = (Getaran × 0,35) + (Beban × 0,30) + (Magnet × 0,20) + (Suara × 0,15)` |
| Ambang deteksi | `fusion_score ≥ 0,60` → `status: "DANGER"`; `0,40 ≤ fusion_score < 0,60` → `"WARNING"`; di bawahnya `"SAFE"` |
| Bukan cakupan | Grafik analitik, kalibrasi bobot, kesehatan perangkat detail, manajemen node. Semua itu tetap di dasbor operator (RailSafe Monitor). |

**Pertanyaan yang harus terjawab dalam < 1 detik melihat layar:**
> *"Palang harus saya tutup sekarang, atau sudah boleh dibuka?"*

---

## 2. Prinsip Desain

1. **Satu instruksi, satu layar.** Instruksi palang adalah elemen terbesar. Angka dan detail hanya pendukung.
2. **Fail-safe, bukan fail-open.** Aplikasi **tidak pernah** menampilkan "BOLEH DIBUKA" jika data tidak segar, koneksi putus, atau ada indikasi gangguan. Kalau ragu, tampilkan "CEK MANUAL".
3. **Tidak bergantung pada warna saja.** Setiap status punya warna + ikon + kata kerja + pola (untuk petugas buta warna dan layar silau di siang hari).
4. **Jujur soal umur data.** Waktu pembaruan terakhir selalu terlihat. Data lama = data tidak valid.
5. **Transparan seperti decision engine-nya.** Petugas bisa melihat *kenapa* sistem meminta tutup (kontribusi tiap sensor), sejalan dengan prinsip rule-based yang dapat diaudit.
6. **Saat ragu, pilih yang lebih aman.** Jika node bilang `DANGER` tapi skor rendah, atau skor dari node tidak cocok dengan hitungan ulang, aplikasi memilih instruksi yang lebih aman (tutup).
7. **Tidak ada keputusan otomatis atas palang.** Sesuai batasan sistem MAW, aplikasi hanya memberi instruksi; petugas yang mengoperasikan palang.

---

## 3. Logika Status (State Machine)

### 3.1 Parameter

Nilai di bawah adalah titik mulai. **Wajib dikalibrasi di lapangan** dan disimpan di konfigurasi backend (bukan di-hardcode di frontend). `T_TUTUP` harus sama dengan threshold di firmware ESP32.

| Parameter | Simbol | Nilai awal | Fungsi |
|---|---|---|---|
| Ambang tutup | `T_TUTUP` | 0,60 | Fusion Score ≥ nilai ini → kereta terdeteksi. Sama dengan threshold firmware yang menghasilkan `DANGER`. |
| Ambang siaga / lepas | `T_SIAGA` | 0,40 | Batas bawah. Dipakai untuk status SIAGA dan sebagai syarat skor sudah turun. |
| Waktu tahan aman | `HOLD_BUKA` | 20 detik | Skor harus terus < `T_SIAGA` selama ini sebelum boleh dibuka. |
| Batas umur data | `STALE_MAX` | 15 detik | Jika tidak ada paket dari node selama ini → CEK MANUAL. |
| Interval kirim node | `HEARTBEAT` | 5 detik | Sensor Node wajib publish ke `mqx/node/data` berkala walau tidak ada kereta. |
| Toleransi selisih skor | `SCORE_TOL` | 0,02 | Batas selisih `fusion_score` dari node vs hitung ulang backend. |

> **Kenapa ada dua ambang (histeresis)?** Saat kereta lewat, skor bisa naik-turun di sekitar 0,60. Dengan satu ambang saja, instruksi akan berkedip TUTUP–BUKA–TUTUP. Dua ambang + waktu tahan membuat instruksi stabil dan palang tidak dibuka terlalu cepat saat gerbong terakhir masih melintas.

### 3.2 Lima status

| Status | Kondisi masuk | Instruksi ke petugas | Warna |
|---|---|---|---|
| **AMAN** | Skor < `T_SIAGA`, data segar, dan tidak sedang dalam status TUTUP | **PALANG BOLEH DIBUKA** | Hijau |
| **SIAGA** | `T_SIAGA` ≤ skor < `T_TUTUP`, tidak sedang TUTUP | **BERSIAP MENUTUP PALANG** | Kuning/amber |
| **TUTUP** | Skor ≥ `T_TUTUP` **atau** `status == "DANGER"` dari node | **TUTUP PALANG SEKARANG** | Merah |
| **MENUNGGU AMAN** | Sedang TUTUP, skor sudah < `T_SIAGA` dan node tidak lagi `DANGER`, hitung mundur `HOLD_BUKA` berjalan | **TETAP TUTUP, tunggu 14 dtk** | Merah (dengan hitung mundur) |
| **CEK MANUAL** | Data > `STALE_MAX`, koneksi broker/WebSocket putus, sensor utama gagal, atau **ada perangkat terdaftar yang `disconnected`** (R8) | **CEK MANUAL, jangan andalkan layar** | Abu gelap + garis peringatan |

"Skor" di tabel ini adalah **skor efektif** (lihat 8.3): nilai yang lebih tinggi antara `fusion_score` kiriman node dan hasil hitung ulang backend.

### 3.3 Diagram transisi

```
                skor ≥ T_SIAGA                 skor ≥ T_TUTUP / DANGER
   ┌───────┐ ───────────────────▶ ┌────────┐ ──────────────────▶ ┌───────┐
   │ AMAN  │                      │ SIAGA  │                     │ TUTUP │◀──┐
   └───────┘ ◀─────────────────── └────────┘                     └───────┘   │
       ▲          skor < T_SIAGA        │  skor ≥ T_TUTUP / DANGER   │       │ skor naik lagi
       │                                └────────────────────────────┤       │ ≥ T_SIAGA
       │                                                             ▼       │ (timer reset)
       │       skor < T_SIAGA terus-menerus selama HOLD_BUKA   ┌──────────────┐
       └────────────────────────────────────────────────────── │MENUNGGU AMAN │
                                                               └──────────────┘

   Dari status apa pun → CEK MANUAL bila data basi / koneksi putus / sensor gagal.
   Keluar dari CEK MANUAL → kembali ke status yang dihitung dari data segar,
   KECUALI status terakhir sebelum gangguan adalah TUTUP/MENUNGGU AMAN:
   maka kembali ke MENUNGGU AMAN (timer mulai dari 0), bukan langsung AMAN.
```

### 3.4 Aturan pengaman (wajib)

- **R1.** Status TUTUP bersifat *latching*: hanya bisa keluar lewat MENUNGGU AMAN, tidak pernah langsung ke AMAN.
- **R2.** Jika skor naik lagi ≥ `T_SIAGA` selama MENUNGGU AMAN (misal kereta kedua dari arah berlawanan), timer di-reset dan kembali ke TUTUP.
- **R3.** AMAN hanya boleh tampil jika umur data ≤ `STALE_MAX`. Umur data dihitung dari **waktu backend menerima pesan**, bukan dari field `timestamp` node (lihat 8.4).
- **R4.** Logika status dihitung di **backend** dan dikirim ke semua klien, supaya semua layar (pos jaga, operator) menampilkan instruksi yang sama. Frontend hanya menambah satu pengecekan lokal: kalau WebSocket putus atau pesan terakhir > `STALE_MAX`, frontend sendiri memaksa CEK MANUAL.
- **R5.** `status: "DANGER"` dari node selalu dihormati: backend masuk TUTUP walau skor hasil hitung ulang lebih rendah. Sebaliknya, `status` selain `DANGER` **tidak** bisa membatalkan TUTUP jika skor efektif ≥ `T_TUTUP`.
- **R5b.** `status: "WARNING"` dari node tidak pernah menghasilkan AMAN: status minimal SIAGA walau skor efektif < `T_SIAGA`, dan selama TUTUP/MENUNGGU AMAN diperlakukan seperti skor ≥ `T_SIAGA` (palang tetap tutup, timer di-reset). Prinsip 6: saat ragu, pilih yang lebih aman.
- **R8.** Perangkat terdaftar (koleksi `devices`: ESP32, MPU6500, HX711 + Load Cell, HMC5883L, MAX9814) yang berstatus `disconnected` memaksa perlintasan ke CEK MANUAL walau data sensor masih segar, karena nilai Fusion Score tidak lagi bisa dipercaya. Penyebab yang tampil: "Perangkat terputus: MPU6500". Status perangkat diubah lewat MQTT (`maw/hardware/<crossing_id>/<perangkat>`, payload `{"status":"connected"|"disconnected"}`); backend juga membuat alert `device_disconnected` dan di web muncul pop-up. Setelah tersambung lagi, status dihitung ulang dari data segar (setelah penutupan: MENUNGGU AMAN, bukan langsung AMAN).
- **R6.** Bobot dan ambang yang dipakai ditampilkan kecil di layar, agar petugas dan auditor tahu aturan mana yang sedang berlaku.
- **R7.** Jika ada beberapa Sensor Node untuk satu perlintasan, status perlintasan = status **terburuk** dari semua node-nya (urutan: CEK MANUAL > TUTUP > MENUNGGU AMAN > SIAGA > AMAN).

---

## 4. Tata Letak Layar

Hanya **satu layar utama** + satu panel riwayat singkat. Tanpa sidebar, tanpa menu bertingkat.

### 4.1 Wireframe (HP, portrait), contoh memakai payload di bagian 8.1

```
┌─────────────────────────────────────┐
│ JPL 112 · Ds. Sukamaju     ● LIVE   │  ← Header: nama perlintasan, status koneksi
│ Diperbarui 2 dtk lalu · SN_001      │  ← Umur data + node pengirim
├─────────────────────────────────────┤
│█████████████████████████████████████│
│██                                 ██│
│██      ⛔  TUTUP PALANG            ██│  ← KARTU INSTRUKSI (±45% tinggi layar)
│██          SEKARANG               ██│     warna penuh sesuai status
│██                                 ██│
│██   Kereta terdeteksi mendekat    ██│  ← Alasan singkat
│██                                 ██│
│██   [ ✓ Palang sudah ditutup ]    ██│  ← Tombol konfirmasi (hanya di TUTUP)
│█████████████████████████████████████│
├─────────────────────────────────────┤
│ FUSION SCORE                  0,76  │  ← Angka besar, tabular
│ ├──────────────┼───────┼──────────┤ │
│ 0        0,40 siaga  0,60 tutup    1│  ← Bar dengan 2 penanda ambang
│ ▁▁▁▁▂▂▃▅▆▇██▇▇█  (2 menit terakhir) │  ← Sparkline
├─────────────────────────────────────┤
│ KENAPA?                             │
│ Getaran 0,85 × 0,35 = 0,30  ███▌    │  ← Kontribusi tiap sensor
│ Beban   0,90 × 0,30 = 0,27  ███▎    │
│ Magnet  0,65 × 0,20 = 0,13  █▌      │
│ Suara   0,40 × 0,15 = 0,06  ▋       │
├─────────────────────────────────────┤
│ Riwayat hari ini                  ▾ │  ← Bisa dilipat
│ 19:48  TUTUP → AMAN   (durasi 1m42s)│
│ 18:31  TUTUP → AMAN   (durasi 2m05s)│
└─────────────────────────────────────┘
  bobot 0,35/0,30/0,20/0,15 · T 0,40/0,60
```

### 4.2 Tablet / desktop (landscape)

Dua kolom: **kiri 60%** kartu instruksi (setinggi layar), **kanan 40%** Fusion Score, kontribusi sensor, dan riwayat. Urutan baca tetap: instruksi dulu, angka kemudian.

### 4.3 Isi kartu instruksi per status

| Status | Ikon | Judul (besar) | Subjudul | Elemen tambahan |
|---|---|---|---|---|
| AMAN | ✓ dalam lingkaran | PALANG BOLEH DIBUKA | Tidak ada kereta terdeteksi. Pastikan rel kosong secara visual. | - |
| SIAGA | ⚠ segitiga | BERSIAP MENUTUP | Sinyal kereta mulai terbaca (skor 0,48). | - |
| TUTUP | ⛔ / palang turun | TUTUP PALANG SEKARANG | Kereta terdeteksi mendekat. | Tombol **"Palang sudah ditutup"** |
| MENUNGGU AMAN | ⏳ | TETAP TUTUP | Kereta menjauh. Boleh dibuka dalam **14 dtk** | Cincin hitung mundur |
| CEK MANUAL | ⚠ + garis diagonal | CEK MANUAL | Data tidak diterima sejak 19:51:40. Ikuti SOP manual, jangan andalkan layar ini. | Penyebab: "Node SN_001 tidak mengirim data" / "Koneksi broker terputus" / "Sensor getaran tidak terbaca". Status terakhir yang diketahui. |

---

## 5. Komponen

### 5.1 `InstructionCard`
- Latar warna penuh sesuai status, teks kontras tinggi.
- Judul: kata kerja dalam huruf kapital, maks. 3 kata.
- Transisi warna 150 ms. **Tanpa animasi berlebihan**, kecuali denyut pelan (1 Hz) pada TUTUP sampai dikonfirmasi.
- Pada CEK MANUAL: pola garis diagonal 45° di latar agar beda dari status lain bahkan di layar hitam-putih.

### 5.2 `FusionScoreBar`
- Bar horizontal 0–1, dua penanda vertikal di `T_SIAGA` (0,40) dan `T_TUTUP` (0,60) dengan label.
- Isi bar diwarnai sesuai zona (hijau < 0,40 ≤ kuning < 0,60 ≤ merah).
- Angka skor 2 desimal, font tabular, koma sebagai pemisah desimal (format Indonesia).
- Sparkline 120 detik terakhir di bawahnya, dengan garis putus-putus di `T_TUTUP`.
- Jika skor node dan hitung ulang berbeda > `SCORE_TOL`, tampilkan ikon ⓘ kecil di samping angka: "Skor node 0,83, hitung ulang 0,76. Status memakai nilai tertinggi (0,83)." (Bar menampilkan hasil hitung ulang sesuai 8.6; status memakai skor efektif.)

### 5.3 `SensorContribution`
Empat baris tetap, dipetakan dari field `normalisasi`:

| Label di layar | Field | Bobot | Sensor |
|---|---|---|---|
| Getaran | `v_norm` | 0,35 | MPU6500 |
| Beban | `l_norm` | 0,30 | Load Cell HX711 |
| Magnet | `m_norm` | 0,20 | HMC5883L |
| Suara | `s_norm` | 0,15 | MAX9814 |

- Tiap baris: label, nilai ternormalisasi, bobot, hasil (bobot × nilai), bar kecil.
- Nilai `data_mentah` **tidak** ditampilkan di layar utama (petugas tidak butuh). Boleh muncul saat baris diketuk, untuk teknisi.
- Sensor yang nilainya hilang/`null`/di luar 0–1 ditandai "tidak terbaca" berwarna abu dan memicu peringatan di header.

### 5.4 `FreshnessIndicator` (header)
- `● LIVE` hijau jika pesan terakhir ≤ 5 dtk.
- `● TERLAMBAT` amber jika 5–15 dtk.
- `● TERPUTUS` merah jika > 15 dtk → otomatis CEK MANUAL.
- Teks "Diperbarui X dtk lalu" diperbarui tiap detik di sisi klien.
- Di sebelahnya tampil `node_id` pengirim pesan terakhir (misal `SN_001`).

### 5.5 `AckButton`
- Hanya muncul di status TUTUP. Tinggi minimal 56 px, lebar penuh kartu.
- Setelah ditekan: berubah jadi "✓ Dikonfirmasi 19:52:10 oleh Budi", denyut berhenti, alarm suara berhenti.
- Konfirmasi dicatat ke log (siapa, kapan, skor saat itu) untuk audit.
- **Tidak ada tombol "buka palang"**. Pembukaan mengikuti status AMAN.

### 5.6 `EventLog` (lipat)
- 10 kejadian terakhir hari ini: jam, transisi status, durasi tutup, waktu konfirmasi petugas.
- Kejadian CEK MANUAL dan skor tidak konsisten ikut dicatat beserta penyebabnya.

---

## 6. Alarm & Notifikasi

| Pemicu | Suara | Getar | Notifikasi push |
|---|---|---|---|
| Masuk SIAGA | 1× bunyi pendek | 1× | Tidak |
| Masuk TUTUP | Berulang tiap 3 dtk sampai dikonfirmasi | Pola panjang | Ya, prioritas tinggi |
| Masuk MENUNGGU AMAN | Tidak | Tidak | Tidak |
| Masuk AMAN (dari MENUNGGU AMAN) | 2× nada naik (berbeda dari alarm) | 1× | Ya, prioritas normal |
| Masuk CEK MANUAL | Berulang tiap 10 dtk | Pola pendek-pendek | Ya, prioritas tinggi |

- Layar dijaga tetap menyala (Wake Lock API) selama aplikasi terbuka.
- Alarm tetap berbunyi walau aplikasi di latar belakang (PWA + notifikasi, atau wrapper Android).

---

## 7. Design Tokens

### 7.1 Warna

Aplikasi memakai design system yang sama dengan dasbor web (`frontend/src/styles/tokens.css`): permukaan netral, biru brand, chip status berlatar lembut. Satu tambahan khusus mobile adalah warna isi (`fill-*`) untuk kartu instruksi.

| Token | Terang | Gelap | Dipakai untuk |
|---|---|---|---|
| `--bg` | `#F4F6F9` | `#0B1220` | Latar halaman |
| `--surface` | `#FFFFFF` | `#141C2B` | Kartu |
| `--border` / `--border-subtle` | `#E2E8F0` / `#EEF2F6` | `#273243` / `#1C2535` | Garis kartu, pemisah baris |
| `--primary` | `#005AA9` | `#3B82F6` | Tombol utama, bar kontribusi sensor, avatar |
| `--text` / `--text-muted` / `--text-subtle` | `#0F172A` / `#475569` / `#7A8699` | `#F1F5F9` / `#B6C2D2` / `#8595A8` | Teks |
| `--safe` / `--warning` / `--critical` / `--offline` | `#0F8A5F` / `#B45309` / `#C62828` / `#64748B` | `#34D399` / `#FBBF24` / `#F87171` / `#94A3B8` | Badge, titik status, isi bar dan sparkline (sama dengan web) |
| `--fill-safe` | `#0B5E3F` | `#34D399` | Kartu instruksi AMAN |
| `--fill-warning` | `#843C06` | `#FBBF24` | Kartu instruksi SIAGA |
| `--fill-critical` | `#9F1E1E` | `#F99B9B` | Kartu instruksi TUTUP, MENUNGGU AMAN |
| `--fill-offline` | `#475569` | `#94A3B8` | Kartu instruksi CEK MANUAL (+ garis diagonal) |
| `--on-fill` | `#FFFFFF` | `#0B1220` | Teks di atas kartu instruksi |

- Rasio kontras teks di atas kartu instruksi minimal **7:1** (WCAG AAA), karena dibaca dari jauh dan di bawah matahari. Warna status web (kontras 3,3 sampai 5,6:1 dengan teks putih) tidak cukup untuk kartu penuh, jadi `fill-*` memakai rona yang sama dengan kecerahan digeser. Kontras hasil akhir: terang 7,8 / 8,0 / 7,8 / 7,6; gelap 9,7 / 11,2 / 9,1 / 7,3 (aman / siaga / tutup / cek manual).
- Mode gelap mengikuti pengaturan sistem; disarankan default gelap untuk shift malam.

### 7.2 Tipografi

Font sama dengan web: **IBM Plex Sans** (isi), **Space Grotesk** (judul), **IBM Plex Mono** (angka teknis, eyebrow huruf kapital kecil).

| Peran | Font | Ukuran (HP) | Ukuran (tablet) |
|---|---|---|---|
| Judul instruksi | Space Grotesk Bold | 34 px | 56 px |
| Subjudul instruksi | IBM Plex Sans Medium | 16 px | 20 px |
| Angka Fusion Score | IBM Plex Mono Bold, tabular | 36 px | 48 px |
| Judul kartu | Space Grotesk SemiBold | 15 px | 15 px |
| Label / isi | IBM Plex Sans | 14 sampai 15 px | 15 sampai 16 px |
| Eyebrow, meta (bobot, node, jam) | IBM Plex Mono | 10 sampai 12 px | 10 sampai 13 px |

Ikon memakai set yang sama dengan web (Lucide).

### 7.3 Spasi & bentuk
- Skala spasi 4 px: 4, 8, 12, 16, 24, 32.
- Radius sama dengan web: kartu 8 px (kartu instruksi 10 px), chip/badge 6 px, tombol 8 px.
- Target sentuh minimal 48 × 48 px (petugas bisa memakai sarung tangan).

---

## 8. Kontrak Data

### 8.1 MQTT masuk (dari Gateway Node)

| Item | Nilai |
|---|---|
| Broker | `broker.emqx.io` |
| Port | `8084` (MQTT over WebSocket TLS, `wss://broker.emqx.io:8084/mqtt`, dipakai backend) atau `1883` (MQTT/TCP) |
| Client ID | `maw-mqtt` (backend menambah akhiran acak, misal `maw-mqtt-a3f9c1`, agar tidak bentrok) |
| Topik | `mqx/node/data` |
| Format | JSON, satu pesan per pembacaan node |

```json
{
  "node_id": "SN_001",
  "timestamp": 1728366420,
  "data_mentah": {
    "getaran_mpu6500": 6500,
    "beban_hx711": 8500,
    "magnet_hmc5883l": 420,
    "suara_max9814": 512
  },
  "normalisasi": {
    "v_norm": 0.85,
    "l_norm": 0.90,
    "m_norm": 0.65,
    "s_norm": 0.40
  },
  "fusion_score": 0.83,
  "status": "DANGER"
}
```

#### 8.1.1 Contoh payload asli dari firmware (SN_001)

| Skenario | Payload | Hitung ulang | Hasil di aplikasi |
|---|---|---|---|
| S4, aman | `normalisasi` 0,05 / 0,02 / 0,04 / 0,10, `fusion_score` 0,05, `status` `"SAFE"` | 0,0465 | AMAN |
| S5, waspada | `normalisasi` 0,70 / 0,25 / 0,45 / 0,55, `fusion_score` 0,49, `status` `"WARNING"` | 0,4925 | SIAGA |
| S3, bahaya | `normalisasi` 0,96 / 0,94 / 0,91 / 0,92, `fusion_score` 0,94, `status` `"DANGER"` | 0,9380 | TUTUP |

```json
{"node_id": "SN_001", "timestamp": 1792419342, "data_mentah": {"getaran_mpu6500": 7308, "beban_hx711": 8867, "magnet_hmc5883l": 517, "suara_max9814": 1022}, "normalisasi": {"v_norm": 0.96, "l_norm": 0.94, "m_norm": 0.91, "s_norm": 0.92}, "fusion_score": 0.94, "status": "DANGER"}
```

Catatan: jam node sudah tersinkron (timestamp hanya selisih menit dari jam server). Ketiga contoh memakai `timestamp` yang sama; di lapangan `timestamp` harus naik tiap kiriman, karena pesan dengan `node_id` + `timestamp` + `fusion_score` yang sama dalam 2 detik dibuang sebagai duplikat (8.2 langkah 5).

| Field | Tipe | Dipakai aplikasi untuk |
|---|---|---|
| `node_id` | string | Mencari perlintasan pemilik node (tabel 8.5) dan label di header. |
| `timestamp` | integer (Unix detik) | Disimpan untuk log saja. **Tidak** dipakai untuk menghitung umur data (lihat 8.4). |
| `data_mentah.*` | number | Disimpan ke MongoDB untuk kalibrasi/teknisi. Tidak tampil di layar utama. |
| `normalisasi.v_norm/l_norm/m_norm/s_norm` | number 0–1 | Baris kontribusi sensor + hitung ulang skor. |
| `fusion_score` | number 0–1 | Skor dari node, dibandingkan dengan hitung ulang. |
| `status` | string | `"SAFE"` \| `"WARNING"` \| `"DANGER"`. `DANGER` = node menyatakan kereta terdeteksi (Decision = 1, R5). `WARNING` = sinyal mulai terbaca (minimal SIAGA, R5b). `SAFE` = Decision 0. Nilai lain diterima sebagai Decision 0 dan dicatat `unknown_status`. |

### 8.2 Validasi payload di backend

Setiap pesan di `mqx/node/data` diproses berurutan:

1. **Parse JSON.** Gagal → buang, tambah hitungan `invalid_payload`, catat di log.
2. **Cek field wajib:** `node_id`, `normalisasi` (4 nilai), `fusion_score`, `status`. Hilang → tandai pesan tidak lengkap; jika `v_norm` (sensor utama) hilang → node masuk CEK MANUAL.
3. **Cek rentang:** setiap nilai `normalisasi` dan `fusion_score` harus 0–1. Di luar rentang → di-*clamp* ke 0–1 dan dicatat sebagai `sensor_out_of_range`.
4. **Cek node dikenal:** `node_id` yang tidak ada di tabel 8.5 diabaikan (dicatat), supaya pesan liar di broker publik tidak mempengaruhi layar petugas.
5. **Buang duplikat:** pesan dengan `node_id` + `timestamp` + `fusion_score` yang sama dalam 2 detik terakhir diabaikan.
6. **Hitung ulang skor** (8.3), lalu jalankan state machine (bagian 3).

### 8.3 Hitung ulang dan skor efektif

```
skor_hitung  = v_norm×0,35 + l_norm×0,30 + m_norm×0,20 + s_norm×0,15
skor_efektif = max(fusion_score, skor_hitung)
selisih      = |fusion_score − skor_hitung|
jika selisih > SCORE_TOL → catat "SKOR_TIDAK_KONSISTEN" + tampilkan ikon ⓘ (5.2)
jika status == "DANGER"  → paksa TUTUP (R5)
```

**Contoh dengan payload 8.1:**
`0,85×0,35 + 0,90×0,30 + 0,65×0,20 + 0,40×0,15 = 0,2975 + 0,27 + 0,13 + 0,06 = 0,7575 ≈ 0,76`.
Payload mengirim `fusion_score: 0.83`, jadi selisihnya 0,07 dan pesan ini akan ditandai SKOR_TIDAK_KONSISTEN. Instruksi tetap **TUTUP** karena kedua nilai ≥ 0,60 dan `status` = `DANGER`.

### 8.4 Umur data dan jam node

- ESP32 tidak punya jam yang pasti tersinkron (tanpa NTP/RTC saat offline). Contoh `timestamp: 1728366420` = 8 Oktober 2024, artinya jam node bisa jauh berbeda dari jam sebenarnya.
- Karena itu backend memberi cap waktu sendiri `received_at` saat pesan diterima. **Semua perhitungan umur data, `STALE_MAX`, dan `HOLD_BUKA` memakai `received_at`.**
- Jika `|timestamp − received_at| > 60 detik`, catat peringatan "Jam node SN_001 tidak sinkron" di log teknisi (tidak tampil ke petugas).

### 8.5 Pemetaan node ke perlintasan (konfigurasi backend)

```json
{
  "SN_001": { "crossing_id": "JPL-112", "crossing_name": "JPL 112 · Ds. Sukamaju", "posisi": "Sisi barat, ±2 km" },
  "SN_002": { "crossing_id": "JPL-112", "crossing_name": "JPL 112 · Ds. Sukamaju", "posisi": "Sisi timur, ±2 km" }
}
```

Di kode, pemetaan ini ada di `backend/src/config/nodeMap.json` (atau env `MAW_NODE_MAP`). Defaultnya `SN_001` dipetakan ke perlintasan yang sudah ada di sistem (`crossing-01`) agar dasbor web ikut berubah. Jangan daftarkan node yang belum terpasang: node terdaftar yang tidak pernah mengirim data membuat perlintasannya CEK MANUAL terus (R7).

### 8.6 WebSocket keluar (backend → aplikasi)

Event `crossing.state`, dikirim tiap ada pesan baru (maks. 2×/detik per perlintasan):

```json
{
  "crossing_id": "JPL-112",
  "crossing_name": "JPL 112 · Ds. Sukamaju",
  "state": "TUTUP",
  "reason": "Kereta terdeteksi mendekat",
  "fusion_score": 0.76,
  "fusion_score_node": 0.83,
  "score_mismatch": true,
  "thresholds": { "siaga": 0.40, "tutup": 0.60 },
  "contributions": [
    { "sensor": "Getaran", "field": "v_norm", "value": 0.85, "weight": 0.35 },
    { "sensor": "Beban",   "field": "l_norm", "value": 0.90, "weight": 0.30 },
    { "sensor": "Magnet",  "field": "m_norm", "value": 0.65, "weight": 0.20 },
    { "sensor": "Suara",   "field": "s_norm", "value": 0.40, "weight": 0.15 }
  ],
  "node": { "node_id": "SN_001", "status": "DANGER" },
  "hold_remaining_s": null,
  "received_at": "2026-10-19T12:52:08.412Z",
  "server_ts": "2026-10-19T12:52:08.530Z",
  "acknowledged": null
}
```

- `state` ∈ `AMAN | SIAGA | TUTUP | MENUNGGU_AMAN | CEK_MANUAL`.
- `fusion_score` = skor hitung ulang (yang ditampilkan di bar); `state` tetap memakai skor efektif.
- Frontend menghitung umur data dari `received_at` (dengan koreksi selisih jam HP memakai `server_ts`).
- REST: `POST /crossings/{id}/ack` untuk konfirmasi petugas; `GET /crossings/{id}/events?date=today` untuk riwayat.
- Implementasi: WebSocket di `ws://<host>:5000/ws`, tiap frame berbentuk `{ "event": "crossing.state", "data": { ... } }` dan snapshot semua perlintasan dikirim saat terhubung. REST ada di bawah `/api` (`POST /api/crossings/{id}/ack` dengan body `{ "operator": { "email": "..." } }`). Tambahan: `GET /api/crossings/{id}/state`, `GET /api/maw/config`, `GET /api/maw/diagnostics`, dan `POST /api/maw/simulate` (kirim payload 8.1 tanpa perangkat keras; mati saat `NODE_ENV=production`).

### 8.7 Mode prototipe tanpa backend (opsional)

Untuk demo cepat, frontend React boleh langsung subscribe ke broker. Browser **tidak bisa** memakai port 1883 (TCP); gunakan MQTT over WebSocket:

- `ws://broker.emqx.io:8083/mqtt` atau `wss://broker.emqx.io:8084/mqtt` (pakai `wss` jika aplikasi di-host lewat HTTPS)
- Topik sama: `mqx/node/data`

Logika bagian 3 dan 8.2–8.4 ditulis sebagai satu modul JavaScript murni (`mawState.js`) sehingga bisa dipakai di backend maupun frontend tanpa perubahan. Pada mode ini, konfirmasi petugas dan riwayat hanya tersimpan di perangkat itu.

### 8.8 Catatan untuk firmware
- Sensor Node wajib publish ke `mqx/node/data` setiap `HEARTBEAT` (5 dtk), **termasuk saat tidak ada kereta** (status bukan `DANGER`). Tanpa ini, aplikasi tidak bisa membedakan "tidak ada kereta" dan "node mati", sehingga aturan R3 akan sering memicu CEK MANUAL.
- Nilai `status` yang dipakai firmware: `"SAFE"` (< 0,40), `"WARNING"` (0,40 sampai < 0,60), `"DANGER"` (≥ 0,60).
- Disarankan (opsional) menambah field `seq` (nomor urut paket) untuk menghitung *packet loss*, dan `threshold` agar backend bisa memastikan ambang firmware sama dengan konfigurasi.

---

## 9. Keamanan Data (penting untuk aplikasi keselamatan)

`broker.emqx.io` adalah **broker publik tanpa autentikasi**. Siapa pun yang tahu topik `mqx/node/data` bisa ikut publish pesan, termasuk pesan palsu yang membuat layar menampilkan AMAN saat ada kereta.

- **Prototipe/lab:** boleh dipakai, dengan mitigasi minimal: validasi `node_id` terdaftar (8.2 langkah 4) dan ganti topik dengan prefiks unik tim, misal `ureeka-iniabadi/mqx/node/data`.
- **Uji lapangan / produksi:** wajib broker privat (EMQX/Mosquitto sendiri) dengan username/password per node, TLS di port 8883, dan ACL (node hanya boleh publish ke topiknya sendiri, aplikasi hanya boleh subscribe).
- Apa pun brokernya, aturan R5 memastikan pesan palsu "aman" tidak bisa membatalkan status TUTUP yang sedang berjalan sebelum `HOLD_BUKA` selesai.

---

## 10. Kasus Tepi

| Situasi | Perilaku |
|---|---|
| Skor naik-turun di sekitar 0,60 | Tetap TUTUP (latching), tidak berkedip. |
| Dua kereta beruntun / berlawanan arah | Timer MENUNGGU AMAN di-reset saat skor naik lagi ≥ 0,40. |
| Kendaraan berat lewat, skor 0,45 sebentar | SIAGA, kembali AMAN saat skor turun. Tidak ada alarm keras. |
| `status: "DANGER"` tapi skor hitung ulang 0,52 | TUTUP (R5), ikon ⓘ skor tidak konsisten. |
| `status: "WARNING"` tapi skor 0,30 | SIAGA (R5b), bukan AMAN. |
| `fusion_score` node 0,83, hitung ulang 0,76 | Bar menampilkan 0,76 + ikon ⓘ; status dihitung dari skor efektif 0,83. |
| Jam node salah (timestamp 2024) | Tidak berpengaruh ke status; dicatat di log teknisi. |
| Pesan dari `node_id` tak dikenal di broker publik | Diabaikan, dicatat. |
| Gateway kehilangan internet tapi LoRa lokal jalan | Sirine di lapangan tetap bekerja (offline-first); aplikasi menampilkan CEK MANUAL + "Data tidak diterima, peringatan lokal di lapangan tetap aktif". |
| HP petugas kehilangan sinyal | Frontend memaksa CEK MANUAL setelah 15 dtk tanpa pesan. |
| Jalur LoRa diganggu (interferensi/jamming) | Terlihat sebagai node berhenti mengirim → CEK MANUAL setelah 15 dtk dengan penyebab "Node SN_001 tidak mengirim data". |
| Satu sensor pelengkap gagal (misal suara) | Status tetap dihitung dari data yang ada, peringatan kecil di header. Jika `v_norm` (getaran) gagal → CEK MANUAL. |
| Baterai node habis | Node berhenti mengirim → CEK MANUAL setelah 15 dtk. |

---

## 11. Bahasa & Mikrokopi

- Bahasa Indonesia sederhana, kalimat perintah, tanpa istilah teknis di kartu instruksi. Istilah teknis (Fusion Score, nama sensor) hanya di bagian detail.
- Gunakan "palang", bukan "gate". Gunakan "kereta", bukan "train". Status `DANGER` dari node tidak pernah ditampilkan mentah ke petugas; selalu diterjemahkan jadi instruksi.
- Hindari kata yang ambigu seperti "Normal" atau "OK". Selalu pakai kata kerja: **TUTUP**, **BUKA**, **CEK**.
- Format angka: koma desimal (`0,76`), jam 24 jam (`19:52`), zona waktu lokal perlintasan.

---

## 12. Kriteria Selesai (Acceptance Criteria)

- [ ] Instruksi terbaca dari jarak 2 meter pada HP 6 inci.
- [ ] Perubahan status tampil ≤ 1 detik setelah pesan diterima backend.
- [ ] Payload contoh 8.1 menghasilkan: status TUTUP, bar 0,76, ikon ⓘ skor tidak konsisten.
- [ ] Status AMAN tidak pernah muncul saat umur data > 15 detik (uji dengan memutus WebSocket, memutus koneksi broker, dan menghentikan publish node).
- [ ] Simulasi skor 0,20 → 0,70 → 0,30 menghasilkan urutan AMAN → SIAGA → TUTUP → MENUNGGU AMAN → AMAN tanpa kedipan.
- [ ] Simulasi skor naik lagi saat MENUNGGU AMAN mengembalikan status ke TUTUP.
- [ ] Pesan dengan `status: "DANGER"` dan skor rendah tetap menghasilkan TUTUP.
- [ ] Pesan dengan `status: "WARNING"` dan skor rendah menghasilkan SIAGA, bukan AMAN.
- [ ] Contoh firmware 8.1.1 (S4, S5, S3) menghasilkan AMAN, SIAGA, TUTUP tanpa ikon ⓘ.
- [ ] Pesan dari `node_id` tak terdaftar tidak mengubah tampilan.
- [ ] Alarm TUTUP berulang sampai tombol konfirmasi ditekan; konfirmasi tercatat di log.
- [ ] Setiap status bisa dibedakan dalam mode grayscale.
- [ ] Mode terang dan gelap lolos kontras 7:1 pada kartu instruksi.

---

## 13. Status Penyelarasan dengan Proposal

| Hal | Keputusan saat ini |
|---|---|
| Jumlah sensor & bobot | **Disepakati:** 4 sensor, getaran 0,35 · beban 0,30 · magnet 0,20 · suara 0,15 (total 1,00). Bagian Analisis proposal (3 sensor, 0,50/0,30/0,20) dan mockup Pengaturan (40%/30%/10%) perlu disamakan. |
| Threshold | **Disepakati:** 0,60. Mockup *Minimum Activation Threshold* (75%) perlu disamakan. |
| Sensor getaran | **Disepakati:** MPU6500 (sesuai payload). Bagian lain proposal masih menulis MPU6050. |
| Peran palang | Palang dioperasikan petugas berdasarkan instruksi aplikasi (sesuai Batasan). DFD Level 0 yang menyebut output "Sirine & Palang" perlu disesuaikan. |
| Contoh perhitungan di payload | **Terverifikasi di firmware:** payload asli SN_001 (8.1.1) cocok dengan bobot yang disepakati, selisih hitung ulang maks. 0,0035 (< `SCORE_TOL` 0,02). Contoh di 8.1 (0,83 vs 0,76) tetap dipakai sebagai kasus uji skor tidak konsisten. |
| Nilai `status` | **Disepakati** (dari firmware): `"SAFE"`, `"WARNING"`, `"DANGER"`. |
| Telemetri (baterai, RSSI, SNR) | **Dihapus dari payload.** Aplikasi tidak menampilkan kesehatan baterai/sinyal. Gangguan jalur LoRa (termasuk jamming) dan baterai habis hanya terdeteksi sebagai node berhenti mengirim → CEK MANUAL. Fitur *LoRa Jamming Detection* berbasis RSSI/SNR di proposal tidak dicakup aplikasi ini. |
