// GST split calculation — docs/16-pdf-and-financial-documents.md §3: computed
// server-side from branch and customer state, never client-entered. Intra-state
// (branch and customer in the same state) splits the tax rate evenly across
// CGST+SGST; inter-state applies the full rate as IGST. This compares state
// names directly (case-insensitive) rather than looking up the full India
// GST state-code table — sufficient for the CGST/SGST-vs-IGST decision itself,
// which is what actually drives the tax breakup; formatting a GSTIN's embedded
// state-code digits is a separate, purely cosmetic concern not needed here.
export interface TaxBreakup {
  cgst: number;
  sgst: number;
  igst: number;
}

function normalizeState(state: string): string {
  return state.trim().toLowerCase();
}

export function isIntraState(branchState: string, customerState: string): boolean {
  return normalizeState(branchState) === normalizeState(customerState);
}

export function computeTaxBreakup(taxableAmount: number, taxRatePercent: number, branchState: string, customerState: string): TaxBreakup {
  const totalTax = round2((taxableAmount * taxRatePercent) / 100);

  if (isIntraState(branchState, customerState)) {
    const half = round2(totalTax / 2);
    // Ensure the two halves always sum exactly to totalTax despite rounding.
    return { cgst: half, sgst: round2(totalTax - half), igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: totalTax };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
