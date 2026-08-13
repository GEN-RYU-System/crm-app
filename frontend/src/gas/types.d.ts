interface GoogleScriptRunFailure {
  message?: string;
  name?: string;
  stack?: string;
}

interface GoogleScriptRun {
  withSuccessHandler(handler: (value: unknown) => void): GoogleScriptRun;
  withFailureHandler(handler: (error: GoogleScriptRunFailure) => void): GoogleScriptRun;
  getDashboardKPIs(): void;
}

interface Window {
  google?: {
    script?: {
      run: GoogleScriptRun;
    };
  };
}
