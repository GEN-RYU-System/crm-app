/**
 * 国マスタ「国名（日本語）」列への日本語名書き込み（DEV 専用）
 *
 * seedCountryMasterJaNames('DRY_RUN') — 書き込まず、書き込み予定内容を出力
 * seedCountryMasterJaNames('APPLY')   — 実際に書き込む（DEV 環境のみ）
 * 引数なしでは実行できない（誤爆防止）
 *
 * 処理仕様:
 * - 見出し行から「国ID(ISO2)」と「国名（日本語）」をindexOfで特定
 * - 列位置の直書き禁止
 * - ISO2コードで行を照合（行番号での照合禁止）
 * - 「国名（日本語）」列以外には一切書き込まない
 * - 対応表に存在しないISO2はスキップして最後に報告
 *
 * 日本語名の出典: ISO 3166-1 日本語表記
 */

// ============================================================
// ISO2 → 日本語国名 対応表（250件）
// ============================================================
var COUNTRY_JA_NAMES = {
  'AF': 'アフガニスタン',
  'AX': 'オーランド諸島',
  'AL': 'アルバニア',
  'DZ': 'アルジェリア',
  'AS': 'アメリカ領サモア',
  'AD': 'アンドラ',
  'AO': 'アンゴラ',
  'AI': 'アンギラ',
  'AQ': '南極',
  'AG': 'アンティグア・バーブーダ',
  'AR': 'アルゼンチン',
  'AM': 'アルメニア',
  'AW': 'アルバ',
  'AU': 'オーストラリア',
  'AT': 'オーストリア',
  'AZ': 'アゼルバイジャン',
  'BS': 'バハマ',
  'BH': 'バーレーン',
  'BD': 'バングラデシュ',
  'BB': 'バルバドス',
  'BY': 'ベラルーシ',
  'BE': 'ベルギー',
  'BZ': 'ベリーズ',
  'BJ': 'ベナン',
  'BM': 'バミューダ',
  'BT': 'ブータン',
  'BO': 'ボリビア',
  'BQ': 'ボネール島',
  'BA': 'ボスニア・ヘルツェゴビナ',
  'BW': 'ボツワナ',
  'BV': 'ブーベ島',
  'BR': 'ブラジル',
  'IO': 'イギリス領インド洋地域',
  'BN': 'ブルネイ',
  'BG': 'ブルガリア',
  'BF': 'ブルキナファソ',
  'BI': 'ブルンジ',
  'CV': 'カーボベルデ',
  'KH': 'カンボジア',
  'CM': 'カメルーン',
  'CA': 'カナダ',
  'KY': 'ケイマン諸島',
  'CF': '中央アフリカ共和国',
  'TD': 'チャド',
  'CL': 'チリ',
  'CN': '中国',
  'CX': 'クリスマス島',
  'CC': 'ココス（キーリング）諸島',
  'CO': 'コロンビア',
  'KM': 'コモロ',
  'CG': 'コンゴ共和国',
  'CD': 'コンゴ民主共和国',
  'CK': 'クック諸島',
  'CR': 'コスタリカ',
  'CI': 'コートジボワール',
  'HR': 'クロアチア',
  'CU': 'キューバ',
  'CW': 'キュラソー',
  'CY': 'キプロス',
  'CZ': 'チェコ',
  'DK': 'デンマーク',
  'DJ': 'ジブチ',
  'DM': 'ドミニカ国',
  'DO': 'ドミニカ共和国',
  'EC': 'エクアドル',
  'EG': 'エジプト',
  'SV': 'エルサルバドル',
  'GQ': '赤道ギニア',
  'ER': 'エリトリア',
  'EE': 'エストニア',
  'SZ': 'エスワティニ',
  'ET': 'エチオピア',
  'FK': 'フォークランド諸島',
  'FO': 'フェロー諸島',
  'FJ': 'フィジー',
  'FI': 'フィンランド',
  'FR': 'フランス',
  'GF': 'フランス領ギアナ',
  'PF': 'フランス領ポリネシア',
  'TF': 'フランス領南方・南極地域',
  'GA': 'ガボン',
  'GM': 'ガンビア',
  'GE': 'ジョージア',
  'DE': 'ドイツ',
  'GH': 'ガーナ',
  'GI': 'ジブラルタル',
  'GR': 'ギリシャ',
  'GL': 'グリーンランド',
  'GD': 'グレナダ',
  'GP': 'グアドループ',
  'GU': 'グアム',
  'GT': 'グアテマラ',
  'GG': 'ガーンジー',
  'GN': 'ギニア',
  'GW': 'ギニアビサウ',
  'GY': 'ガイアナ',
  'HT': 'ハイチ',
  'HM': 'ハード島とマクドナルド諸島',
  'VA': 'バチカン市国',
  'HN': 'ホンジュラス',
  'HK': '香港',
  'HU': 'ハンガリー',
  'IS': 'アイスランド',
  'IN': 'インド',
  'ID': 'インドネシア',
  'IR': 'イラン',
  'IQ': 'イラク',
  'IE': 'アイルランド',
  'IM': 'マン島',
  'IL': 'イスラエル',
  'IT': 'イタリア',
  'JM': 'ジャマイカ',
  'JP': '日本',
  'JE': 'ジャージー',
  'JO': 'ヨルダン',
  'KZ': 'カザフスタン',
  'KE': 'ケニア',
  'KI': 'キリバス',
  'KP': '朝鮮民主主義人民共和国',
  'KR': '大韓民国',
  'XK': 'コソボ',
  'KW': 'クウェート',
  'KG': 'キルギス',
  'LA': 'ラオス',
  'LV': 'ラトビア',
  'LB': 'レバノン',
  'LS': 'レソト',
  'LR': 'リベリア',
  'LY': 'リビア',
  'LI': 'リヒテンシュタイン',
  'LT': 'リトアニア',
  'LU': 'ルクセンブルク',
  'MO': 'マカオ',
  'MG': 'マダガスカル',
  'MW': 'マラウイ',
  'MY': 'マレーシア',
  'MV': 'モルディブ',
  'ML': 'マリ',
  'MT': 'マルタ',
  'MH': 'マーシャル諸島',
  'MQ': 'マルティニーク',
  'MR': 'モーリタニア',
  'MU': 'モーリシャス',
  'YT': 'マヨット',
  'MX': 'メキシコ',
  'FM': 'ミクロネシア連邦',
  'MD': 'モルドバ',
  'MC': 'モナコ',
  'MN': 'モンゴル',
  'ME': 'モンテネグロ',
  'MS': 'モントセラト',
  'MA': 'モロッコ',
  'MZ': 'モザンビーク',
  'MM': 'ミャンマー',
  'NA': 'ナミビア',
  'NR': 'ナウル',
  'NP': 'ネパール',
  'NL': 'オランダ',
  'NC': 'ニューカレドニア',
  'NZ': 'ニュージーランド',
  'NI': 'ニカラグア',
  'NE': 'ニジェール',
  'NG': 'ナイジェリア',
  'NU': 'ニウエ',
  'NF': 'ノーフォーク島',
  'MK': '北マケドニア',
  'MP': '北マリアナ諸島',
  'NO': 'ノルウェー',
  'OM': 'オマーン',
  'PK': 'パキスタン',
  'PW': 'パラオ',
  'PS': 'パレスチナ',
  'PA': 'パナマ',
  'PG': 'パプアニューギニア',
  'PY': 'パラグアイ',
  'PE': 'ペルー',
  'PH': 'フィリピン',
  'PN': 'ピトケアン諸島',
  'PL': 'ポーランド',
  'PT': 'ポルトガル',
  'PR': 'プエルトリコ',
  'QA': 'カタール',
  'RE': 'レユニオン',
  'RO': 'ルーマニア',
  'RU': 'ロシア',
  'RW': 'ルワンダ',
  'BL': 'サン・バルテルミー島',
  'SH': 'セントヘレナ',
  'KN': 'セントクリストファー・ネイビス',
  'LC': 'セントルシア',
  'MF': 'サン・マルタン',
  'PM': 'サンピエール島・ミクロン島',
  'VC': 'セントビンセントおよびグレナディーン諸島',
  'WS': 'サモア',
  'SM': 'サンマリノ',
  'ST': 'サントメ・プリンシペ',
  'SA': 'サウジアラビア',
  'SN': 'セネガル',
  'RS': 'セルビア',
  'SC': 'セーシェル',
  'SL': 'シエラレオネ',
  'SG': 'シンガポール',
  'SX': 'シント・マールテン',
  'SK': 'スロバキア',
  'SI': 'スロベニア',
  'SB': 'ソロモン諸島',
  'SO': 'ソマリア',
  'ZA': '南アフリカ',
  'GS': 'サウスジョージア・サウスサンドウィッチ諸島',
  'SS': '南スーダン',
  'ES': 'スペイン',
  'LK': 'スリランカ',
  'SD': 'スーダン',
  'SR': 'スリナム',
  'SJ': 'スヴァールバル諸島およびヤンマイエン島',
  'SE': 'スウェーデン',
  'CH': 'スイス',
  'SY': 'シリア',
  'TW': '台湾',
  'TJ': 'タジキスタン',
  'TZ': 'タンザニア',
  'TH': 'タイ',
  'TL': '東ティモール',
  'TG': 'トーゴ',
  'TK': 'トケラウ',
  'TO': 'トンガ',
  'TT': 'トリニダード・トバゴ',
  'TN': 'チュニジア',
  'TR': 'トルコ',
  'TM': 'トルクメニスタン',
  'TC': 'タークス・カイコス諸島',
  'TV': 'ツバル',
  'UG': 'ウガンダ',
  'UA': 'ウクライナ',
  'AE': 'アラブ首長国連邦',
  'GB': 'イギリス',
  'US': 'アメリカ合衆国',
  'UM': '合衆国領有小離島',
  'UY': 'ウルグアイ',
  'UZ': 'ウズベキスタン',
  'VU': 'バヌアツ',
  'VE': 'ベネズエラ',
  'VN': 'ベトナム',
  'VG': 'イギリス領ヴァージン諸島',
  'VI': 'アメリカ領ヴァージン諸島',
  'WF': 'ウォリス・フツナ',
  'EH': '西サハラ',
  'YE': 'イエメン',
  'ZM': 'ザンビア',
  'ZW': 'ジンバブエ'
};

// ============================================================
// seedCountryMasterJaNames(mode)
// ============================================================

/**
 * 国マスタの「国名（日本語）」列に日本語名を書き込む。
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {string} 実行ログ
 */
function seedCountryMasterJaNames(mode) {
  var modeNorm = String(mode || '').trim().toUpperCase();
  if (modeNorm !== 'DRY_RUN' && modeNorm !== 'APPLY') {
    var usage = [
      'ERROR: mode を指定してください。',
      '  seedCountryMasterJaNames("DRY_RUN") — 書き込みなし・確認のみ',
      '  seedCountryMasterJaNames("APPLY")   — 実際に書き込む（DEV 環境のみ）'
    ].join('\n');
    Logger.log(usage);
    return usage;
  }

  // DEV 環境ガード
  if (modeNorm === 'APPLY' && getEnvironment() !== 'development') {
    var envErr = 'ERROR: seedCountryMasterJaNames("APPLY") は development 環境でのみ実行できます。';
    Logger.log(envErr);
    return envErr;
  }

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('国マスタ');
  if (!sh) {
    var noSheet = 'ERROR: 国マスタシートが見つかりません。';
    Logger.log(noSheet);
    return noSheet;
  }

  var data = sh.getDataRange().getValues();
  if (data.length < 2) {
    var empty = 'ERROR: 国マスタにデータ行がありません（ヘッダーのみ）。';
    Logger.log(empty);
    return empty;
  }

  var headers = data[0].map(String);
  var isoIdx  = headers.indexOf('国ID(ISO2)');
  if (isoIdx < 0) isoIdx = headers.indexOf('country_code');
  var jaIdx   = headers.indexOf('国名（日本語）');
  if (jaIdx < 0) jaIdx = headers.indexOf('name_ja');

  if (isoIdx < 0) {
    var noIso = 'ERROR: 国マスタに「国ID(ISO2)」列が見つかりません。ヘッダー: ' + JSON.stringify(headers);
    Logger.log(noIso);
    return noIso;
  }
  if (jaIdx < 0) {
    var noJa = 'ERROR: 国マスタに「国名（日本語）」列が見つかりません。ヘッダー: ' + JSON.stringify(headers);
    Logger.log(noJa);
    return noJa;
  }

  // 書き込み予定・スキップ一覧を収集
  var writeTargets  = [];  // { sheetRow, iso2, jaName }
  var skipIso2List  = [];  // 対応表にない ISO2

  for (var i = 1; i < data.length; i++) {
    var iso2   = String(data[i][isoIdx] || '').trim();
    if (!iso2) continue;

    var jaName = COUNTRY_JA_NAMES[iso2];
    if (!jaName) {
      skipIso2List.push(iso2);
      continue;
    }
    writeTargets.push({ sheetRow: i + 1, iso2: iso2, jaName: jaName });
  }

  var lines = [
    '=== seedCountryMasterJaNames(' + modeNorm + ') ===',
    '列位置: 国ID(ISO2)=col' + (isoIdx + 1) + '、国名（日本語）=col' + (jaIdx + 1),
    '書き込み予定: ' + writeTargets.length + '件',
    'スキップ:     ' + skipIso2List.length + '件'
  ];

  if (skipIso2List.length > 0) {
    lines.push('スキップISO2: ' + skipIso2List.join(', '));
  }

  if (modeNorm === 'DRY_RUN') {
    lines.push('');
    lines.push('--- DRY RUN 完了（書き込みなし）---');
    var dryOut = lines.join('\n');
    Logger.log(dryOut);
    return dryOut;
  }

  // APPLY
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var writtenCount = 0;
    writeTargets.forEach(function(t) {
      sh.getRange(t.sheetRow, jaIdx + 1).setValue(t.jaName);
      writtenCount++;
    });

    // 書き込み後に再読み取りして検証
    var afterData    = sh.getDataRange().getValues();
    var afterHeaders = afterData[0].map(String);
    var afterJaIdx   = afterHeaders.indexOf('国名（日本語）');
    var emptyAfter   = 0;
    var isoLookup    = {};
    writeTargets.forEach(function(t) { isoLookup[t.iso2] = t.jaName; });

    for (var j = 1; j < afterData.length; j++) {
      var aIso = String(afterData[j][isoIdx] || '').trim();
      if (!aIso || !isoLookup[aIso]) continue;
      if (!String(afterData[j][afterJaIdx] || '').trim()) emptyAfter++;
    }

    lines.push('');
    lines.push('[書き込み結果]');
    lines.push('書き込み完了: ' + writtenCount + '件');
    lines.push('[検証]');
    lines.push('再読み取り後の空欄残件数: ' + emptyAfter + '件');
    lines.push(emptyAfter === 0 ? '✅ 全件書き込み確認済み' : '❌ ' + emptyAfter + '件が未書き込みです');
    lines.push('');
    lines.push('--- APPLY 完了 ---');

    var applyOut = lines.join('\n');
    Logger.log(applyOut);
    return applyOut;
  } finally {
    lock.releaseLock();
  }
}
