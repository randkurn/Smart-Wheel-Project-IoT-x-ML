# SMART-WHEEL · Dashboard Monitoring

Dashboard web real-time untuk prototipe kursi roda mini SMART-WHEEL (UAS IoT × ML).
Dashboard **hanya monitoring** — kontrol keselamatan tetap lokal di ESP32.

Stack: Vite + React 18 + TypeScript · Recharts · Three.js (@react-three/fiber).

## Menjalankan

```bash
npm install
cp .env.example .env    # opsional; default VITE_DATA_SOURCE=simulator
npm run dev             # http://localhost:5173
npm run build           # typecheck + build produksi ke dist/
```

Tanpa hardware, dashboard memakai **simulator telemetri** (`src/data/simulator.ts`):
IMU 100 Hz → 10 Hz, 3 kelas lintasan bergantian tiap 12 s, prediksi **dummy**, ToF sweep ±60°,
dan FSR dengan episode beban tidak seimbang. Topbar punya kontrol simulator:
paksa jenis lintasan, **Putus data** (uji STALE), dan **Simulasi E-stop**.

## Setting koneksi (`/settings`)

Pilih sumber data, isi koneksinya, klik **Cek koneksi**, lalu **Simpan & terapkan**.
Pengaturan tersimpan di localStorage browser; nilai awal dari `.env`.

| Sumber | Untuk apa | Yang dicek |
|---|---|---|
| Simulator | Pengembangan tanpa alat | — |
| Alat (MQTT langsung) | Demo real-time di jaringan lokal | broker → subscribe → pesan telemetri (Hz, device_id, field) → prediksi ML |
| Database (Firebase) | Data dari bridge, bisa diakses dari mana saja | config → `.info/connected` → `/devices/{id}/telemetry/latest`, prediksi, `model_info` |

Browser hanya bisa MQTT lewat **WebSocket**. Untuk Mosquitto, tambahkan di `mosquitto.conf`:

```
listener 1883
listener 9001
protocol websockets
allow_anonymous false
password_file /etc/mosquitto/passwd
```

ESP32 tetap memakai port 1883; dashboard memakai `ws://<ip-broker>:9001`.
Kalau dashboard dibuka lewat HTTPS, broker wajib `wss://`.
Kredensial di Setting tersimpan di browser — pakai akun broker yang hanya boleh subscribe.

## Struktur

```
src/
  types/contract.ts        Kontrak data (telemetry, prediction, control, seat_status, events, model_info)
  config.ts                Ambang: stale 1,5 s, zona ToF, cap kecepatan 100/60/40/30/0 %
  data/
    source.ts              Interface DataSource/DataSink
    simulator.ts           Simulator telemetri (T04)
    mqttSource.ts          Sumber MQTT over WebSocket
    firebaseSource.ts      Sumber Firebase Realtime Database
    normalize.ts           Payload mentah -> tipe kontrak (toleran field lama)
    connectionTest.ts      Cek koneksi untuk halaman Setting
    store.ts               Store global + buffer 30 s
  hooks/useFreshness.ts    Logika online / stale / offline (SW-11)
  components/
    cards/   SurfaceCard (SW-01), MotorSpeedCard (SW-02), VibrationPanel (SW-03),
             DeviceStatusCard (SW-04), SystemInfoPanel (SW-08), EventList
    charts/  AccelChart (SW-05)
    visual/  TofRadar (SW-06), Wheelchair3D (SW-07)
  pages/     DashboardPage, MlEvalPage (SW-09, placeholder), HistoryPage (SW-10), SettingsPage
  settings.ts              Pengaturan koneksi (localStorage)
```

## Pembagian komponen (sesuai sheet tugas)

| Area | Berkas |
|---|---|
| Frontend Lead | `layout/*`, `SurfaceCard`, `MotorSpeedCard`, `DeviceStatusCard`, `SystemInfoPanel` |
| Frontend Data Viz | `AccelChart`, `VibrationPanel`, `pages/MlEvalPage` |
| Frontend Visual | `TofRadar`, `Wheelchair3D` |
| Backend/DB | ganti `firebaseSource.ts` — cukup panggil `sink.*` dengan payload sesuai `contract.ts` |

## Catatan kontrak

- Ultrasonik diganti ToF: `tof_mm`, `tof_ok`, `tof_zone`, plus `tof_angle_deg` (null bila ToF 1 titik).
  Radar saat ini mengasumsikan **1 titik + servo sweep** — sesuaikan setelah T03.
- `vib.rms` / `vib.peak` diasumsikan dihitung bridge dari IMU 100 Hz (jendela 1 s),
  karena data 10 Hz tidak cukup untuk RMS getaran yang akurat.
- Belum ada ML: prediksi dari simulator berlabel `model_version: "sim-0.1"` dan kartu diberi tanda *dummy*.
