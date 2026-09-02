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
  getLeadsBatchForFrontend(sessionId: string | null, forceRefresh: boolean): void;
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
  getCoreOrdersBatchForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getCoreOrderDetailForFrontend(sessionId: string | null, orderId: string): void;
  getCoreOrderStatusOptionsForFrontend(sessionId: string | null): void;
  getCoreCurrenciesForFrontend(sessionId: string | null): void;
  getLeadOptionsForFrontend(sessionId: string | null): void;
  createCoreQuoteForFrontend(sessionId: string | null, quoteData: unknown, isDraft: boolean): void;
  updateCoreQuoteForFrontend(sessionId: string | null, quoteId: string, quoteData: unknown, isDraft: boolean): void;
  getInventoryBatchForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getInventoryProductOptions(sessionId: string | null): void;
  getInventoryConditions(sessionId: string | null, productId: string): void;
  createCoreOrderForFrontend(sessionId: string | null, payload: unknown): void;
  updateCoreOrderForFrontend(sessionId: string | null, orderId: string, orderData: unknown): void;
  confirmCoreOrderPaymentForFrontend(sessionId: string | null, orderId: string): void;
  upsertCorePurchaseForFrontend(sessionId: string | null, payload: unknown): void;
  getCorePurchaseStatusOptionsForFrontend(sessionId: string | null): void;
  upsertCoreShipmentForFrontend(sessionId: string | null, payload: unknown): void;
  advanceCoreShipmentStageForFrontend(_s: string | null, _orderId: string): void;
  estimateShippingFeeForFrontend(_s: string | null, _payload: unknown): void;
  estimateShippingFeeForQuoteForFrontend(_s: string | null, _quoteId: string): void;
  estimateShippingFeeForOrderForFrontend(_s: string | null, _orderId: string): void;
  estimateShippingFeeForLinesForFrontend(_s: string | null, _payload: unknown): void;
  uploadCoreShipmentFileForFrontend(_s: string | null, _payload: unknown): void;
  checkSyncSignals(sessionId: string | null): void;
  getLeadFormOptions(sessionId: string | null): void;
  getCoreIssuerForFrontend(sessionId: string | null): void;
  updateCoreIssuerForFrontend(sessionId: string | null, issuerData: unknown): void;
  getInboxConversationsForFrontend(sessionId: string | null, forceRefresh: boolean): void;
  getInboxConversationDetailForFrontend(sessionId: string | null, leadId: string): void;
  getInboxBulkInitialLoad(sessionId: string | null, maxConversations: number, maxMessages: number): void;
  getInboxMoreMessages(sessionId: string | null, conversationId: string, offsetIndex: number, maxMessages: number): void;
  pingForLatencyCheck(): void;
  getCoreSizesForFrontend(sessionId: string | null): void;
  getCoreWeightsForFrontend(sessionId: string | null): void;
  getCorePackagesForFrontend(sessionId: string | null): void;
  getCorePackageUnitOptionsForFrontend(): void;
  upsertCoreSizeForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCoreWeightForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCorePackageForFrontend(sessionId: string | null, payload: unknown): void;
  getCoreOwnCategoriesForFrontend(sessionId: string | null): void;
  getCoreOwnWorksForFrontend(sessionId: string | null): void;
  getCoreOwnManufacturersForFrontend(sessionId: string | null): void;
  upsertCoreOwnCategoryForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCoreOwnWorkForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCoreOwnManufacturerForFrontend(sessionId: string | null, payload: unknown): void;
  getCoreSharedProductsForFrontend(sessionId: string | null): void;
  getCoreProductPackagesForFrontend(sessionId: string | null): void;
  upsertCoreProductPackageForFrontend(sessionId: string | null, payload: unknown): void;
  getCoreOwnProductsForFrontend(sessionId: string | null): void;
  upsertCoreOwnProductWithPackageForFrontend(sessionId: string | null, payload: unknown): void;
  getCoreItemsForFrontend(sessionId: string | null): void;
  getCoreHtsCodesForFrontend(sessionId: string | null): void;
  getCoreMaterialsForFrontend(sessionId: string | null): void;
  upsertCoreItemForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCoreHtsCodeForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCoreMaterialForFrontend(sessionId: string | null, payload: unknown): void;
  getCoreCountriesForFrontend(sessionId: string | null): void;
  getCoreShipmentLinesForFrontend(sessionId: string | null, shipmentId: string): void;
  getProductExportDefaultsForFrontend(sessionId: string | null, payload: unknown): void;
  upsertCoreShipmentLineForFrontend(sessionId: string | null, payload: unknown): void;
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
