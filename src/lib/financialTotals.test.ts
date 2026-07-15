import { computeDocumentTotals } from './financialTotals';
import { MasterModel } from '../modules/config/master.model';

jest.mock('../modules/config/master.model', () => ({
  MasterModel: { find: jest.fn() },
}));

const mockedFind = MasterModel.find as jest.Mock;

describe('computeDocumentTotals', () => {
  beforeEach(() => {
    mockedFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: 'tax18', meta: { ratePercent: 18 } }]),
    });
  });

  it('computes subtotal, tax, and total for a single intra-state line item', async () => {
    const result = await computeDocumentTotals(
      [{ description: 'Compressor', qty: 1, unitPrice: 1000, taxRateId: 'tax18' }],
      0,
      'Delhi',
      'Delhi'
    );

    expect(result.subtotal).toBe(1000);
    expect(result.taxBreakup.cgst).toBe(90);
    expect(result.taxBreakup.sgst).toBe(90);
    expect(result.taxBreakup.igst).toBe(0);
    expect(result.total).toBe(1180);
  });

  it('applies IGST for an inter-state transaction', async () => {
    const result = await computeDocumentTotals(
      [{ description: 'Compressor', qty: 1, unitPrice: 1000, taxRateId: 'tax18' }],
      0,
      'Delhi',
      'Maharashtra'
    );

    expect(result.taxBreakup.cgst).toBe(0);
    expect(result.taxBreakup.sgst).toBe(0);
    expect(result.taxBreakup.igst).toBe(180);
  });

  it('subtracts discount before computing the rounded total', async () => {
    const result = await computeDocumentTotals(
      [{ description: 'Compressor', qty: 1, unitPrice: 1000, taxRateId: 'tax18' }],
      100,
      'Delhi',
      'Delhi'
    );

    // subtotal 1000 + tax 180 - discount 100 = 1080
    expect(result.total).toBe(1080);
  });

  it('sums multiple line items correctly, including one with no tax rate', async () => {
    const result = await computeDocumentTotals(
      [
        { description: 'Compressor', qty: 1, unitPrice: 1000, taxRateId: 'tax18' },
        { description: 'Visiting charge', qty: 1, unitPrice: 200 },
      ],
      0,
      'Delhi',
      'Delhi'
    );

    expect(result.subtotal).toBe(1200);
    expect(result.taxBreakup.cgst).toBe(90);
    expect(result.taxBreakup.sgst).toBe(90);
  });
});
