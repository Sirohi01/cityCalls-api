const INDIA_POST_PINCODE_API = 'https://api.postalpincode.in/pincode';

interface IndiaPostPostOffice {
  Name: string;
  District: string;
  State: string;
  Country: string;
}

interface IndiaPostResponse {
  Status: string;
  PostOffice: IndiaPostPostOffice[] | null;
}

export interface PincodeLookupResult {
  city: string;
  state: string;
  country: string;
  district: string;
  postOffices: string[];
}

export async function lookupPincode(pincode: string): Promise<PincodeLookupResult | null> {
  const res = await fetch(`${INDIA_POST_PINCODE_API}/${encodeURIComponent(pincode)}`);
  if (!res.ok) return null;

  const data = (await res.json()) as IndiaPostResponse[];
  const result = data[0];
  if (!result || result.Status !== 'Success' || !result.PostOffice || result.PostOffice.length === 0) {
    return null;
  }

  const [primary] = result.PostOffice;
  return {
    city: primary.District,
    state: primary.State,
    country: primary.Country || 'India',
    district: primary.District,
    postOffices: result.PostOffice.map((po) => po.Name),
  };
}
