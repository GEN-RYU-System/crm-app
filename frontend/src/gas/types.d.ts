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
  getCoreAllCustomerAggregatesForFrontend(sessionId: string | null): void;
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
  getCoreOrderDetailForFrontend(sessionId: string | null, orderId: string): void;
  getCoreOrderStatusOptionsForFrontend(sessionId: string | null): void;
  getCoreCurrenciesForFrontend(sessionId: string | null): void;
  getLeadOptionsForFrontend(sessionId: string | null): void;
  createCoreQuoteForFrontend(sessionId: string | null, quoteData: unknown, isDraft: boolean): void;
  updateCoreQuoteForFrontend(sessionId: string | null, quoteId: string, quoteData: unknown, isDraft: boolean): void;
  getInventoryProductOptions(sessionId: string | null): void;
  getInventoryConditions(sessionId: string | null, productId: string): void;
  createCoreOrderForFrontend(sessionId: string | null, payload: unknown): void;
  updateCoreOrderForFrontend(sessionId: string | null, orderId: string, orderData: unknown): void;
  confirmCoreOrderPaymentForFrontend(sessionId: string | null, orderId: string): void;
  upsertCorePurchaseForFrontend(sessionId: string | null, payload: unknown): void;
  getCorePurchaseStatusOptionsForFrontend(sessionId: string | null): void;
  checkSyncSignals(sessionId: string | null): void;
  getLeadFormOptions(sessionId: string | null): void;
  getCoreIssuerForFrontend(sessionId: string | null): void;
  updateCoreIssuerForFrontend(sessionId: string | null, issuerData: unknown): void;
  getInboxConversationsForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getInboxConversationDetailForFrontend(sessionId: string | null, leadId: string): void;
  getInboxBulkInitialLoad(sessionId: string | null, maxConversations: number, maxMessages: number): void;
  getInboxMoreMessages(sessionId: string | null, conversationId: string, offsetIndex: number, maxMessages: number): void;
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
