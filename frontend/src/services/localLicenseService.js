import { registerPlugin } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { supabase } from './supabaseClient';

const HardwareTrial = registerPlugin('HardwareTrial');

export async function getHardwareTrialInfo() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const res = await HardwareTrial.getHardwareInfo();
      if (res && res.hardwareId) {
        return res;
      }
    }
  } catch (e) {
    console.warn('[HARDWARE TRIAL] Native check fallback:', e.message);
  }

  let hwId = 'WEB_DEV_ID';
  try {
    const idInfo = await Device.getId();
    hwId = idInfo.identifier || 'WEB_DEV_ID';
  } catch (e) {}

  const trialStart = localStorage.getItem('hw_first_reg_' + hwId) || '';
  return { hardwareId: hwId, firstTrialStart: trialStart };
}

export async function recordHardwareTrial(timestamp) {
  const ts = timestamp || new Date().toISOString();
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const res = await HardwareTrial.recordHardwareTrial({ timestamp: String(ts) });
      if (res && res.firstTrialStart) {
        return res;
      }
    }
  } catch (e) {
    console.warn('[HARDWARE TRIAL] Native record fallback:', e.message);
  }

  let hwId = 'WEB_DEV_ID';
  try {
    const idInfo = await Device.getId();
    hwId = idInfo.identifier || 'WEB_DEV_ID';
  } catch (e) {}

  let existing = localStorage.getItem('hw_first_reg_' + hwId);
  if (!existing) {
    existing = String(ts);
    localStorage.setItem('hw_first_reg_' + hwId, existing);
  }
  return { hardwareId: hwId, firstTrialStart: existing };
}

/**
 * Pings Supabase to sync the license status. 
 * Executed purely in the background by cron or network triggers.
 */
export async function syncLicenseWithSupabase() {
  try {
    const hwInfo = await getHardwareTrialInfo();
    const targetHwId = hwInfo.hardwareId;
    const nowIso = new Date().toISOString();

    let { data, error } = await supabase
      .from('mobile_licenses')
      .select('is_active, plan, id')
      .eq('device_uuid', targetHwId)
      .maybeSingle();

    if (error) {
      console.warn('[SUPABASE SYNC] Remote check error:', error.message);
      return { success: false };
    }

    let ownerName = 'Mobile Owner';
    let userEmail = '';
    let hotelName = 'Mobile Hotel';
    let mobileNumber = '';
    let address = '';

    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        ownerName = userObj.name || 'Mobile Owner';
        userEmail = userObj.email || '';
        hotelName = userObj.hotel_name || 'Mobile Hotel';
        mobileNumber = userObj.hotel_phone || userObj.phone || '';
        address = userObj.hotel_location || userObj.hotel_address || '';
      }
    } catch (e) {}

    if (ownerName === 'Mobile Owner') ownerName = localStorage.getItem('user_name') || 'Mobile Owner';
    if (userEmail === '') userEmail = localStorage.getItem('user_email') || '';
    if (hotelName === 'Mobile Hotel') hotelName = localStorage.getItem('hotel_name') || 'Mobile Hotel';
    if (mobileNumber === '') mobileNumber = localStorage.getItem('user_phone') || '';
    if (address === '') address = localStorage.getItem('hotel_address') || '';

    if (!data) {
      const { data: newReg, error: regErr } = await supabase
        .from('mobile_licenses')
        .insert({
          device_uuid: targetHwId,
          hotel_name: hotelName,
          owner_name: ownerName,
          email: userEmail,
          mobile_number: mobileNumber,
          address: address,
          plan: 'trial',
          is_active: true,
          registration_date: nowIso,
          last_ping_at: nowIso,
          updated_at: nowIso
        })
        .select('is_active, plan, id')
        .single();

      if (!regErr && newReg) {
        data = newReg;
        console.log('[SUPABASE SYNC] Registered new mobile device hardware UUID in Supabase:', targetHwId);
      }
    } else {
      const updateData = { last_ping_at: nowIso, updated_at: nowIso };
      
      if (ownerName !== 'Mobile Owner' && hotelName !== 'Mobile Hotel') {
        updateData.hotel_name = hotelName;
        updateData.owner_name = ownerName;
        updateData.email = userEmail;
        updateData.mobile_number = mobileNumber;
        updateData.address = address;
      }
      
      await supabase
        .from('mobile_licenses')
        .update(updateData)
        .eq('id', data.id);
    }

    // Successfully contacted server, record the last internet verification date
    localStorage.setItem('LAST_INTERNET_VERIFICATION_DATE', nowIso);

    if (data && data.is_active === false) {
      localStorage.setItem('IS_REVOKED', 'true');
      return { success: true, is_active: false, reason: 'ACCESS TERMINATED: Your device access has been deactivated by Super Admin. Contact Support: 9822401802.' };
    }

    localStorage.removeItem('IS_REVOKED');
    return { success: true, is_active: true };
  } catch (err) {
    console.warn('[SUPABASE SYNC] Check exception:', err.message);
    return { success: false };
  }
}

const MONTHLY_KEYS = {
  0: 'X8m2K9P4Q7v3', // Jan
  1: 'N4w7T3L8R5j2', // Feb
  2: 'R9b2Y7Q5K3m4', // Mar
  3: 'C3u7M1P8T6x9', // Apr
  4: 'H8k5V2N9W4z7', // May
  5: 'Z4r8F2W9M7p5', // Jun
  6: 'T9p3L7C2Q8k4', // Jul
  7: 'B5d8Q2M9X4y1', // Aug
  8: 'G3x7R9V2P5n8', // Sep
  9: 'Y8j4C2T9N5w6', // Oct
  10: 'P2n8W5B9K4d3', // Nov
  11: 'L9s4Z7Q2R5h9'  // Dec
};

const YEARLY_KEYS = {
  0: 'M4x9K2P7R3',
  1: 'T8b5W3N9Y2',
  2: 'C7v2R8P5K9',
  3: 'H5q9N2J7T4',
  4: 'Z3p8F5W2R9',
  5: 'B9m4Y2K7C5',
  6: 'L8x3V9Q2P7',
  7: 'R4t8K2W9M5',
  8: 'P9y3H7Q2X5',
  9: 'F2c8M5R9V4'
};

const PERMANENT_KEYS = {
  0: 'G2bX8qN5w9', // Jan
  1: 'T4vY1mM7p3', // Feb
  2: 'D6kP9xL2j8', // Mar
  3: 'Z5cH3tR9b1', // Apr
  4: 'Q7mN2yK8v4', // May
  5: 'W1pR6xJ4d9', // Jun
  6: 'F9sV4bC7m2', // Jul
  7: 'H3yL8qN1x5', // Aug
  8: 'B5dK2wT9p4', // Sep
  9: 'N7xM1rJ6c3', // Oct
  10: 'L4vP9hB2z8', // Nov
  11: 'Y2qC7mX5n1'  // Dec
};

/**
 * Calculates HMAC-SHA256 signature to protect the license parameters from tampering.
 */
async function calculateSignature(key, expiryDate, type) {
  const encoder = new TextEncoder();
  const secret = encoder.encode('BestBillLicenseSecretSalt2026');
  const message = encoder.encode(`${key}|${expiryDate}|${type}`);
  
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    message
  );
  
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads, parses, and validates the license parameters stored in local storage.
 * @returns {Promise<object>} Parsed and validated license details.
 */
export async function getLicenseDetails() {
  try {
    const key = localStorage.getItem('license_key') || 'TRIAL_MODE';
    const activatedAt = localStorage.getItem('license_activation_date') || '';
    const expiresAt = localStorage.getItem('license_expiry_date') || '';
    const type = localStorage.getItem('license_type') || 'trial';
    const signature = localStorage.getItem('license_signature') || '';

    const hwInfo = await getHardwareTrialInfo();
    
    // Completely Synchronous Local Check - No UI Network Requests!
    if (localStorage.getItem('IS_REVOKED') === 'true') {
      return {
        type: 'revoked',
        key,
        isValid: false,
        daysRemaining: 0,
        hardwareId: hwInfo.hardwareId,
        reason: 'ACCESS TERMINATED: Your device access has been deactivated by Super Admin. Contact Support: 9822401802.'
      };
    }

    if (key === 'TRIAL_MODE' || type === 'trial') {
      let firstStartStr = hwInfo.firstTrialStart;
      
      const localRegTime = localStorage.getItem('registration_date');
      if (!firstStartStr && localRegTime) {
        const rec = await recordHardwareTrial(localRegTime);
        firstStartStr = rec.firstTrialStart;
      } else if (!firstStartStr) {
        firstStartStr = new Date().toISOString();
        await recordHardwareTrial(firstStartStr);
      }

      let regTimeMs = Date.parse(firstStartStr);
      if (isNaN(regTimeMs)) {
        regTimeMs = Number(firstStartStr) || Date.now();
      }

      const expiresDate = new Date(regTimeMs + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const timeDiff = expiresDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
      const isValid = now <= expiresDate;

      return {
        type: 'trial',
        key,
        activatedAt: new Date(regTimeMs).toISOString(),
        expiresAt: expiresDate.toISOString(),
        daysRemaining,
        isValid,
        hardwareId: hwInfo.hardwareId,
        warning: false,
        offlineDays: 0
      };
    }

    // Verify signature to block direct local storage modifications
    const expectedSig = await calculateSignature(key, expiresAt, type);
    if (signature !== expectedSig) {
      console.error('[LICENSE WARNING] Signature mismatch! License parameters tampered.');
      return {
        type: 'invalid',
        key,
        isValid: false,
        daysRemaining: 0
      };
    }

    const now = new Date();
    const expiresDate = new Date(expiresAt);
    const timeDiff = expiresDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    const isValid = now <= expiresDate;

    let warning = false;
    let offlineDays = 0;

    const lastInternetDate = localStorage.getItem('LAST_INTERNET_VERIFICATION_DATE') || '';
    let verificationAnchorDate = lastInternetDate || activatedAt;
    if (!verificationAnchorDate && isValid && type !== 'invalid') {
      verificationAnchorDate = now.toISOString();
      localStorage.setItem('LAST_INTERNET_VERIFICATION_DATE', verificationAnchorDate);
    }

    if (verificationAnchorDate && isValid && type !== 'invalid') {
      const lastPing = new Date(verificationAnchorDate);
      if (!isNaN(lastPing.getTime())) {
        const offlineDiff = now.getTime() - lastPing.getTime();
        
        const diffSec = Math.floor(offlineDiff / 1000);
        offlineDays = Math.floor(diffSec / (60 * 60 * 24));
        
        if (offlineDays >= 30) {
          return {
            type: 'offline_blocked',
            key,
            activatedAt,
            expiresAt,
            daysRemaining: 0,
            isValid: false,
            reason: 'Your application has not been connected to the internet for the last 30 days. Please connect to the internet to verify your license.',
            hardwareId: hwInfo.hardwareId,
            offlineDays
          };
        } else if (offlineDays >= 25) {
          warning = true;
        }
      }
    }

    return {
      type,
      key,
      activatedAt,
      expiresAt,
      daysRemaining,
      isValid,
      hardwareId: hwInfo.hardwareId,
      warning,
      offlineDays
    };
  } catch (err) {
    console.error(`[LICENSE ERROR] Failed to get license details:`, err.message);
    return { type: 'trial', isValid: false, daysRemaining: 0 };
  }
}

/**
 * Returns the current activation key string.
 */
export async function getLicenseKey() {
  const details = await getLicenseDetails();
  return details.key || 'TRIAL_MODE';
}

/**
 * Checks if the configured license is valid and not expired.
 * @returns {Promise<boolean>} True if license is valid, false otherwise.
 */
export async function isLicenseValid() {
  const details = await getLicenseDetails();
  return details.isValid;
}

/**
 * Validates, calculates expiry dates, and writes the given activation key parameters to storage.
 */
export async function setLicenseKey(key) {
  try {
    let type = 'trial';
    let expiry = '';
    const now = new Date();
    const currentMonth = now.getMonth();

    if (key === 'TRIAL_MODE') {
      type = 'trial';
    } else if (key === PERMANENT_KEYS[currentMonth]) {
      type = 'permanent';
      expiry = new Date('2099-12-31T23:59:59.999Z').toISOString();
    } else if (Object.values(PERMANENT_KEYS).includes(key)) {
      console.warn(`[LICENSE] Permanent key rejected. Not valid for current month.`);
      return false;
    } else {
      // Check Monthly
      if (key === MONTHLY_KEYS[currentMonth]) {
        type = 'monthly';
        expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      } else {
        // Check Yearly
        const currentYear = now.getFullYear();
        const lastDigit = currentYear % 10;
        if (key === YEARLY_KEYS[lastDigit]) {
          type = 'yearly';
          expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 365 days
        } else {
          console.warn(`[LICENSE] Key rejected. Not valid for current month/year/permanent.`);
          return false;
        }
      }
    }

    const activatedAt = type === 'trial' ? '' : now.toISOString();
    const signature = type === 'trial' ? '' : await calculateSignature(key, expiry, type);

    localStorage.setItem('license_key', key);
    localStorage.setItem('license_activation_date', activatedAt);
    localStorage.setItem('license_expiry_date', expiry);
    localStorage.setItem('license_type', type);
    localStorage.setItem('license_signature', signature);

    console.log(`[LICENSE] Key successfully set and serialized. Type: ${type}, Expiry: ${expiry}`);
    return true;
  } catch (err) {
    console.error(`[LICENSE ERROR] Failed to set license key:`, err.message);
    return false;
  }
}
