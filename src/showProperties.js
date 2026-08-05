function showAllProperties() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  Logger.log('=== Script Properties ===');
  for (const key in allProps) {
    Logger.log(key + ': ' + allProps[key]);
  }
  
  return allProps;
}
