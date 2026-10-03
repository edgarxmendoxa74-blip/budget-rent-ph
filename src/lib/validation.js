/**
 * Input Validation & Sanitization Module
 * Prevents XSS, SQL injection, and invalid data
 */

const sanitizeString = (str) => {
  if (!str) return '';
  return str
    .trim()
    .replace(/[<>"'`]/g, '') // Remove HTML/script characters
    .substring(0, 500); // Limit length
};

export const validatePropertyInput = (property) => {
  const errors = [];
  
  // Validate title
  if (!property.title || property.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  }
  
  if (property.title && property.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }
  
  // Validate price
  if (!property.price || isNaN(property.price)) {
    errors.push('Invalid price');
  }
  
  const priceNum = parseInt(property.price, 10);
  if (priceNum < 100 || priceNum > 999999) {
    errors.push('Price must be between ₱100 and ₱999,999');
  }
  
  // Validate location
  if (!property.location || property.location.trim().length < 3) {
    errors.push('Invalid location');
  }
  
  if (property.location && property.location.length > 200) {
    errors.push('Location must be less than 200 characters');
  }
  
  // Validate description
  if (property.description && property.description.length > 2000) {
    errors.push('Description must be less than 2000 characters');
  }
  
  // Validate category
  const validCategories = ['Paupahan', 'Staycation', 'Boarding House', 'Bed Space', 'Apartment', 'Studio'];
  if (!property.type && !validCategories.includes(property.category)) {
    errors.push('Invalid property category');
  }
  
  // Sanitize all string fields
  const sanitized = {
    title: sanitizeString(property.title),
    description: sanitizeString(property.description),
    location: sanitizeString(property.location),
    owner_name: sanitizeString(property.owner_name),
    price: priceNum,
    type: property.type || property.category,
  };
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    sanitized 
  };
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);
  return {
    isValid,
    sanitized: isValid ? email.toLowerCase().trim() : null,
    error: isValid ? null : 'Invalid email format'
  };
};

export const validatePhone = (phone) => {
  // Philippine phone format: +63 or 0 followed by digits
  const phoneRegex = /^(\+63|0)\d{9,10}$/;
  const cleaned = phone.replace(/\s|-/g, '');
  const isValid = phoneRegex.test(cleaned);
  return {
    isValid,
    sanitized: isValid ? cleaned : null,
    error: isValid ? null : 'Invalid Philippine phone number'
  };
};

export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  const isValid = usernameRegex.test(username);
  return {
    isValid,
    sanitized: isValid ? username : null,
    error: isValid ? null : 'Username must be 3-20 characters (alphanumeric, dash, underscore only)'
  };
};

export const validateImageUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const validProtocols = ['http:', 'https:'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    const hasValidProtocol = validProtocols.includes(urlObj.protocol);
    const hasValidExtension = validExtensions.some(ext => 
      urlObj.pathname.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidProtocol || !hasValidExtension) {
      return {
        isValid: false,
        sanitized: null,
        error: 'Only HTTPS image URLs (JPG, PNG, WebP, GIF) are allowed'
      };
    }
    
    return {
      isValid: true,
      sanitized: url,
      error: null
    };
  } catch {
    return {
      isValid: false,
      sanitized: null,
      error: 'Invalid URL format'
    };
  }
};

export const validateSearchQuery = (query) => {
  const sanitized = sanitizeString(query).substring(0, 100);
  return {
    isValid: sanitized.length > 0,
    sanitized,
    error: sanitized.length === 0 ? 'Search query cannot be empty' : null
  };
};

export const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'number') {
      sanitized[key] = Number.isFinite(value) ? value : 0;
    } else if (typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = null;
    }
  }
  return sanitized;
};
