/**
 * Data Protection Module
 * Protects sensitive data from exposure
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'access_token',
  'refresh_token',
  'api_key',
  'private_key',
  'credit_card',
  'ssn',
];

/**
 * Safe logging - removes sensitive data before logging
 */
export const safeLog = (label, data) => {
  const safe = sanitizeSensitiveData(data);
  console.log(`[${label}]`, safe);
};

/**
 * Safe error logging
 */
export const safeErrorLog = (label, error) => {
  const safe = {
    message: error?.message || 'Unknown error',
    code: error?.code,
    status: error?.status,
  };
  console.error(`[ERROR - ${label}]`, safe);
};

/**
 * Removes sensitive data from objects recursively
 */
export const sanitizeSensitiveData = (obj) => {
  if (!obj) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeSensitiveData(item));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Secure storage - prevents accidental storage of sensitive data
 */
export const secureStorage = {
  set: (key, value) => {
    const isSensitive = SENSITIVE_KEYS.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
    
    if (isSensitive) {
      console.warn(`⚠️ Security Warning: Attempted to store sensitive data in localStorage: ${key}`);
      return false;
    }
    
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  },

  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Storage error:', error);
      return null;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  },

  clear: () => {
    try {
      const preservedKeys = ['budgetrent_hidden_properties'];
      const preserved = {};
      
      preservedKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) preserved[key] = value;
      });
      
      localStorage.clear();
      
      Object.entries(preserved).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }
};

/**
 * Clear all sensitive session data
 */
export const clearSensitiveData = () => {
  const keysToRemove = Object.keys(localStorage).filter(key =>
    SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))
  );
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Also clear sessionStorage
  Object.keys(sessionStorage).forEach(key => {
    if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sessionStorage.removeItem(key);
    }
  });
};

/**
 * Generate secure random string for tokens/IDs
 */
export const generateSecureId = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
};

/**
 * Hash password on client (for display/verification only)
 * Always use Supabase auth for actual password handling
 */
export const hashString = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
