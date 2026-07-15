import { computeTaxBreakup, isIntraState } from './gst';

describe('isIntraState', () => {
  it('treats identical states as intra-state regardless of casing/whitespace', () => {
    expect(isIntraState('Delhi', ' delhi ')).toBe(true);
  });

  it('treats different states as inter-state', () => {
    expect(isIntraState('Delhi', 'Maharashtra')).toBe(false);
  });
});

describe('computeTaxBreakup', () => {
  it('splits the rate evenly across CGST+SGST for an intra-state transaction', () => {
    const result = computeTaxBreakup(1000, 18, 'Delhi', 'Delhi');
    expect(result.cgst).toBe(90);
    expect(result.sgst).toBe(90);
    expect(result.igst).toBe(0);
    expect(result.cgst + result.sgst).toBe(180);
  });

  it('applies the full rate as IGST for an inter-state transaction', () => {
    const result = computeTaxBreakup(1000, 18, 'Delhi', 'Maharashtra');
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(180);
  });

  it('rounds to 2 decimal places without losing the total', () => {
    const result = computeTaxBreakup(333.33, 18, 'Delhi', 'Delhi');
    const totalTax = Math.round(333.33 * 18) / 100;
    expect(Math.round((result.cgst + result.sgst) * 100) / 100).toBeCloseTo(totalTax, 2);
  });
});
