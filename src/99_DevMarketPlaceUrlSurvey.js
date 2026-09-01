
function surveyLeadSourceUrls() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  // ── 1. ヘッダー全件出力 ──────────────────────────────────────────────────
  Logger.log('=== リード管理 ヘッダー一覧 (' + lastCol + '列) ===');
  headers.forEach(function(h, i) {
    Logger.log('  col' + (i + 1) + ': ' + h);
  });
  Logger.log('');

  // URL系列の列を特定（"URL" を含む列をすべて対象）
  var urlColIndices = [];
  headers.forEach(function(h, i) {
    if (h.indexOf('URL') !== -1 || h.indexOf('url') !== -1) {
      urlColIndices.push({ colIdx: i, name: h });
    }
  });
  Logger.log('URL系列列: ' + urlColIndices.map(function(c) { return 'col' + (c.colIdx + 1) + '(' + c.name + ')'; }).join(', '));
  Logger.log('');

  // 流入経路列のインデックス
  var sourceIdx = headers.indexOf('lead_source');
  if (sourceIdx === -1) throw new Error('流入経路列が見つかりません');

  // ── データ読み込み ────────────────────────────────────────────────────────
  if (lastRow < 2) throw new Error('データ行がありません');

  // 必要列のみ読み込む（流入経路 + URL列すべて）
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var targetSources = ['Market Place', 'Facebook', 'Card Market'];

  // ── ドメイン抽出ヘルパー ─────────────────────────────────────────────────
  function extractDomain(url) {
    if (!url) return null;
    var s = String(url).trim();
    if (!s) return null;
    // http(s):// を除いてホスト部分だけ取る
    var m = s.match(/^https?:\/\/([^\/\?#]+)/i);
    if (m) {
      // www. プレフィックスは除去して2階層まで
      var host = m[1].replace(/^www\./i, '');
      return host;
    }
    // URL形式でない場合はそのまま返す
    return '(非URL): ' + s.substring(0, 60);
  }

  // ── 2 & 3. 対象流入経路ごとに集計 ────────────────────────────────────────
  var results = {};
  targetSources.forEach(function(src) { results[src] = {}; });

  // URL列ごとに集計オブジェクトを用意
  // results[src][urlColName] = { domainCounts: {}, blankCount: 0, nonUrlRows: [] }

  targetSources.forEach(function(src) {
    urlColIndices.forEach(function(col) {
      results[src][col.name] = { domainCounts: {}, blankCount: 0, nonUrlList: [] };
    });
  });

  allData.forEach(function(row, ri) {
    var sourceVal = String(row[sourceIdx] || '').trim();
    if (targetSources.indexOf(sourceVal) === -1) return;

    urlColIndices.forEach(function(col) {
      var cellVal = String(row[col.colIdx] || '').trim();
      var bucket  = results[sourceVal][col.name];

      if (!cellVal) {
        bucket.blankCount++;
        return;
      }
      var domain = extractDomain(cellVal);
      if (!domain) {
        bucket.blankCount++;
        return;
      }
      if (domain.indexOf('(非URL)') === 0) {
        bucket.nonUrlList.push({ rowNum: ri + 2, value: cellVal.substring(0, 80) });
      } else {
        bucket.domainCounts[domain] = (bucket.domainCounts[domain] || 0) + 1;
      }
    });
  });

  // ── 出力 ─────────────────────────────────────────────────────────────────
  targetSources.forEach(function(src) {
    // 該当行数を数える
    var rowCount = allData.filter(function(r) { return String(r[sourceIdx] || '').trim() === src; }).length;
    Logger.log('=== 流入経路: ' + src + ' (' + rowCount + '件) ===');

    urlColIndices.forEach(function(col) {
      var bucket = results[src][col.name];
      var domains = Object.keys(bucket.domainCounts).sort(function(a, b) {
        return bucket.domainCounts[b] - bucket.domainCounts[a];
      });

      Logger.log('  [' + col.name + ']');
      if (domains.length === 0 && bucket.nonUrlList.length === 0) {
        Logger.log('    URL値あり: 0件');
      } else {
        domains.forEach(function(d) {
          Logger.log('    ' + d + ': ' + bucket.domainCounts[d] + '件');
        });
        if (bucket.nonUrlList.length > 0) {
          Logger.log('    (非URL形式): ' + bucket.nonUrlList.length + '件');
          bucket.nonUrlList.slice(0, 10).forEach(function(item) {
            Logger.log('      行' + item.rowNum + ': ' + item.value);
          });
          if (bucket.nonUrlList.length > 10) {
            Logger.log('      ... 他' + (bucket.nonUrlList.length - 10) + '件');
          }
        }
      }
      Logger.log('    空欄: ' + bucket.blankCount + '件');
    });
    Logger.log('');
  });

  Logger.log('=== 調査完了（書き込みなし）===');

  // clasp run は深いネストを [Object] で切るため、フラット文字列配列で返す
  var lines = [];

  // ヘッダー一覧
  lines.push('=== ヘッダー一覧 (' + lastCol + '列) ===');
  headers.forEach(function(h, i) { lines.push('col' + (i + 1) + ': ' + h); });
  lines.push('URL系列列: ' + urlColIndices.map(function(c) { return 'col' + (c.colIdx + 1) + '(' + c.name + ')'; }).join(', '));

  // 各流入経路
  targetSources.forEach(function(src) {
    var rowCount = allData.filter(function(r) { return String(r[sourceIdx] || '').trim() === src; }).length;
    lines.push('');
    lines.push('=== 流入経路: ' + src + ' (' + rowCount + '件) ===');

    urlColIndices.forEach(function(col) {
      var bucket = results[src][col.name];
      var domains = Object.keys(bucket.domainCounts).sort(function(a, b) {
        return bucket.domainCounts[b] - bucket.domainCounts[a];
      });
      lines.push('[' + col.name + ']');
      if (domains.length === 0 && bucket.nonUrlList.length === 0) {
        lines.push('  URL値あり: 0件');
      } else {
        domains.forEach(function(d) { lines.push('  ' + d + ': ' + bucket.domainCounts[d] + '件'); });
        if (bucket.nonUrlList.length > 0) {
          lines.push('  (非URL形式): ' + bucket.nonUrlList.length + '件');
          bucket.nonUrlList.slice(0, 20).forEach(function(item) {
            lines.push('    行' + item.rowNum + ': ' + item.value);
          });
          if (bucket.nonUrlList.length > 20) {
            lines.push('    ... 他' + (bucket.nonUrlList.length - 20) + '件');
          }
        }
      }
      lines.push('  空欄: ' + bucket.blankCount + '件');
    });
  });

  lines.push('');
  lines.push('=== 調査完了（書き込みなし）===');

  return lines;
}
