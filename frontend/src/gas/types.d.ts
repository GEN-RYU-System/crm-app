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
  getLeadsByType(sessionId: string | null, leadType?: string, forceRefresh?: boolean): void;
  getLeadDetail(sessionId: string | null, leadId: string): void;
  createLead(sessionId: string | null, leadData: Record<string, string>): void;
  updateLead(sessionId: string | null, sheetName: string, leadId: string, updateData: Record<string, string>): void;
  getCoreCustomersForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getCoreCustomerForFrontend(sessionId: string | null, customerId: string): void;
  getCoreStaffForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getCoreStaffMemberForFrontend(sessionId: string | null, staffId: string): void;
  loginWithPassword(staffId: string, password: string): void;
  logout(sessionId: string): void;
  getSessionUser(sessionId: string): void;
  changeOwnPasswordForFrontend(sessionId: string | null, currentPassword: string, newPassword: string): void;
  getSharedInventoryForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getCoreQuotesForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getCoreQuoteForFrontend(sessionId: string | null, quoteId: string): void;
  getCoreOrdersForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getCoreCurrenciesForFrontend(sessionId: string | null): void;
  getLeadOptionsForFrontend(sessionId: string | null): void;
  createCoreQuoteForFrontend(sessionId: string | null, quoteData: unknown, isDraft: boolean): void;
  updateCoreQuoteForFrontend(sessionId: string | null, quoteId: string, quoteData: unknown, isDraft: boolean): void;
  getInventoryProductOptions(sessionId: string | null): void;
  getInventoryConditions(sessionId: string | null, productId: string): void;
  createCoreOrderForFrontend(sessionId: string | null, payload: unknown): void;
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
