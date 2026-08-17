interface GoogleScriptRunFailure {
  message?: string;
  name?: string;
  stack?: string;
}

interface GoogleScriptRun {
  withSuccessHandler(handler: (value: unknown) => void): GoogleScriptRun;
  withFailureHandler(handler: (error: GoogleScriptRunFailure) => void): GoogleScriptRun;
  getDashboardKPIs(): void;
  getCurrentUser(): void;
  getLeadsByType(leadType: string): void;
  getLeadDetail(leadId: string): void;
  createLead(leadData: Record<string, string>): void;
  updateLead(sheetName: string, leadId: string, updateData: Record<string, string>): void;
  getCoreCustomersForFrontend(): void;
  getCoreCustomerForFrontend(customerId: string): void;
  getCoreStaffForFrontend(): void;
  getCoreStaffMemberForFrontend(staffId: string): void;
  loginWithPassword(staffId: string, password: string): void;
  logout(sessionId: string): void;
  getSessionUser(sessionId: string): void;
  changeOwnPasswordForFrontend(currentPassword: string, newPassword: string): void;
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
