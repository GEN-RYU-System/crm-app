import { getCoreStaff, getCoreStaffMember } from '../../gas/client';
import type { StaffRepository } from './contracts';

export const staffGasRepository: StaffRepository = {
  listStaff: getCoreStaff,
  getStaff: getCoreStaffMember
};
