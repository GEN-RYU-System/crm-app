/**
 * デプロイ情報の記録・照合
 *
 * deploy-dev.yml の "Push to DEV" 直後に recordDeployedSha(sha) を呼び出し、
 * どの commit が DEV 環境に配布されているかを スクリプトプロパティに記録する。
 *
 * 確認方法:
 *   clasp run getDeployedSha
 *   git log --oneline origin/develop -1
 *   → SHA が一致すれば正しく配布されている
 */

/**
 * デプロイ済みコミット SHA をスクリプトプロパティに記録する。
 *
 * @param {string} sha - コミット SHA（空文字・null は例外）
 * @returns {{ sha: string, deployedAt: string }}
 */
function recordDeployedSha(sha) {
  if (!sha) throw new Error('recordDeployedSha: sha is required');

  var deployedAt = new Date().toISOString();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('DEPLOYED_SHA', sha);
  props.setProperty('DEPLOYED_AT', deployedAt);

  Logger.log('[recordDeployedSha] sha=' + sha + ' deployedAt=' + deployedAt);
  return { sha: sha, deployedAt: deployedAt };
}

/**
 * デプロイ済みコミット SHA と記録時刻を返す。
 *
 * @returns {{ sha: string|null, deployedAt: string|null }}
 */
function getDeployedSha() {
  var props = PropertiesService.getScriptProperties();
  return {
    sha: props.getProperty('DEPLOYED_SHA'),
    deployedAt: props.getProperty('DEPLOYED_AT')
  };
}
