/**
 * Secure Logging Utility
 * 
 * This module provides environment-aware logging that:
 * - Only outputs detailed logs in development mode
 * - Prevents sensitive information leakage in production
 * - Provides a consistent logging interface throughout the app
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error('User-friendly message', technicalError);
 *   logger.log('Debug info', data);
 */

/**
 * Checks if the current environment is development mode
 * Uses Vite's import.meta.env.DEV flag
 */
const isDevelopment = (): boolean => {
  return import.meta.env.DEV === true;
};

/**
 * Secure logger object with methods that respect environment settings
 * In production, logs are silenced to prevent information disclosure
 */
export const logger = {
  /**
   * Log error messages - only outputs in development
   * @param message - User-friendly error description
   * @param error - Optional technical error object (hidden in production)
   */
  error: (message: string, error?: unknown): void => {
    if (isDevelopment()) {
      console.error(message, error);
    }
    // In production, errors could be sent to a monitoring service
    // like Sentry, LogRocket, etc. - but not to the console
  },

  /**
   * Log warning messages - only outputs in development
   * @param message - Warning description
   * @param data - Optional additional data (hidden in production)
   */
  warn: (message: string, data?: unknown): void => {
    if (isDevelopment()) {
      console.warn(message, data);
    }
  },

  /**
   * Log informational/debug messages - only outputs in development
   * @param message - Debug message
   * @param data - Optional additional data (hidden in production)
   */
  log: (message: string, data?: unknown): void => {
    if (isDevelopment()) {
      console.log(message, data);
    }
  },

  /**
   * Log informational messages - only outputs in development
   * @param message - Info message
   * @param data - Optional additional data (hidden in production)
   */
  info: (message: string, data?: unknown): void => {
    if (isDevelopment()) {
      console.info(message, data);
    }
  },

  /**
   * Log debug messages - only outputs in development
   * @param message - Debug message
   * @param data - Optional additional data (hidden in production)
   */
  debug: (message: string, data?: unknown): void => {
    if (isDevelopment()) {
      console.debug(message, data);
    }
  },
};
