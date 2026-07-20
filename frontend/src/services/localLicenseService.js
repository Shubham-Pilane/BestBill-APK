const MONTHLY_KEYS = {
  0: 'X8m2K9P4Q7', // Jan
  1: 'N4w7T3L8R5', // Feb
  2: 'R9b2Y7Q5K3', // Mar
  3: 'C3u7M1P8T6', // Apr
  4: 'H8k5V2N9W4', // May
  5: 'Z4r8F2W9M7', // Jun
  6: 'T9p3L7C2Q8', // Jul
  7: 'B5d8Q2M9X4', // Aug
  8: 'G3x7R9V2P5', // Sep
  9: 'Y8j4C2T9N5', // Oct
  10: 'P2n8W5B9K4', // Nov
  11: 'L9s4Z7Q2R5'  // Dec
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
  0: 'X8M2K9P4Q7', // Jan
  1: 'N4W7T3L8R5', // Feb
  2: 'R9B2Y7Q5K3', // Mar
  3: 'C3U7M1P8T6', // Apr
  4: 'H8K5V2N9W4', // May
  5: 'Z4R8F2W9M7', // Jun
  6: 'T9P3L7C2Q8', // Jul
  7: 'B5D8Q2M9X4', // Aug
  8: 'G3X7R9V2P5', // Sep
  9: 'Y8J4C2T9N5', // Oct
  10: 'P2N8W5B9K4', // Nov
  11: 'L9S4Z7Q2R5'  // Dec
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

    if (key === 'TRIAL_MODE' || type === 'trial') {
      // Calculate trial remaining based on user registration
      // Fallback: 30 days trial
      const regTime = localStorage.getItem('registration_date') || new Date().toISOString();
      const expiresDate = new Date(new Date(regTime).getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const timeDiff = expiresDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
      const isValid = now <= expiresDate;

      return {
        type: 'trial',
        key,
        activatedAt: regTime,
        expiresAt: expiresDate.toISOString(),
        daysRemaining,
        isValid
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

    return {
      type,
      key,
      activatedAt,
      expiresAt,
      daysRemaining,
      isValid
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
