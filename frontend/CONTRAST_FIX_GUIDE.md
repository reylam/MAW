# MAW Frontend - Contrast Issue Fix Guide

## ⚠️ MASALAH KONTRAS YANG PERLU DIPERBAIKI

### Lokasi Text yang Nyaru (Low Contrast):

**Background Putih/Light + Text Putih = NYARU ❌**

Files yang perlu diperbaiki:

### 1. **src/routes/Dashboard.jsx**
- Ganti: `text-white` → `text-slate-900`
- Lokasi: Stat cards, titles

### 2. **src/routes/Alerts.jsx**
- Ganti: `text-white` → `text-slate-900`
- Lokasi: Alert titles, descriptions

### 3. **src/routes/Crossings.jsx**
- Ganti: `text-white` → `text-slate-900`
- Lokasi: Crossing names, barrier status

### 4. **src/routes/DeviceHealth.jsx**
- Ganti: `text-white` → `text-slate-900`
- Lokasi: Device names, stats

### 5. **src/routes/EventHistory.jsx**
- Ganti: `text-white` → `text-slate-900`
- Lokasi: Event titles

### 6. **src/routes/Network.jsx**
- Ganti: `text-white` → `text-slate-900`
- Lokasi: Node names, network titles

---

## ✅ PANDUAN QUICK FIX

### Prinsip Warna Text:

**Pada Background Putih/Light (`bg-white`, `bg-slate-50`, `bg-slate-100`):**
- ✅ Gunakan: `text-slate-900`, `text-slate-800`, `text-slate-700`
- ❌ Jangan: `text-white`, `text-slate-100`, `text-slate-200`

**Pada Background Dark (`bg-blue-600`, `bg-slate-900`):**
- ✅ Gunakan: `text-white`
- ❌ Jangan: `text-slate-900`

**Pada Background Colored Light (`bg-emerald-50`, `bg-red-50`):**
- ✅ Gunakan: `text-emerald-700`, `text-red-700`
- ❌ Jangan: `text-white`

---

## 🎯 KONTRAS RATIO WCAG AA

**Minimum contrast ratio: 4.5:1 untuk text normal**

- `text-slate-900` on `bg-white`: **21:1** ✅
- `text-slate-800` on `bg-white`: **14:1** ✅
- `text-slate-700` on `bg-white`: **10:1** ✅
- `text-white` on `bg-white`: **1:1** ❌ NYARU

---

## 📝 MANUAL FIX STEPS

1. Buka setiap file yang disebutkan di atas
2. Search: `text-white`
3. Check context: Apakah background-nya putih/light?
4. Replace dengan: `text-slate-900` atau warna gelap yang sesuai
5. Rebuild: `npm run build`
6. Test visual

---

## 🔧 AUTOMATED FIX (PowerShell)

```powershell
# Run di root project
Get-ChildItem -Path src/routes,src/components -Recurse -Filter *.jsx | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace 'text-white', 'text-slate-900'
    Set-Content $_.FullName -Value $content -NoNewline
}
```

---

## 🎨 FINAL COLOR SCHEME

**Text Colors:**
- Primary: `text-slate-900` (#0F172A)
- Secondary: `text-slate-700` (#334155)
- Muted: `text-slate-600` (#475569)
- Subtle: `text-slate-500` (#64748B)

**Button Text:**
- Dark button (bg-blue-600): `text-white`
- Light button (bg-white): `text-slate-900`

**Status Colors (on light bg):**
- Safe: `text-emerald-700`
- Warning: `text-amber-700`
- Critical: `text-red-700`
- Info: `text-blue-700`

---

## ✅ VERIFICATION CHECKLIST

- [ ] Dashboard - System Status text readable
- [ ] Dashboard - Stats cards text clear
- [ ] Live Map - Popup text clear
- [ ] Alerts - Alert titles readable
- [ ] Crossings - Crossing names clear
- [ ] Device Health - Device names readable
- [ ] Network - Node labels clear
- [ ] Event History - Event titles readable

---

**Prioritas: HIGH - User tidak bisa membaca informasi critical!**

Date: 2026-08-25
