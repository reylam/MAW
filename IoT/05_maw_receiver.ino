// TAHAP 3b - MAW Warning Node (penerima)
// Menerima status dari sensor node lewat LoRa, lalu menyalakan LED, buzzer, dan servo.
// Bekerja tanpa internet.
//
// Library: "LoRa" (Sandeep Mistry), "ESP32Servo" (Kevin Harrington)
//
// Fail-safe: jika tidak ada paket selama LINK_TIMEOUT_MS, LED kuning berkedip
// dan buzzer berbunyi pendek, supaya pengguna jalan tahu sistem tidak bisa dipercaya.

#include <SPI.h>
#include <LoRa.h>
#include <ESP32Servo.h>

// ---------------- KONFIGURASI PIN ----------------
const int PIN_LORA_SS   = 5;
const int PIN_LORA_RST  = 14;
const int PIN_LORA_DIO0 = 2;
const int PIN_LED_MERAH  = 25;
const int PIN_LED_KUNING = 26;
const int PIN_LED_HIJAU  = 27;
const int PIN_BUZZER     = 32;   // buzzer aktif (bunyi saat HIGH)
const int PIN_SERVO      = 13;

// ---------------- KONFIGURASI ----------------
const long LORA_FREQ = 433E6;
const int  LORA_SYNC = 0xA5;
const int  NODE_ID_DITERIMA = 1;
const unsigned long LINK_TIMEOUT_MS = 5000;
const int SUDUT_BUKA  = 0;
const int SUDUT_TUTUP = 90;

enum Level { AMAN = 0, WASPADA = 1, BAHAYA = 2 };

Servo palang;
Level level = AMAN;
unsigned long lastPacket = 0;
bool pernahTerima = false;
int sudutSekarang = -1;

void setPalang(int sudut) {
  if (sudut != sudutSekarang) { palang.write(sudut); sudutSekarang = sudut; }
}

void setKeluaran(bool merah, bool kuning, bool hijau, bool buzzer) {
  digitalWrite(PIN_LED_MERAH, merah);
  digitalWrite(PIN_LED_KUNING, kuning);
  digitalWrite(PIN_LED_HIJAU, hijau);
  digitalWrite(PIN_BUZZER, buzzer);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_LED_MERAH, OUTPUT);
  pinMode(PIN_LED_KUNING, OUTPUT);
  pinMode(PIN_LED_HIJAU, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  setKeluaran(false, false, false, false);

  palang.setPeriodHertz(50);
  palang.attach(PIN_SERVO, 500, 2400);
  setPalang(SUDUT_BUKA);

  LoRa.setPins(PIN_LORA_SS, PIN_LORA_RST, PIN_LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa GAGAL mulai.");
    while (true) {            // tanpa LoRa, tampilkan kondisi gangguan
      digitalWrite(PIN_LED_KUNING, !digitalRead(PIN_LED_KUNING));
      delay(300);
    }
  }
  LoRa.setSpreadingFactor(9);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(LORA_SYNC);
  LoRa.enableCrc();

  Serial.println("ms,node,seq,level,skor,sL,sV,sA,flags,rssi,snr");
}

void terimaPaket() {
  int size = LoRa.parsePacket();
  if (size <= 0) return;

  char buf[80];
  int n = 0;
  while (LoRa.available() && n < (int)sizeof(buf) - 1) buf[n++] = (char)LoRa.read();
  buf[n] = '\0';

  int node, lv, skor, sL, sV, sA, flags;
  unsigned long seq;
  int ok = sscanf(buf, "MAW,%d,%lu,%d,%d,%d,%d,%d,%d", &node, &seq, &lv, &skor, &sL, &sV, &sA, &flags);
  if (ok != 8 || node != NODE_ID_DITERIMA || lv < 0 || lv > 2) return;   // paket asing diabaikan

  level = (Level)lv;
  lastPacket = millis();
  pernahTerima = true;
  Serial.printf("%lu,%d,%lu,%d,%d,%d,%d,%d,%d,%d,%.1f\n",
                millis(), node, seq, lv, skor, sL, sV, sA, flags, LoRa.packetRssi(), LoRa.packetSnr());
}

void loop() {
  terimaPaket();

  unsigned long now = millis();
  bool linkPutus = !pernahTerima || (now - lastPacket > LINK_TIMEOUT_MS);

  if (linkPutus) {
    // Gangguan: kuning berkedip, bunyi pendek tiap 2 detik, palang dibiarkan pada posisi terakhir
    bool kedip = (now / 400) % 2;
    bool bip = (now % 2000) < 80;
    setKeluaran(false, kedip, false, bip);
    return;
  }

  switch (level) {
    case BAHAYA: {
      bool kedip = (now / 250) % 2;
      setKeluaran(kedip, false, false, kedip);   // merah berkedip + buzzer cepat
      setPalang(SUDUT_TUTUP);
      break;
    }
    case WASPADA: {
      bool bip = (now % 1000) < 150;
      setKeluaran(false, true, false, bip);      // kuning tetap + buzzer lambat
      setPalang(SUDUT_BUKA);
      break;
    }
    default:
      setKeluaran(false, false, true, false);    // hijau
      setPalang(SUDUT_BUKA);
      break;
  }
}