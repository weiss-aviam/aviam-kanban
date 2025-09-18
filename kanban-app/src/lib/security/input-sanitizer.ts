/**
 * Input sanitization and validation utilities for admin operations
 */

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
  normalizeEmail?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive input sanitizer
 */
export class InputSanitizer {
  /**
   * Sanitize a string input
   */
  static sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): SanitizationResult {
    const {
      allowHtml = false,
      maxLength = 1000,
      trimWhitespace = true,
      normalizeEmail = false,
    } = options;

    let sanitized = input;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Trim whitespace if requested
    if (trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Check length
    if (sanitized.length > maxLength) {
      errors.push(`Input exceeds maximum length of ${maxLength} characters`);
      sanitized = sanitized.substring(0, maxLength);
      warnings.push('Input was truncated to maximum length');
    }

    // Handle HTML content
    if (!allowHtml) {
      const originalLength = sanitized.length;
      sanitized = this.stripHtml(sanitized);
      if (sanitized.length !== originalLength) {
        warnings.push('HTML tags were removed from input');
      }
    } else {
      sanitized = this.sanitizeHtml(sanitized);
    }

    // Normalize email if requested
    if (normalizeEmail && this.isEmail(sanitized)) {
      sanitized = this.normalizeEmail(sanitized);
    }

    // Check for potential security threats
    const securityCheck = this.checkSecurityThreats(sanitized);
    if (!securityCheck.isValid) {
      errors.push(...securityCheck.errors);
    }

    return {
      sanitized,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize email address
   */
  static sanitizeEmail(email: string): SanitizationResult {
    let sanitized = email.toLowerCase().trim();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic email validation
    if (!this.isEmail(sanitized)) {
      errors.push('Invalid email format');
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousEmailPatterns(sanitized)) {
      errors.push('Email contains suspicious patterns');
    }

    // Normalize email
    sanitized = this.normalizeEmail(sanitized);

    return {
      sanitized,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize user name
   */
  static sanitizeName(name: string): SanitizationResult {
    return this.sanitizeString(name, {
      allowHtml: false,
      maxLength: 100,
      trimWhitespace: true,
    });
  }

  /**
   * Sanitize search query
   */
  static sanitizeSearchQuery(query: string): SanitizationResult {
    const result = this.sanitizeString(query, {
      allowHtml: false,
      maxLength: 200,
      trimWhitespace: true,
    });

    // Additional checks for search queries
    if (this.containsSQLInjection(result.sanitized)) {
      result.errors.push('Search query contains potential SQL injection');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Strip HTML tags from string
   */
  private static stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Sanitize HTML content (basic implementation)
   */
  private static sanitizeHtml(input: string): string {
    // Remove dangerous tags and attributes
    const dangerousTags = [
      'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
      'link', 'meta', 'style', 'base', 'frame', 'frameset'
    ];
    
    const dangerousAttributes = [
      'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
      'javascript:', 'vbscript:', 'data:'
    ];

    let sanitized = input;

    // Remove dangerous tags
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    // Remove dangerous attributes
    dangerousAttributes.forEach(attr => {
      const regex = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]*`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    return sanitized;
  }

  /**
   * Check if string is a valid email
   */
  private static isEmail(input: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  }

  /**
   * Normalize email address
   */
  private static normalizeEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;

    // Remove dots from Gmail addresses
    if (domain === 'gmail.com') {
      const normalizedLocal = localPart.replace(/\./g, '').split('+')[0];
      return `${normalizedLocal}@${domain}`;
    }

    return email;
  }

  /**
   * Check for suspicious email patterns
   */
  private static containsSuspiciousEmailPatterns(email: string): boolean {
    const suspiciousPatterns = [
      /\+.*script/i,
      /\+.*admin/i,
      /\+.*test/i,
      /\.{2,}/,
      /@.*@/,
      /[<>]/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(email));
  }

  /**
   * Check for security threats in input
   */
  private static checkSecurityThreats(input: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for XSS
    if (this.containsXSS(input)) {
      errors.push('Input contains potential XSS attack');
    }

    // Check for SQL injection
    if (this.containsSQLInjection(input)) {
      errors.push('Input contains potential SQL injection');
    }

    // Check for command injection
    if (this.containsCommandInjection(input)) {
      errors.push('Input contains potential command injection');
    }

    // Check for path traversal
    if (this.containsPathTraversal(input)) {
      errors.push('Input contains potential path traversal attack');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for XSS patterns
   */
  private static containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      /expression\s*\(/gi,
      /url\s*\(/gi,
      /&\s*\{/gi,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for SQL injection patterns
   */
  private static containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
      /(--|\/\*|\*\/)/gi,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/gi,
      /(\bUNION\b.*\bSELECT\b)/gi,
      /(\bINSERT\b.*\bINTO\b)/gi,
      /(\bDELETE\b.*\bFROM\b)/gi,
      /(\bUPDATE\b.*\bSET\b)/gi,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for command injection patterns
   */
  private static containsCommandInjection(input: string): boolean {
    const commandPatterns = [
      /[;&|`$(){}[\]]/,
      /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig|ping|wget|curl)\b/gi,
      /\.\.\//,
      /\/etc\/passwd/gi,
      /\/bin\//gi,
      /cmd\.exe/gi,
      /powershell/gi,
    ];

    return commandPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for path traversal patterns
   */
  private static containsPathTraversal(input: string): boolean {
    const pathPatterns = [
      /\.\.\//,
      /\.\.\\\\/,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
    ];

    return pathPatterns.some(pattern => pattern.test(input));
  }
}

/**
 * Sanitize object with multiple fields
 */
export function sanitizeObject(
  obj: Record<string, any>,
  fieldOptions: Record<string, SanitizationOptions> = {}
): {
  sanitized: Record<string, any>;
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
} {
  const sanitized: Record<string, any> = {};
  const errors: Record<string, string[]> = {};
  const warnings: Record<string, string[]> = {};
  let isValid = true;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const options = fieldOptions[key] || {};
      const result = InputSanitizer.sanitizeString(value, options);
      
      sanitized[key] = result.sanitized;
      
      if (!result.isValid) {
        errors[key] = result.errors;
        isValid = false;
      }
      
      if (result.warnings.length > 0) {
        warnings[key] = result.warnings;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return {
    sanitized,
    isValid,
    errors,
    warnings,
  };
}

export default InputSanitizer;
