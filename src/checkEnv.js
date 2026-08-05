function checkCurrentEnvironment() {
  const env = getEnvironment();
  Logger.log('現在の環境: ' + env);
  
  const props = PropertiesService.getScriptProperties();
  const devId = props.getProperty('DEV_SPREADSHEET_ID');
  
  Logger.log('DEV_SPREADSHEET_ID: ' + (devId || '(未設定)'));
  Logger.log('PRODUCTION_SPREADSHEET_ID: ' + PRODUCTION_IDS.SPREADSHEET_ID);
  
  return {
    environment: env,
    devSpreadsheetId: devId,
    prodSpreadsheetId: PRODUCTION_IDS.SPREADSHEET_ID
  };
}
