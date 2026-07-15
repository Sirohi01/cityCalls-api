import { loadStatusEngineCache, assertValidTransition, getAllowedTransitions } from './statusEngine';
import { InvalidTransitionError, ForbiddenError } from './errors';
import { StatusTransitionModel } from '../modules/config/statusTransition.model';

jest.mock('../modules/config/statusTransition.model', () => ({
  StatusTransitionModel: { find: jest.fn() },
}));

const mockedFind = StatusTransitionModel.find as jest.Mock;

describe('statusEngine', () => {
  beforeEach(async () => {
    mockedFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { entityType: 'LEAD', fromStatus: 'NEW', toStatus: 'CONTACT_ATTEMPTED', allowedRoles: ['SALES_EXECUTIVE'] },
        { entityType: 'LEAD', fromStatus: 'CONTACT_ATTEMPTED', toStatus: 'CONNECTED', allowedRoles: ['SALES_EXECUTIVE'] },
        { entityType: 'LEAD', fromStatus: 'CONTACT_ATTEMPTED', toStatus: 'NOT_INTERESTED', allowedRoles: ['SALES_EXECUTIVE', 'ADMIN'] },
      ]),
    });
    await loadStatusEngineCache();
  });

  it('allows a transition for a role explicitly permitted', () => {
    expect(() => assertValidTransition('LEAD', 'NEW', 'CONTACT_ATTEMPTED', 'SALES_EXECUTIVE')).not.toThrow();
  });

  it('rejects a transition that is not in the allowed set at all', () => {
    expect(() => assertValidTransition('LEAD', 'NEW', 'CONVERTED', 'SALES_EXECUTIVE')).toThrow(InvalidTransitionError);
  });

  it('rejects a transition attempted by a role not permitted for it, even though the pair exists', () => {
    expect(() => assertValidTransition('LEAD', 'CONTACT_ATTEMPTED', 'CONNECTED', 'MARKETING_EXECUTIVE')).toThrow(
      ForbiddenError
    );
  });

  it('lists every allowed destination status for a given source status', () => {
    const allowed = getAllowedTransitions('LEAD', 'CONTACT_ATTEMPTED');
    expect(allowed.sort()).toEqual(['CONNECTED', 'NOT_INTERESTED']);
  });

  it('returns an empty list for a status with no configured transitions', () => {
    expect(getAllowedTransitions('LEAD', 'CONVERTED')).toEqual([]);
  });
});
