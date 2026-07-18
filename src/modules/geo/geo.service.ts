import { BranchModel, SubBranchModel } from '../organization/organization.model';
import { lookupPincode } from '../../lib/pincodeAdapter';

export interface AreaCheckResult {
  serviceable: boolean;
  branchId?: string;
  branchName?: string;
  subBranchId?: string;
  subBranchName?: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
}
export async function checkArea(pinCode: string): Promise<AreaCheckResult> {
  const subBranch = await SubBranchModel.findOne({ active: true, 'coverage.pinCodes': pinCode });
  if (subBranch) {
    const branch = await BranchModel.findById(subBranch.branchId);
    return {
      serviceable: true,
      branchId: branch?._id.toString(),
      branchName: branch?.name,
      subBranchId: subBranch._id.toString(),
      subBranchName: subBranch.name,
      state: branch?.coverage?.states?.[0],
      country: 'India',
    };
  }

  const branch = await BranchModel.findOne({ active: true, 'coverage.pinCodes': pinCode });
  if (branch) {
    return {
      serviceable: true,
      branchId: branch._id.toString(),
      branchName: branch.name,
      state: branch.coverage?.states?.[0],
      country: 'India',
    };
  }

  const postal = await lookupPincode(pinCode);
  if (!postal) {
    return { serviceable: false };
  }

  return {
    serviceable: false,
    city: postal.city,
    state: postal.state,
    country: postal.country,
    district: postal.district,
  };
}
