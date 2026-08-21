export type StaffSummaryDto = {
  staffId: string;
  fullNameJa: string;
  role: string;
  status: string;
  email: string;
  discordId: string;
};

export type StaffProfileDto = {
  staffId: string;
  lastNameJa: string;
  firstNameJa: string;
  fullNameJa: string;
  lastNameKana: string;
  firstNameKana: string;
  lastNameEn: string;
  firstNameEn: string;
  email: string;
  discordId: string;
  role: string;
  status: string;
};

export type StaffRepository = {
  listStaff: (forceRefresh?: boolean) => Promise<readonly StaffSummaryDto[]>;
  getStaff: (staffId: string) => Promise<StaffProfileDto | null>;
};
