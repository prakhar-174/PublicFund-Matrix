import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge class names with Tailwind CSS support.
 * @param {...any} inputs - Class values to merge
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency using Intl.NumberFormat.
 * @param {number|string} value - Numerical amount
 * @param {string} [currency='INR'] - Currency code (defaults to 'INR')
 * @returns {string}
 */
export function formatCurrency(value, currency = "INR") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—"
  }
  const num = Number(value)
  const locale = currency === "INR" ? "en-IN" : "en-US"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num)
}

/**
 * Format a number or ratio as a percentage.
 * @param {number|string} value - Numerical value or ratio (e.g. 0.125 -> 12.5%)
 * @returns {string}
 */
export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—"
  }
  const num = Number(value)
  return new Intl.NumberFormat("en-IN", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(num)
}

/**
 * Format large numbers in compact notation (e.g. 1.2M, 45K).
 * @param {number|string} value - Numerical amount
 * @returns {string}
 */
export function formatCompact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—"
  }
  const num = Number(value)
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(num)
}
