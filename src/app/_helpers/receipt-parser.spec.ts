import { parseReceiptText } from './receipt-parser';

describe('parseReceiptText', () => {
  it('extracts a labelled total, merchant, and ISO date', () => {
    const result = parseReceiptText(
      'GREEN LEAF PHARMACY\nDate: 2026-10-18\nGrand Total: BDT 1,245.50\nThank you'
    );

    expect(result.merchant).toBe('GREEN LEAF PHARMACY');
    expect(result.amount).toBe(1245.5);
    expect(result.date).toEqual(new Date(2026, 9, 18));
    expect(result.confidence).toBe('high');
  });

  it('falls back to the last amount when no total label exists', () => {
    const result = parseReceiptText('Market\nMilk 120.00\nBread 80.00');

    expect(result.amount).toBe(80);
    expect(result.merchant).toBe('Market');
    expect(result.confidence).toBe('medium');
  });

  it('does not return invalid dates or zero amounts', () => {
    const result = parseReceiptText('Shop\nDate: 31/02/2026\nTotal: 0');

    expect(result.date).toBeUndefined();
    expect(result.amount).toBeUndefined();
    expect(result.confidence).toBe('low');
  });
});
