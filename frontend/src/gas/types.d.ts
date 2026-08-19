interface GoogleScriptRunFailure {
  message?: string;
  name?: string;
  stack?: string;
}

interface GoogleScriptRun {
  withSuccessHandler(handler: (value: unknown) => void): GoogleScriptRun;
  withFailureHandler(handler: (error: GoogleScriptRunFailure) => void): GoogleScriptRun;
  getDashboardKPIs(sessionId: string | null): void;
  getCurrentUser(sessionId: string | null): void;
  getLeadsByType(sessionId: string | null, leadType?: string): void;
  getLeadDetail(sessionId: string | null, leadId: string): void;
  createLead(sessionId: string | null, leadData: Record<string, string>): void;
  updateLead(sessionId: string | null, sheetName: string, leadId: string, updateData: Record<string, string>): void;
  getCoreCustomersForFrontend(sessionId: string | null): void;
  getCoreCustomerForFrontend(sessionId: string | null, customerId: string): void;
  getCoreStaffForFrontend(sessionId: string | null): void;
  getCoreStaffMemberForFrontend(sessionId: string | null, staffId: string): void;
  loginWithPassword(staffId: string, password: string): void;
  logout(sessionId: string): void;
  getSessionUser(sessionId: string): void;
  changeOwnPasswordForFrontend(sessionId: string | null, currentPassword: string, newPassword: string): void;
  getSharedInventoryForFrontend(sessionId: string | null): void;
  getCoreQuotesForFrontend(sessionId: string | null): void;
  getCoreQuoteForFrontend(sessionId: string | null, quoteId: string): void;
  getCoreOrdersForFrontend(sessionId: string | null): void;
  getCoreCurrenciesForFrontend(sessionId: string | null): void;
  getLeadOptionsForFrontend(sessionId: string | null): void;
  createCoreQuoteForFrontend(sessionId: string | null, quoteData: unknown): void;
  updateCoreQuoteForFrontend(sessionId: string | null, quoteId: string, quoteData: unknown): void;
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
