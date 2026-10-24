const DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';

export const toLatinDigits = (s: string) =>
  s.replace(/[۰-۹٠-٩]/g, (d) => String(DIGITS.indexOf(d) % 10));