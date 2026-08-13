function listScriptPropertyKeysOnly() {
  return Object.keys(
    PropertiesService.getScriptProperties().getProperties()
  ).sort();
}
