export interface SubBranchSeed {
  code: string;
  name: string;
  pinCodes: string[];
}

export interface BranchSeed {
  code: string;
  name: string;
  cities: string[];
  states: string[];
  subBranches: SubBranchSeed[];
}
export const BRANCH_SEED_DATA: BranchSeed[] = [
  {
    code: 'DELCS',
    name: 'Delhi NCR - Central & South Delhi',
    cities: ['New Delhi', 'South Delhi'],
    states: ['Delhi'],
    subBranches: [
      { code: 'DEL-CP', name: 'Connaught Place', pinCodes: ['110001'] },
      { code: 'DEL-KB', name: 'Karol Bagh', pinCodes: ['110005'] },
      { code: 'DEL-HKS', name: 'Hauz Khas', pinCodes: ['110016'] },
      { code: 'DEL-SKT', name: 'Saket', pinCodes: ['110017'] },
      { code: 'DEL-GK', name: 'Greater Kailash', pinCodes: ['110048'] },
      { code: 'DEL-LAJ', name: 'Lajpat Nagar', pinCodes: ['110024'] },
      { code: 'DEL-VK', name: 'Vasant Kunj', pinCodes: ['110070'] },
      { code: 'DEL-VV', name: 'Vasant Vihar', pinCodes: ['110057'] },
    ],
  },
  {
    code: 'DELNE',
    name: 'Delhi NCR - North & East Delhi',
    cities: ['North Delhi', 'East Delhi'],
    states: ['Delhi'],
    subBranches: [
      { code: 'DEL-ROH', name: 'Rohini', pinCodes: ['110085'] },
      { code: 'DEL-PIT', name: 'Pitampura', pinCodes: ['110034'] },
      { code: 'DEL-MDT', name: 'Model Town', pinCodes: ['110009'] },
      { code: 'DEL-CVL', name: 'Civil Lines', pinCodes: ['110054'] },
      { code: 'DEL-PRV', name: 'Preet Vihar', pinCodes: ['110092'] },
      { code: 'DEL-MYV', name: 'Mayur Vihar', pinCodes: ['110091'] },
      { code: 'DEL-SHD', name: 'Shahdara', pinCodes: ['110032'] },
    ],
  },
  {
    code: 'DELW',
    name: 'Delhi NCR - West Delhi',
    cities: ['West Delhi'],
    states: ['Delhi'],
    subBranches: [
      { code: 'DEL-RJG', name: 'Rajouri Garden', pinCodes: ['110027'] },
      { code: 'DEL-JNP', name: 'Janakpuri', pinCodes: ['110058'] },
      { code: 'DEL-DWK', name: 'Dwarka', pinCodes: ['110075'] },
      { code: 'DEL-PJB', name: 'Punjabi Bagh', pinCodes: ['110026'] },
    ],
  },
  {
    code: 'GGN',
    name: 'Gurgaon (Gurugram)',
    cities: ['Gurugram'],
    states: ['Haryana'],
    subBranches: [
      { code: 'GGN-CBC', name: 'DLF Cyber City', pinCodes: ['122002'] },
      { code: 'GGN-SHR', name: 'Sohna Road', pinCodes: ['122018'] },
      { code: 'GGN-S14', name: 'Sector 14-15', pinCodes: ['122001'] },
      { code: 'GGN-SSL', name: 'Sushant Lok', pinCodes: ['122009'] },
      { code: 'GGN-S56', name: 'Sector 56', pinCodes: ['122011'] },
    ],
  },
  {
    code: 'NOI',
    name: 'Noida & Greater Noida',
    cities: ['Noida', 'Greater Noida'],
    states: ['Uttar Pradesh'],
    subBranches: [
      { code: 'NOI-S18', name: 'Sector 18', pinCodes: ['201301'] },
      { code: 'NOI-S62', name: 'Sector 62', pinCodes: ['201309'] },
      { code: 'NOI-GNO', name: 'Greater Noida', pinCodes: ['201310'] },
      { code: 'NOI-GNW', name: 'Greater Noida West', pinCodes: ['201009'] },
    ],
  },
  {
    code: 'FBD',
    name: 'Faridabad',
    cities: ['Faridabad'],
    states: ['Haryana'],
    subBranches: [
      { code: 'FBD-NIT', name: 'NIT Faridabad', pinCodes: ['121001'] },
      { code: 'FBD-OLD', name: 'Old Faridabad', pinCodes: ['121002'] },
      { code: 'FBD-S15', name: 'Sector 15-21', pinCodes: ['121007'] },
    ],
  },
  {
    code: 'GZB',
    name: 'Ghaziabad',
    cities: ['Ghaziabad'],
    states: ['Uttar Pradesh'],
    subBranches: [
      { code: 'GZB-VAI', name: 'Vaishali', pinCodes: ['201010'] },
      { code: 'GZB-IND', name: 'Indirapuram', pinCodes: ['201014'] },
      { code: 'GZB-KSB', name: 'Kaushambi', pinCodes: ['201010'] },
      { code: 'GZB-RNE', name: 'Raj Nagar Extension', pinCodes: ['201017'] },
    ],
  },

  // --- Other major metros (pan-India coverage) ---
  {
    code: 'MUM',
    name: 'Mumbai Metropolitan Region',
    cities: ['Mumbai', 'Navi Mumbai', 'Thane'],
    states: ['Maharashtra'],
    subBranches: [
      { code: 'MUM-AND', name: 'Andheri', pinCodes: ['400053'] },
      { code: 'MUM-BAN', name: 'Bandra', pinCodes: ['400050'] },
      { code: 'MUM-POW', name: 'Powai', pinCodes: ['400076'] },
      { code: 'MUM-THN', name: 'Thane', pinCodes: ['400601'] },
    ],
  },
  {
    code: 'BLR',
    name: 'Bengaluru',
    cities: ['Bengaluru'],
    states: ['Karnataka'],
    subBranches: [
      { code: 'BLR-KOR', name: 'Koramangala', pinCodes: ['560034'] },
      { code: 'BLR-IND', name: 'Indiranagar', pinCodes: ['560038'] },
      { code: 'BLR-WHF', name: 'Whitefield', pinCodes: ['560066'] },
      { code: 'BLR-HSR', name: 'HSR Layout', pinCodes: ['560102'] },
    ],
  },
  {
    code: 'PUN',
    name: 'Pune',
    cities: ['Pune'],
    states: ['Maharashtra'],
    subBranches: [
      { code: 'PUN-KTH', name: 'Kothrud', pinCodes: ['411038'] },
      { code: 'PUN-HNJ', name: 'Hinjewadi', pinCodes: ['411057'] },
      { code: 'PUN-VMN', name: 'Viman Nagar', pinCodes: ['411014'] },
    ],
  },
  {
    code: 'HYD',
    name: 'Hyderabad',
    cities: ['Hyderabad'],
    states: ['Telangana'],
    subBranches: [
      { code: 'HYD-GCB', name: 'Gachibowli', pinCodes: ['500032'] },
      { code: 'HYD-BJH', name: 'Banjara Hills', pinCodes: ['500034'] },
      { code: 'HYD-MDP', name: 'Madhapur', pinCodes: ['500081'] },
    ],
  },
  {
    code: 'CHN',
    name: 'Chennai',
    cities: ['Chennai'],
    states: ['Tamil Nadu'],
    subBranches: [
      { code: 'CHN-TNR', name: 'T Nagar', pinCodes: ['600017'] },
      { code: 'CHN-ANR', name: 'Anna Nagar', pinCodes: ['600040'] },
      { code: 'CHN-OMR', name: 'OMR - Sholinganallur', pinCodes: ['600119'] },
    ],
  },
  {
    code: 'KOL',
    name: 'Kolkata',
    cities: ['Kolkata'],
    states: ['West Bengal'],
    subBranches: [
      { code: 'KOL-SLK', name: 'Salt Lake', pinCodes: ['700064'] },
      { code: 'KOL-PST', name: 'Park Street', pinCodes: ['700016'] },
      { code: 'KOL-NTN', name: 'New Town', pinCodes: ['700156'] },
    ],
  },
  {
    code: 'AHM',
    name: 'Ahmedabad',
    cities: ['Ahmedabad'],
    states: ['Gujarat'],
    subBranches: [
      { code: 'AHM-SAT', name: 'Satellite', pinCodes: ['380015'] },
      { code: 'AHM-NVR', name: 'Navrangpura', pinCodes: ['380009'] },
    ],
  },
  {
    code: 'JAI',
    name: 'Jaipur',
    cities: ['Jaipur'],
    states: ['Rajasthan'],
    subBranches: [
      { code: 'JAI-CSC', name: 'C-Scheme', pinCodes: ['302001'] },
      { code: 'JAI-MLV', name: 'Malviya Nagar', pinCodes: ['302017'] },
    ],
  },
  {
    code: 'CHD',
    name: 'Chandigarh Tricity',
    cities: ['Chandigarh', 'Mohali', 'Panchkula'],
    states: ['Chandigarh', 'Punjab', 'Haryana'],
    subBranches: [
      { code: 'CHD-S17', name: 'Sector 17', pinCodes: ['160017'] },
      { code: 'CHD-MOH', name: 'Mohali', pinCodes: ['160055'] },
    ],
  },
  {
    code: 'LKO',
    name: 'Lucknow',
    cities: ['Lucknow'],
    states: ['Uttar Pradesh'],
    subBranches: [
      { code: 'LKO-GMT', name: 'Gomti Nagar', pinCodes: ['226010'] },
      { code: 'LKO-HZG', name: 'Hazratganj', pinCodes: ['226001'] },
    ],
  },
  {
    code: 'IND',
    name: 'Indore',
    cities: ['Indore'],
    states: ['Madhya Pradesh'],
    subBranches: [
      { code: 'IND-VJN', name: 'Vijay Nagar', pinCodes: ['452010'] },
      { code: 'IND-RJW', name: 'Rajwada', pinCodes: ['452007'] },
    ],
  },
];
