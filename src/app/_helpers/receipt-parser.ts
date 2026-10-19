export interface ParsedReceipt {
  amount?: number;
  date?: Date;
  merchant?: string;
  confidence: 'high' | 'medium' | 'low';
}

const amountPattern = /(?:[$€£₨]|USD|EUR|GBP|BDT|TK)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)(?!\d)/i;
const datePatterns = [
  /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/,
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i,
];
const totalPattern = /(?:grand\s+total|total\s+due|amount\s+due|total)\D{0,12}/i;
const merchantHeaders = /^(receipt|invoice|tax invoice|date|time|total|subtotal|cash|change|thank you)\b/i;

function parseAmount(value: string): number | undefined {
  const normalized = value.replace(/[\s,]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function parseDate(line: string): Date | undefined {
  const iso = datePatterns[0].exec(line);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = datePatterns[1].exec(line);
  if (numeric) return validDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const named = datePatterns[2].exec(line);
  if (named) {
    const parsed = new Date(`${named[1]} ${named[2]} ${named[3]}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function validDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const date = lines.map(parseDate).find((value): value is Date => value != null);
  const totalLine = lines.find((line) => totalPattern.test(line));
  const totalMatch = totalLine ? amountPattern.exec(totalLine) : undefined;
  const fallbackAmounts = lines
    .filter((line) => !datePatterns.some((pattern) => pattern.test(line)))
    .map((line) => amountPattern.exec(line)?.[1])
    .filter((value): value is string => value != null)
    .map(parseAmount)
    .filter((value): value is number => value != null);
  const amount = parseAmount(totalMatch?.[1] ?? '') ?? fallbackAmounts.at(-1);
  const merchant = lines.find(
    (line) => line.length >= 2 && !merchantHeaders.test(line) && !datePatterns.some((pattern) => pattern.test(line))
  );
  const fields = [merchant, amount, date].filter((value) => value != null).length;

  return {
    ...(amount == null ? {} : { amount }),
    ...(date == null ? {} : { date }),
    ...(merchant == null ? {} : { merchant }),
    confidence: fields >= 3 ? 'high' : fields >= 2 ? 'medium' : 'low',
  };
}
