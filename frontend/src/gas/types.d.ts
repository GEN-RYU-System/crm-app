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
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
