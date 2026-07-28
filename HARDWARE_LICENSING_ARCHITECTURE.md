# BestBill Hardware Licensing & Vendor Super Admin Architecture Guide

> **Document Version**: 1.1.0  
> **Last Updated**: July 28, 2026  
> **Target Audience**: AI Coding Assistants, System Architects, Core Developers  
> **Purpose**: Complete technical reference for the Super Admin Vendor Licensing Portal, Hardware Machine UUID Identification, Cloud Database Sync, Offline Internet Recovery Pings, and Immediate Access Revocation Enforcement across **BestBill Desktop Application** (`BestBill-Offline`), **BestBill Mobile Application** (`BestBill-apk`), and **Vendor Admin Portal** (`BestBill`).

---

## 1. Overview & Business Intent

The **BestBill Hardware Licensing & Vendor Control System** enables the Super Admin (Shubham Pilane) to remotely monitor all registered Desktop and Mobile POS hardware licenses, track active subscription tiers (`FREE TRIAL`, `MONTHLY`, `YEARLY`, `PERMANENT`), and instantly turn access **ON or OFF** (`is_active: true/false`) from a centralized Vendor Admin Portal (`http://localhost:5173/admin`).

### Key Business Rules:
1. **Distinct Roles**:
   - **Super Admin (Vendor Portal)**: Accesses `http://localhost:5173/admin` to monitor all hardware licenses, view proprietor contact details, and toggle `is_active` status.
   - **Hotel Owners / Customers**: Use Desktop or Mobile POS locally for daily billing, orders, and sales analytics.
2. **Hardware UUID Uniqueness**:
   - Licenses are bound to unique device hardware UUIDs (`device_uuid`), ensuring every physical PC or mobile phone has a distinct record.
   - Pre-checks `device_uuid` before inserting into Supabase. If `device_uuid` exists, updates timestamps and profile info without overwriting `is_active` or subscription plan type.
3. **Daily 11:00 PM Status Ping**:
   - Desktop and Mobile applications schedule a daily status check & profile sync at **11:00 PM (23:00 local time)** every day.
4. **Offline Recovery & Reconnection Catch-up Ping System**:
   - If a device was **offline for 2-3 days** (no internet during 11:00 PM), the moment internet connection is restored on Day 4, no matter what time of day it is, the system **IMMEDIATELY pings Supabase** to verify revocation status.
   - If Super Admin revoked access while the device was offline, **the moment internet connects, access is immediately terminated**.
5. **Immediate 1-Second Access Revocation Hard Block**:
   - When Super Admin revokes access (`is_active: false`), the revocation status is flagged (`isRevokedBySuperAdmin = true`).
   - The middleware (`auth.js` on Desktop, `localRouter.js` on Mobile) intercepts all API requests and returns `HTTP 403 SERVICE_BLOCKED`.
   - The application UI immediately locks down with the **ACCESS REVOKED / EXPIRED** screen. No routes or features work, and the user cannot use the app for even 1 second.
6. **Offline POS Resilience**:
   - All network calls to Supabase are wrapped in non-blocking `try...catch` blocks (`.catch(() => {})`) with native `fetch` REST fallbacks.
   - If internet connection is lost, local POS operations (table management, billing, KOT printing, inventory) continue working seamlessly without throwing errors.

---

## 2. Directory Structure & Key Files

```
├── d:\BestBill-Offline\                      # Desktop POS System (Node.js + Express + SQLite + Electron)
│   ├── backend\src\
│   │   ├── index.js                          # Server entry, background cleanup, daily 11:00 PM scheduler & network recovery catch-up monitor
│   │   ├── middleware\auth.js                # JWT Auth & 1-second license revocation interceptor
│   │   ├── routes\
│   │   │   ├── auth.js                       # Login/Register endpoints with hardware revocation checks
│   │   │   ├── hotel.js                      # Hotel settings PUT route with synchronous Supabase sync
│   │   │   └── profile.js                    # Profile GET route with multi-table hotel name resolution
│   │   └── services\
│   │       └── licenseService.js             # Hardware ID generation, Supabase REST sync & revocation logic
│   └── frontend\src\context\AuthContext.jsx  # React Auth context with startup profile sync
│
├── d:\BestBill-apk\                          # Mobile POS System (React + Capacitor + SQLite)
│   └── frontend\src\services\
│       ├── localLicenseService.js            # Mobile hardware trial, Supabase check, revocation logic & online reconnection listener
│       ├── localRouter.js                    # Mobile client-side router with route-level license guards
│       └── supabaseClient.js                 # Supabase client singleton for mobile
│
└── c:\Users\shubh\Desktop\BestBill\          # Vendor Super Admin Web Portal (React + Supabase)
    └── frontend\src\pages\VendorAdminPage.jsx# Super Admin dashboard UI for toggling device licenses
```

---

## 3. Detailed Component & Code Specifications

### A. BestBill Desktop Backend (`d:\BestBill-Offline\backend\src\services\licenseService.js`)

#### 1. Hardware Machine Identification (`getDesktopMachineId`)
Reads physical hardware identifiers using 3 fallbacks:
- **Layer 1**: Windows WMI / CIM ComputerSystemProduct UUID (`(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID`).
- **Layer 2**: Motherboard Serial Number (`wmic baseboard get serialnumber`).
- **Layer 3**: Processor ID (`wmic cpu get processorid`).

#### 2. Supabase Desktop License Check (`checkSupabaseDesktopLicenseStatus`)
- Queries Supabase table `desktop_licenses` for matching `device_uuid`.
- If `is_active === false`, sets internal flag `isRevokedBySuperAdmin = true`.
- Native `fetch` REST fallback ensures zero reliance on external `@supabase/supabase-js` package bundling.

#### 3. Automatic Profile & License Sync (`syncDesktopUserToSupabase`)
- Reads active local license details (`getLicenseDetails()`) to extract plan type (`'yearly'`, `'monthly'`, `'permanent'`, or `'trial'`).
- Reads proprietor name, contact email (`sachinthopate97@gmail.com`), phone number (`7522999053`), hotel name, and address from local SQLite DB (`bestbill.db`).
- Upserts the exact profile into Supabase `desktop_licenses` table.

```javascript
// Excerpt from licenseService.js
let isRevokedBySuperAdmin = false;

function getLicenseDetails() {
  if (isRevokedBySuperAdmin) {
    return {
      type: 'revoked',
      key: 'REVOKED',
      activatedAt: '',
      expiresAt: '',
      daysRemaining: 0,
      isValid: false,
      reason: 'ACCESS TERMINATED: Desktop hardware access revoked by Super Admin.'
    };
  }
  // ... local activation key validation ...
}
```

---

### B. Daily 11:00 PM & Network Reconnection Recovery Scheduler (`d:\BestBill-Offline\backend\src\index.js`)

Calculates milliseconds until 11:00 PM (23:00 local time) every day AND monitors network reconnection for devices offline 2-3 days:

```javascript
let lastSuccessfulPingMs = 0;
let isPendingNetworkRetry = false;

const performLicenseSyncAndCheck = async () => {
  try {
    const statusRes = await checkSupabaseDesktopLicenseStatus();
    await syncDesktopUserToSupabase();
    if (statusRes) {
      lastSuccessfulPingMs = Date.now();
      isPendingNetworkRetry = false;
    }
  } catch (e) {
    isPendingNetworkRetry = true;
  }
};

// 1. Initial startup ping
performLicenseSyncAndCheck();

// 2. Schedule daily 11:00 PM ping
const scheduleDaily11PmPing = () => {
  const now = new Date();
  const next11Pm = new Date();
  next11Pm.setHours(23, 0, 0, 0);
  if (now >= next11Pm) {
    next11Pm.setDate(next11Pm.getDate() + 1);
  }
  const msUntil11Pm = next11Pm.getTime() - now.getTime();

  setTimeout(() => {
    performLicenseSyncAndCheck();
    setInterval(() => {
      performLicenseSyncAndCheck();
    }, 1000 * 60 * 60 * 24);
  }, msUntil11Pm);
};
scheduleDaily11PmPing();

// 3. Network Recovery Catch-up Monitor (checks every 1 minute)
// If device was offline for 2-3 days, as soon as internet connects, pings Supabase IMMEDIATELY!
setInterval(() => {
  const hoursPassed = (Date.now() - lastSuccessfulPingMs) / (1000 * 60 * 60);
  if (isPendingNetworkRetry || hoursPassed >= 24) {
    performLicenseSyncAndCheck();
  }
}, 1000 * 60 * 1);
```

---

### C. Immediate API Guard (`d:\BestBill-Offline\backend\src\middleware\auth.js`)

Intercepts every incoming Express API request:

```javascript
if (verified.role !== 'admin') {
  const { getLicenseDetails } = require('../services/licenseService');
  const details = getLicenseDetails();
  
  if (!details.isValid) {
    if (details.type === 'revoked') {
      return res.status(403).json({
        message: 'SERVICE_BLOCKED',
        reason: details.reason || 'ACCESS TERMINATED: Hardware access revoked by Super Admin.'
      });
    }
    // ... plan expired check ...
  }
}
```

---

### D. Mobile APK Revocation Guard & Online Reconnection Listener (`d:\BestBill-apk\frontend\src\services\localLicenseService.js`)

Runs `checkSupabaseRemoteLicenseStatus()` at the top of `getLicenseDetails()` for all plan tiers AND adds a network reconnection listener:

```javascript
const hwInfo = await getHardwareTrialInfo();
const remoteStatus = await checkSupabaseRemoteLicenseStatus(hwInfo.hardwareId);
if (remoteStatus.checked && remoteStatus.is_active === false) {
  return {
    type: 'revoked',
    key,
    isValid: false,
    daysRemaining: 0,
    hardwareId: hwInfo.hardwareId,
    reason: remoteStatus.reason
  };
}

// Auto-listener for mobile network reconnection:
// If device was offline for 2-3 days, the moment internet is reconnected, triggers an immediate remote revocation check!
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[MOBILE LICENSE] Network reconnected! Triggering immediate remote revocation check...');
    try {
      const details = await getLicenseDetails();
      if (!details.isValid && details.type === 'revoked') {
        window.location.reload();
      }
    } catch (e) {}
  });
}
```

---

### E. Super Admin Vendor Portal (`c:\Users\shubh\Desktop\BestBill\frontend\src\pages\VendorAdminPage.jsx`)

Provides the Super Admin UI for monitoring and managing device licenses:
- **URL**: `http://localhost:5173/admin`
- **Credentials**: Email `shubhampilane143@pilane.com` / Password `BestBilll@Shubh#18`
- **Features**:
  - Platform Badges: `🖥️ Desktop App` / `📱 Mobile App`
  - Subscription Badges: `FREE TRIAL`, `MONTHLY`, `YEARLY`, `PERMANENT`
  - Owner Profile Details: Real proprietor name, phone number, contact email
  - Device Hardware UUID: Machine hardware identifier
  - Status Toggle Button: Toggles `is_active: true/false` directly in Supabase.
  - Refresh Data Button: Spinning icon animation (`@keyframes spinIcon`) with toast feedback.

---

## 4. Instructions for Future AI Agents

When asked to extend, modify, or troubleshoot this feature:

1. **Preserve Offline-First Architecture**:
   - NEVER make Supabase or remote network calls blocking on POS startup or billing transactions.
   - Always wrap Supabase API calls in `try...catch` and `.catch(() => {})`.
2. **Preserve Device Hardware Uniqueness**:
   - Always check `device_uuid` on `desktop_licenses` and `mobile_licenses` before inserting.
   - Never reset `is_active` or subscription `plan` when auto-syncing ping timestamps.
3. **Preserve Access Revocation & Offline Recovery Guarantees**:
   - Maintain the 1-second immediate hard block in `auth.js` middleware and `localRouter.js`.
   - Ensure network reconnection monitors in `index.js` and `localLicenseService.js` remain active so devices offline for 2-3 days ping Supabase immediately upon network restoration.
   - Never allow any API route to execute if `details.type === 'revoked'` or `is_active === false`.
4. **Packaging Considerations**:
   - Ensure `@supabase/supabase-js` is listed in root `package.json` dependencies if `electron-builder` is used.
   - Maintain native `fetch` REST fallbacks in `licenseService.js` to ensure zero `Cannot find module` errors during Electron app bootstrap.
