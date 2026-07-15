import { EmployeeModel } from '../modules/employees/employees.model';
import { VendorModel } from '../modules/vendors/vendors.model';
import { ServiceModel } from '../modules/catalog/catalog.model';
import { ServiceRequestModel, AssigneeType } from '../modules/service-requests/serviceRequests.model';

export interface AssignmentCandidate {
  assigneeType: AssigneeType;
  assigneeId: string;
  name: string;
  score: number;
  scoreBreakdown: { skillMatch: boolean; coverageMatch: boolean; activeWorkload: number };
}

const ACTIVE_STATUSES = [
  'ASSIGNED_TO_EMPLOYEE',
  'ASSIGNED_TO_VENDOR',
  'OUTSOURCED',
  'ACCEPTED',
  'APPOINTMENT_SCHEDULED',
  'RESCHEDULED',
  'TECHNICIAN_EN_ROUTE',
  'TECHNICIAN_ARRIVED',
  'INSPECTION_STARTED',
  'INSPECTION_COMPLETED',
  'ESTIMATE_PENDING',
  'ESTIMATE_SHARED',
  'AWAITING_CUSTOMER_APPROVAL',
  'ESTIMATE_APPROVED',
  'PARTS_PENDING',
  'WORK_STARTED',
  'WORK_IN_PROGRESS',
  'ON_HOLD',
];

// Produces a ranked candidate list — never auto-commits an assignment (per
// docs/manish/06-workflow-engine-plan.md §2), the caller always has the final say
// via POST /service-requests/{id}/assign. Weights are intentionally simple for v1:
// skill/coverage are hard gates, workload is the primary ranking signal. Performance-
// based ranking is deferred until Employee/Vendor performance metrics are actually
// computed (nightly job, not built yet — see docs/manish/05 §Vendors).
export async function rankAssignmentCandidates(serviceRequestId: string): Promise<AssignmentCandidate[]> {
  const sr = await ServiceRequestModel.findById(serviceRequestId);
  if (!sr) return [];

  const service = await ServiceModel.findById(sr.serviceId);
  const requiredSkills = service?.requiredSkills ?? [];
  const pinCode = sr.addressSnapshot.pinCode;

  const candidates: AssignmentCandidate[] = [];

  // Employees: same branch, active, skill overlap (or no required skills).
  if (sr.branchId) {
    const employeeFilter: Record<string, unknown> = { branchId: sr.branchId, active: true };
    if (requiredSkills.length > 0) employeeFilter.skills = { $in: requiredSkills };

    const employees = await EmployeeModel.find(employeeFilter).populate('userId', 'name');
    for (const emp of employees) {
      const activeWorkload = await ServiceRequestModel.countDocuments({
        assigneeType: 'EMPLOYEE',
        assigneeId: emp._id,
        status: { $in: ACTIVE_STATUSES },
      });
      const skillMatch = requiredSkills.length === 0 || requiredSkills.some((s) => emp.skills.includes(s));
      candidates.push({
        assigneeType: 'EMPLOYEE',
        assigneeId: emp._id.toString(),
        name: (emp.userId as unknown as { name?: string })?.name ?? 'Employee',
        score: scoreCandidate(skillMatch, true, activeWorkload, emp.dailyCapacity),
        scoreBreakdown: { skillMatch, coverageMatch: true, activeWorkload },
      });
    }
  }

  // Vendors: coverage includes the address pin code, offers this service (or has matching skills).
  const vendorFilter: Record<string, unknown> = {
    active: true,
    blacklisted: false,
    'serviceAreas.pinCodes': pinCode,
  };
  const vendors = await VendorModel.find(vendorFilter);
  for (const vendor of vendors) {
    const offersService = vendor.servicesOffered.some((s) => s.toString() === sr.serviceId.toString());
    const skillMatch = requiredSkills.length === 0 || requiredSkills.some((s) => vendor.skills.includes(s));
    if (!offersService && !skillMatch) continue;

    const activeWorkload = await ServiceRequestModel.countDocuments({
      assigneeType: 'VENDOR',
      assigneeId: vendor._id,
      status: { $in: ACTIVE_STATUSES },
    });
    candidates.push({
      assigneeType: 'VENDOR',
      assigneeId: vendor._id.toString(),
      name: vendor.companyName,
      score: scoreCandidate(offersService || skillMatch, true, activeWorkload, 10),
      scoreBreakdown: { skillMatch: offersService || skillMatch, coverageMatch: true, activeWorkload },
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreCandidate(skillMatch: boolean, coverageMatch: boolean, activeWorkload: number, capacity: number): number {
  if (!skillMatch || !coverageMatch) return 0;
  const utilizationPenalty = Math.min(activeWorkload / Math.max(capacity, 1), 1);
  return Math.round((1 - utilizationPenalty) * 100);
}
