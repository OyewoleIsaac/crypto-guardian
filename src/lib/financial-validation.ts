import { z } from 'zod';

// Maximum amount allowed for financial transactions (1 billion USD)
export const MAX_FINANCIAL_AMOUNT = 1_000_000_000;

// Minimum amount for transactions
export const MIN_FINANCIAL_AMOUNT = 0.01;

/**
 * Zod schema for validating financial amount strings
 * - Must be a valid number format with up to 2 decimal places
 * - Must be positive
 * - Must not exceed maximum
 * - Must be a finite number
 */
export const financialAmountSchema = z.string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format. Use numbers with up to 2 decimal places.')
  .transform(val => parseFloat(val))
  .refine(val => !isNaN(val) && isFinite(val), 'Invalid number')
  .refine(val => val >= MIN_FINANCIAL_AMOUNT, `Amount must be at least $${MIN_FINANCIAL_AMOUNT}`)
  .refine(val => val <= MAX_FINANCIAL_AMOUNT, `Amount cannot exceed $${MAX_FINANCIAL_AMOUNT.toLocaleString()}`);

/**
 * Zod schema for crypto amounts (up to 8 decimal places)
 */
export const cryptoAmountSchema = z.string()
  .regex(/^\d+(\.\d{1,8})?$/, 'Invalid crypto amount format')
  .transform(val => parseFloat(val))
  .refine(val => !isNaN(val) && isFinite(val), 'Invalid number')
  .refine(val => val > 0, 'Amount must be positive')
  .refine(val => val <= MAX_FINANCIAL_AMOUNT, 'Amount too large');

/**
 * Validates a financial amount string and returns the parsed number or null
 */
export function parseFinancialAmount(value: string): number | null {
  const result = financialAmountSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Validates a crypto amount string and returns the parsed number or null
 */
export function parseCryptoAmount(value: string): number | null {
  const result = cryptoAmountSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Safely adds two financial amounts with precision handling
 * Uses integer math to avoid floating point errors
 */
export function safeAddAmounts(a: number, b: number): number {
  // Convert to cents/smallest unit to avoid floating point issues
  const aInt = Math.round(a * 100);
  const bInt = Math.round(b * 100);
  const result = (aInt + bInt) / 100;
  
  // Check for overflow
  if (!isFinite(result) || result > MAX_FINANCIAL_AMOUNT) {
    throw new Error('Amount overflow');
  }
  
  return result;
}

/**
 * Safely subtracts two financial amounts with precision handling
 */
export function safeSubtractAmounts(a: number, b: number): number {
  const aInt = Math.round(a * 100);
  const bInt = Math.round(b * 100);
  const result = (aInt - bInt) / 100;
  
  return Math.max(0, result);
}

/**
 * Formats a number as a financial amount string
 */
export function formatFinancialAmount(amount: number): string {
  return amount.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Validates financial amount for form input
 * Returns error message or null if valid
 */
export function validateFinancialInput(value: string): string | null {
  if (!value || value.trim() === '') {
    return 'Amount is required';
  }
  
  const result = financialAmountSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues;
    return issues[0]?.message || 'Invalid amount';
  }
  
  return null;
}

/**
 * Checks if a value is a safe financial number
 */
export function isSafeFinancialNumber(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  if (isNaN(value) || !isFinite(value)) return false;
  if (value < 0 || value > MAX_FINANCIAL_AMOUNT) return false;
  return true;
}
