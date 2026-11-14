// TAHAP 3a - MAW Sensor Node (pengirim)
// Membaca load cell, SW18010P, dan MAX9814, menghitung Fusion Score,
// menentukan status (AMAN / WASPADA / BAHAYA), lalu mengirimnya lewat LoRa.
//
// Library: "HX711" (bogde), "LoRa" (Sandeep Mistry)
//
// Angka T_L, T_V, T_A berasal dari uji sensor tunggal (Tahap 1).
// Bobot dan threshold masih nilai awal; ganti dengan hasil uji fusi.
//
// Perintah lewat Serial Monitor (untuk mengumpulkan data uji):
//   k = tandai "ada kereta" (label=1)     n = tandai "tidak ada kereta" (label=0)
//   t = tare ulang load cell

#include <SPI.h>
#include <LoRa.h>
#include "HX711.h"

// ---------------- KONFIGURASI PIN ----------------
const int PIN_HX_DOUT   = 16;
const int PIN_HX_SCK    = 4;
const int PIN_VIB       = 35;   // pin A0 modul getar (ADC1)
const int PIN_MIC       = 34;
const int PIN_LORA_SS   = 5;
const int PIN_LORA_RST  = 14;
const int PIN_LORA_DIO0 = 2;

// ---------------- KONFIGURASI LORA ----------------
const long LORA_FREQ = 433E6;
const int  LORA_SYNC = 0xA5;
const int  NODE_ID   = 1;

// ---------------- KONFIGURASI SENSOR ----------------
float CAL_FACTOR = 1.0;       // dari 01_loadcell
float T_L = 1200000.0;        // perubahan beban (unit) yang dianggap skor penuh
float T_V = 100.0;            // rata-rata defisit A0 selama 1 detik yang dianggap skor penuh
float T_A = 800.0;            // RMS ADC skor penuh (sekitar 70% median suara keras)

// ---------------- KONFIGURASI FUSI ----------------
// Bobot awal sama dengan contoh di slide. Ganti dengan bobot hasil uji (Li / jumlah L).
float W_L = 0.45, W_V = 0.35, W_A = 0.20;
float TH_WASPADA = 0.40;      // [threshold] isi dari hasil uji
float TH_BAHAYA  = 0.60;      // [threshold] isi dari hasil uji
const float TH_TURUN_SAAT_SENSOR_MATI = 0.85;   // pengali threshold jika ada sensor mati
const float SKOR_TUNGGAL_TINGGI = 0.90;         // satu sensor sangat tinggi -> minimal WASPADA

// ---------------- KONFIGURASI WAKTU ----------------
const unsigned long WINDOW_MS     = 250;    // periode hitung skor
const unsigned long HEARTBEAT_MS  = 1000;   // kirim minimal tiap 1 detik
const unsigned long HOLD_MS       = 8000;   // status bertahan setelah pemicu terakhir
const unsigned long HX_TIMEOUT_MS = 1500;   // load cell dianggap mati jika tidak ada data selama ini
const int N_MIC = 512;

enum Level { AMAN = 0, WASPADA = 1, BAHAYA = 2 };

HX711 scale;
uint32_t vibSum = 0, vibN = 0;   // akumulasi sampel A0 dalam satu window

float lastLoad = 0;
unsigned long lastHxOk = 0;
uint32_t seq = 0;
Level level = AMAN;
unsigned long lastTrigger = 0;
unsigned long lastSend = 0;
int label = 0;

float clamp01(float x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

// Membaca mikrofon. Mengembalikan RMS; ok=false jika sinyal menempel di batas ADC.
float bacaMikrofon(bool &ok) {
  static uint16_t buf[N_MIC];
  uint32_t sum = 0;
  for (int i = 0; i < N_MIC; i++) { buf[i] = analogRead(PIN_MIC); sum += buf[i]; }
  float mean = (float)sum / N_MIC;
  float acc = 0;
  for (int i = 0; i < N_MIC; i++) { float d = buf[i] - mean; acc += d * d; }
  ok = (mean > 50 && mean < 4045);   // kabel lepas biasanya membuat nilai menempel di 0 atau 4095
  return sqrtf(acc / N_MIC);
}

void kirim(Level lv, float skor, float sL, float sV, float sA, int flags) {
  char pkt[64];
  snprintf(pkt, sizeof(pkt), "MAW,%d,%u,%d,%d,%d,%d,%d,%d",
           NODE_ID, seq++, (int)lv, (int)(skor * 1000),
           (int)(sL * 1000), (int)(sV * 1000), (int)(sA * 1000), flags);
  LoRa.beginPacket();
  LoRa.print(pkt);
  LoRa.endPacket();          // blocking, sekitar 100-200 ms pada SF9
  lastSend = millis();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_MIC, ADC_11db);
  analogSetPinAttenuation(PIN_VIB, ADC_11db);

  scale.begin(PIN_HX_DOUT, PIN_HX_SCK);
  if (scale.wait_ready_timeout(2000)) {
    scale.set_scale(CAL_FACTOR);
    scale.tare(20);
    lastHxOk = millis();
  } else {
    Serial.println("PERINGATAN: HX711 tidak terdeteksi, load cell dianggap mati.");
  }

  LoRa.setPins(PIN_LORA_SS, PIN_LORA_RST, PIN_LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa GAGAL mulai. Berhenti.");
    while (true) delay(1000);
  }
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.enableCrc();
  LoRa.setTxPower(17);

  Serial.println("ms,label,beban,defisitV,rms,sL,sV,sA,skor,level,flags");
}

void loop() {
  // Perintah dari Serial
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'k') label = 1;
    if (c == 'n') label = 0;
    if (c == 't' && scale.is_ready()) scale.tare(20);
  }

  // Load cell dibaca kapan pun datanya siap (HX711 sekitar 10 Hz), tanpa menahan loop
  if (scale.is_ready()) {
    lastLoad = scale.get_units(1);
    lastHxOk = millis();
  }

  // Sampel A0 getaran dikumpulkan terus; idle = 4095, getaran menarik nilai turun
  vibSum += analogRead(PIN_VIB);
  vibN++;

  static unsigned long lastWin = 0;
  if (millis() - lastWin < WINDOW_MS) return;
  lastWin = millis();

  // --- Baca sensor ---
  float defisit = vibN ? 4095.0f - (float)vibSum / vibN : 0;
  if (defisit < 0) defisit = 0;
  vibSum = 0; vibN = 0;

  // Getaran dari saklar bersifat putus-putus (sering 0 di tengah guncangan),
  // jadi dipakai rata-rata 4 window terakhir (sekitar 1 detik).
  static float vibHist[4] = {0, 0, 0, 0};
  static int vibIdx = 0;
  vibHist[vibIdx++ % 4] = defisit;
  float defisitAvg = (vibHist[0] + vibHist[1] + vibHist[2] + vibHist[3]) / 4.0f;

  bool okA;
  float rms = bacaMikrofon(okA);
  bool okL = (millis() - lastHxOk) < HX_TIMEOUT_MS;

  // --- Skor tiap sensor (0..1) ---
  float sL = okL ? clamp01(fabsf(lastLoad) / T_L) : 0;
  float sV = clamp01(defisitAvg / T_V);
  float sA = okA ? clamp01(rms / T_A) : 0;

  // --- Fusi berbobot; bobot sensor mati dialihkan ke sensor lain ---
  float wL = okL ? W_L : 0;
  float wV = W_V;
  float wA = okA ? W_A : 0;
  float wSum = wL + wV + wA;
  float skor = (wL * sL + wV * sV + wA * sA) / wSum;

  int flags = (okL ? 0 : 1) | (okA ? 0 : 2);
  float thW = TH_WASPADA, thB = TH_BAHAYA;
  if (flags != 0) { thW *= TH_TURUN_SAAT_SENSOR_MATI; thB *= TH_TURUN_SAAT_SENSOR_MATI; }

  // --- Keputusan ---
  Level baru = AMAN;
  if (skor >= thB) baru = BAHAYA;
  else if (skor >= thW) baru = WASPADA;

  // Fail-safe: satu sensor sangat tinggi tetapi fusi masih AMAN -> minimal WASPADA
  float sMax = max(sL, max(sV, sA));
  if (baru == AMAN && sMax >= SKOR_TUNGGAL_TINGGI) baru = WASPADA;

  // Status hanya boleh turun setelah HOLD_MS tanpa pemicu
  Level sebelum = level;
  if (baru >= level) {
    level = baru;
    if (baru > AMAN) lastTrigger = millis();
  } else if (millis() - lastTrigger >= HOLD_MS) {
    level = baru;
    if (baru > AMAN) lastTrigger = millis();
  }

  Serial.printf("%lu,%d,%.1f,%.0f,%.1f,%.3f,%.3f,%.3f,%.3f,%d,%d\n",
                millis(), label, lastLoad, defisitAvg, rms, sL, sV, sA, skor, (int)level, flags);

  // Kirim segera saat status berubah, selain itu sebagai heartbeat
  if (level != sebelum || millis() - lastSend >= HEARTBEAT_MS) {
    kirim(level, skor, sL, sV, sA, flags);
  }
}