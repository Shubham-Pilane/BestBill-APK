# BestBill APK Generation Guide

This document serves as a reference for generating the Android APK for the BestBill application. If an AI agent or a developer needs to build a new APK after making changes, they should follow these exact steps.

## 1. Prerequisites

- **Java Development Kit (JDK):** The Android Gradle project is configured to require **Java 21** (`languageVersion=21`). Using Java 17 or any other version will cause the build to fail with a `Cannot find a Java installation` or `jlink executable does not exist` error.
- **Node.js & npm:** Required to build the frontend assets.
- **Environment Variables:** You MUST ensure `JAVA_HOME` is pointed to the root directory of your JDK 21 installation before running Gradle.

## 2. Build Process (Commands)

All commands should be executed from the `frontend` directory (`d:\BestBill-apk\frontend`).

### Step 1: Build the Web Frontend
First, compile the Vite React application into static assets.
```powershell
npm run build
```

### Step 2: Sync with Capacitor
Copy the newly built web assets into the Android native project.
```powershell
npx cap sync android
```

### Step 3: Compile the Android APK
Navigate into the `android` directory and use the Gradle wrapper to compile the Debug APK.
*(Ensure your PowerShell session has `JAVA_HOME` set correctly before running this).*
```powershell
cd android
.\gradlew assembleDebug
```

## 3. APK Output Location & Finalization

If the build is successful, the generated APK will be located deep inside the build directory at:
👉 `d:\BestBill-apk\frontend\android\app\build\outputs\apk\debug\app-debug.apk`

### Step 4: Rename and Move to Root
To make the APK easily accessible, copy and rename the generated `app-debug.apk` to the root of the project directory as `BestBill.apk`.

**PowerShell Command:**
```powershell
Copy-Item "d:\BestBill-apk\frontend\android\app\build\outputs\apk\debug\app-debug.apk" "d:\BestBill-apk\BestBill.apk" -Force
```

---
**Note for AI Agents:** When asked to "create the latest apk", you must run the build commands above natively. If the shell environment lacks JDK 21, you must download a portable OpenJDK 21 (e.g., from Microsoft or Adoptium), extract it, set the `$env:JAVA_HOME` variable to that extracted folder within your PowerShell session, and then execute `.\gradlew assembleDebug`.
