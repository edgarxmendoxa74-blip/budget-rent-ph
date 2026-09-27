/**
 * Rate Limiter Module
 * Prevents abuse and DoS attacks
 */

class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  reset(key) {
    this.requests.delete(key);
  }

  getRemaining(key) {
    const userRequests = this.requests.get(key) || [];
    const now = Date.now();
    const validRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    return this.maxRequests - validRequests.length;
  }
}

// Create different limiters for different operations
export const apiLimiter = new RateLimiter(10, 60000); // 10 requests per minute
export const authLimiter = new RateLimiter(5, 900000); // 5 attempts per 15 minutes
export const searchLimiter = new RateLimiter(30, 60000); // 30 searches per minute
export const submitLimiter = new RateLimiter(3, 60000); // 3 submissions per minute

export default RateLimiter;
