import { MasterModel } from '../modules/config/master.model';
import { computeTaxBreakup, round2, TaxBreakup } from './gst';

interface LineItemInput {
  description: string;
  partId?: string;
  qty: number;
  unitPrice: number;
  taxRateId?: string;
}

interface ComputedTotals {
  items: (LineItemInput & { lineTotal: number })[];
  subtotal: number;
  taxBreakup: TaxBreakup;
  roundOff: number;
  total: number;
}

// Shared totals computation for every financial document — one line item may
// carry its own tax rate (parts taxed differently from labour, for instance),
// so the overall taxBreakup is the sum of each line's own CGST/SGST/IGST split
// rather than one rate applied to the whole subtotal. Per docs/16 §3.
export async function computeDocumentTotals(
  rawItems: LineItemInput[],
  discount: number,
  branchState: string,
  customerState: string
): Promise<ComputedTotals> {
  const taxRateIds = [...new Set(rawItems.map((i) => i.taxRateId).filter(Boolean))] as string[];
  const taxRates = await MasterModel.find({ _id: { $in: taxRateIds }, masterType: 'TAX_RATE' }).lean();
  const rateById = new Map(taxRates.map((r) => [r._id.toString(), (r.meta?.ratePercent as number) ?? 0]));

  const items = rawItems.map((item) => ({ ...item, lineTotal: round2(item.qty * item.unitPrice) }));
  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));

  const taxBreakup: TaxBreakup = { cgst: 0, sgst: 0, igst: 0 };
  for (const item of items) {
    if (!item.taxRateId) continue;
    const ratePercent = rateById.get(item.taxRateId) ?? 0;
    const lineTax = computeTaxBreakup(item.lineTotal, ratePercent, branchState, customerState);
    taxBreakup.cgst = round2(taxBreakup.cgst + lineTax.cgst);
    taxBreakup.sgst = round2(taxBreakup.sgst + lineTax.sgst);
    taxBreakup.igst = round2(taxBreakup.igst + lineTax.igst);
  }

  const totalTax = round2(taxBreakup.cgst + taxBreakup.sgst + taxBreakup.igst);
  const preRoundTotal = round2(subtotal + totalTax - discount);
  const total = Math.round(preRoundTotal);
  const roundOff = round2(total - preRoundTotal);

  return { items, subtotal, taxBreakup, roundOff, total };
}
