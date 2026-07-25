# 📱 BestBill APK Build & Deployment Master Guide

This guide provides complete context and step-by-step instructions for AI agents and developers building the Android APK for BestBill POS.

---

## 📌 Project & Workspace Summary

- **APK Workspace Directory**: `d:\BestBill-apk`
- **Frontend Source Directory**: `d:\BestBill-apk\frontend`
- **Website Workspace Directory**: `C:\Users\shubh\Desktop\BestBill`
- **GCP Bucket Public URL**: `https://storage.googleapis.com/bestbill-public-logos/BestBill_Setup_v1.0.1.apk`

---

## ⚡ Quick One-Click Build Command

Whenever requested to **"build APK"**, **"generate latest APK"**, or **"update APK"**, execute the following command in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File d:\BestBill-apk\build_apk.ps1
```

> [!NOTE]
> The `build_apk.ps1` script automatically sets `JAVA_HOME` (`d:\BestBill-apk\sdk\jdk-21`), `ANDROID_HOME` (`d:\BestBill-apk\sdk\android-sdk`), compiles Gradle, copies the binary, and updates the file modification timestamp in Windows File Explorer.

---

## 🛠️ Step-by-Step Build Workflow

Follow these exact steps when web code (`frontend/src`) or local router/DB logic is modified:

### Step 1: Build the Web Frontend (Vite React)
```powershell
cd d:\BestBill-apk\frontend
npm run build
```
*(Compiles React code into `frontend/dist`)*

### Step 2: Sync Web Assets to Capacitor Android Project
```powershell
npx cap sync android
```
*(Syncs `frontend/dist` into `frontend/android/app/src/main/assets/public`)*

### Step 3: Run the APK Builder Script
```powershell
powershell -ExecutionPolicy Bypass -File d:\BestBill-apk\build_apk.ps1
```

---

## 🏷️ Output File Naming & CDN Cache Bypassing

- **Output Location**: `d:\BestBill-apk\BestBill_Setup_v1.0.1.apk`

> [!IMPORTANT]
> **CDN & Browser Cache Prevention**:
> Google Cloud Storage and mobile browsers heavily cache APK downloads if the filename URL remains unchanged. 
> Whenever releasing a new public build, **increment the version number** (e.g. `v1.0.1` -> `v1.0.2`):
> 1. Update `$targetName` in `d:\BestBill-apk\build_apk.ps1`.
> 2. Update `handleDownloadAndroid` in `C:\Users\shubh\Desktop\BestBill\frontend\src\pages\LandingPage.jsx`.

---

## 🚀 Git Push Checklist

After building the APK, commit and push changes to the remote repository:

```powershell
cd d:\BestBill-apk
git add .
git commit -m "Build and release updated APK"
git push origin main
```

---

## 🔐 Key System Behaviors

- **Fresh Device Onboarding**: On clean installs, the app automatically opens directly to **New Business Registration** (Owner Name, Hotel Name, Phone, Address, Email, Password).
- **Existing Device Login**: If a hotel is already registered on the device, the app opens to **Hotel Owner Login**.
- **Offline Registration**: Creates initial local SQLite tables (Tables 1-6), categories, and default menu items upon registration.
