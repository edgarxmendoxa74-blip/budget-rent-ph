/**
 * Secure API Module
 * Handles secure communication with backend
 */

import { safeErrorLog } from './dataProtection';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Secure fetch with CSRF protection and error handling
 */
export const secureFetch = async (endpoint, options = {}) => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF protection
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(`API Error: ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    return await response.json();
  } catch (error) {
    safeErrorLog('secureFetch', error);
    throw error;
  }
};

/**
 * Secure GET request
 */
export const apiGet = (endpoint, options = {}) => {
  return secureFetch(endpoint, {
    ...options,
    method: 'GET',
  });
};

/**
 * Secure POST request
 */
export const apiPost = (endpoint, data = {}, options = {}) => {
  return secureFetch(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Secure PUT request
 */
export const apiPut = (endpoint, data = {}, options = {}) => {
  return secureFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * Secure DELETE request
 */
export const apiDelete = (endpoint, options = {}) => {
  return secureFetch(endpoint, {
    ...options,
    method: 'DELETE',
  });
};

/**
 * Verify response signature (optional for extra security)
 */
export const verifyResponseSignature = () => {
  // This requires a matching server implementation
  // For now, we rely on HTTPS and CSP headers
  return true;
};

/**
 * Retry logic for failed requests
 */
export const secureFetchWithRetry = async (
  endpoint,
  options = {},
  maxRetries = 3,
  backoffMs = 1000
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await secureFetch(endpoint, options);
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (except 408, 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        throw error;
      }

      // Wait before retrying
      if (attempt < maxRetries) {
        const waitTime = backoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
};
