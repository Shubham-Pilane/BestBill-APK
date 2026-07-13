const MONTHLY_KEYS = {
  0: 'X7p9K2m8Q4', // Jan
  1: 'N9wT3zL8r5', // Feb
  2: 'R5bY7qD2k9', // Mar
  3: 'C8uM1xP6t3', // Apr
  4: 'H4kV9nJ3w7', // May
  5: 'Z2rF8yW7m1', // Jun
  6: 'T6pL3cN9q4', // Jul
  7: 'B1dQ7mK5x8', // Aug
  8: 'G9xR2vH4p6', // Sep
  9: 'Y3jC8tM1n7', // Oct
  10: 'P7nW4bX6k2', // Nov
  11: 'L5sZ9qF2r8'  // Dec
};

const YEARLY_KEYS = {
  0: 'M7xK2pQ8r4',
  1: 'T9bW3nL5y7',
  2: 'C4vR8mP1k6',
  3: 'H2qN7xJ9t5',
  4: 'Z8pF3wD6r1',
  5: 'B5mY9kT2c7',
  6: 'L1xV4nQ8p3',
  7: 'R6tK2bW7m9',
  8: 'P3yH8qN5x2',
  9: 'F7cM1rZ4v8'
};

const PERMANENT_KEYS = {
  0: 'X7P9K2M8Q4', // Jan
  1: 'N9WT3ZL8R5', // Feb
  2: 'R5BY7QD2K9', // Mar
  3: 'C8UM1XP6T3', // Apr
  4: 'H4KV9NJ3W7', // May
  5: 'Z2RF8YW7M1', // Jun
  6: 'T6PL3CN9Q4', // Jul
  7: 'B1DQ7MK5X8', // Aug
  8: 'G9XR2VH4P6', // Sep
  9: 'Y3JC8TM1N7', // Oct
  10: 'P7NW4BX6K2', // Nov
  11: 'L5SZ9QF2R8'  // Dec
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
