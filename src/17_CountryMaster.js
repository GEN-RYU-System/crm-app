/**
 * 国マスタ管理・電話番号正規化・住所長さ監査
 * PR16: country-master
 */

// ============================================================
// 国データ定義 [ISO2, 国名（表示）, 国番号, トランク0除去, 有効]
// トランク0除去=FALSE: 国際ダイヤルでもトランク0を保持（イタリア等）
// ============================================================
const COUNTRY_DATA = [
  ['AF', 'アフガニスタン',                       '93',   'TRUE',  'TRUE'],
  ['AX', 'オーランド諸島',                       '358',  'TRUE',  'TRUE'],
  ['AL', 'アルバニア',                           '355',  'TRUE',  'TRUE'],
  ['DZ', 'アルジェリア',                         '213',  'TRUE',  'TRUE'],
  ['AS', 'アメリカ領サモア',                     '1684', 'TRUE',  'TRUE'],
  ['AD', 'アンドラ',                             '376',  'TRUE',  'TRUE'],
  ['AO', 'アンゴラ',                             '244',  'TRUE',  'TRUE'],
  ['AI', 'アンギラ',                             '1264', 'TRUE',  'TRUE'],
  ['AQ', '南極',                                 '672',  'TRUE',  'TRUE'],
  ['AG', 'アンティグア・バーブーダ',             '1268', 'TRUE',  'TRUE'],
  ['AR', 'アルゼンチン',                         '54',   'TRUE',  'TRUE'],
  ['AM', 'アルメニア',                           '374',  'TRUE',  'TRUE'],
  ['AW', 'アルバ',                               '297',  'TRUE',  'TRUE'],
  ['AU', 'オーストラリア',                       '61',   'TRUE',  'TRUE'],
  ['AT', 'オーストリア',                         '43',   'TRUE',  'TRUE'],
  ['AZ', 'アゼルバイジャン',                     '994',  'TRUE',  'TRUE'],
  ['BS', 'バハマ',                               '1242', 'TRUE',  'TRUE'],
  ['BH', 'バーレーン',                           '973',  'TRUE',  'TRUE'],
  ['BD', 'バングラデシュ',                       '880',  'TRUE',  'TRUE'],
  ['BB', 'バルバドス',                           '1246', 'TRUE',  'TRUE'],
  ['BY', 'ベラルーシ',                           '375',  'TRUE',  'TRUE'],
  ['BE', 'ベルギー',                             '32',   'TRUE',  'TRUE'],
  ['BZ', 'ベリーズ',                             '501',  'TRUE',  'TRUE'],
  ['BJ', 'ベナン',                               '229',  'TRUE',  'TRUE'],
  ['BM', 'バミューダ',                           '1441', 'TRUE',  'TRUE'],
  ['BT', 'ブータン',                             '975',  'TRUE',  'TRUE'],
  ['BO', 'ボリビア',                             '591',  'TRUE',  'TRUE'],
  ['BQ', 'ボネール',                             '599',  'TRUE',  'TRUE'],
  ['BA', 'ボスニア・ヘルツェゴビナ',             '387',  'TRUE',  'TRUE'],
  ['BW', 'ボツワナ',                             '267',  'TRUE',  'TRUE'],
  ['BV', 'ブーベ島',                             '47',   'TRUE',  'TRUE'],
  ['BR', 'ブラジル',                             '55',   'TRUE',  'TRUE'],
  ['IO', 'イギリス領インド洋地域',               '246',  'TRUE',  'TRUE'],
  ['BN', 'ブルネイ',                             '673',  'TRUE',  'TRUE'],
  ['BG', 'ブルガリア',                           '359',  'TRUE',  'TRUE'],
  ['BF', 'ブルキナファソ',                       '226',  'TRUE',  'TRUE'],
  ['BI', 'ブルンジ',                             '257',  'TRUE',  'TRUE'],
  ['CV', 'カーボベルデ',                         '238',  'TRUE',  'TRUE'],
  ['KH', 'カンボジア',                           '855',  'TRUE',  'TRUE'],
  ['CM', 'カメルーン',                           '237',  'TRUE',  'TRUE'],
  ['CA', 'カナダ',                               '1',    'TRUE',  'TRUE'],
  ['KY', 'ケイマン諸島',                         '1345', 'TRUE',  'TRUE'],
  ['CF', '中央アフリカ共和国',                   '236',  'TRUE',  'TRUE'],
  ['TD', 'チャド',                               '235',  'TRUE',  'TRUE'],
  ['CL', 'チリ',                                 '56',   'TRUE',  'TRUE'],
  ['CN', '中国',                                 '86',   'TRUE',  'TRUE'],
  ['CX', 'クリスマス島',                         '61',   'TRUE',  'TRUE'],
  ['CC', 'ココス（キーリング）諸島',             '61',   'TRUE',  'TRUE'],
  ['CO', 'コロンビア',                           '57',   'TRUE',  'TRUE'],
  ['KM', 'コモロ',                               '269',  'TRUE',  'TRUE'],
  ['CG', 'コンゴ共和国',                         '242',  'TRUE',  'TRUE'],
  ['CD', 'コンゴ民主共和国',                     '243',  'TRUE',  'TRUE'],
  ['CK', 'クック諸島',                           '682',  'TRUE',  'TRUE'],
  ['CR', 'コスタリカ',                           '506',  'TRUE',  'TRUE'],
  ['CI', 'コートジボワール',                     '225',  'TRUE',  'TRUE'],
  ['HR', 'クロアチア',                           '385',  'TRUE',  'TRUE'],
  ['CU', 'キューバ',                             '53',   'TRUE',  'TRUE'],
  ['CW', 'キュラソー',                           '599',  'TRUE',  'TRUE'],
  ['CY', 'キプロス',                             '357',  'TRUE',  'TRUE'],
  ['CZ', 'チェコ',                               '420',  'TRUE',  'TRUE'],
  ['DK', 'デンマーク',                           '45',   'TRUE',  'TRUE'],
  ['DJ', 'ジブチ',                               '253',  'TRUE',  'TRUE'],
  ['DM', 'ドミニカ国',                           '1767', 'TRUE',  'TRUE'],
  ['DO', 'ドミニカ共和国',                       '1809', 'TRUE',  'TRUE'],
  ['EC', 'エクアドル',                           '593',  'TRUE',  'TRUE'],
  ['EG', 'エジプト',                             '20',   'TRUE',  'TRUE'],
  ['SV', 'エルサルバドル',                       '503',  'TRUE',  'TRUE'],
  ['GQ', '赤道ギニア',                           '240',  'TRUE',  'TRUE'],
  ['ER', 'エリトリア',                           '291',  'TRUE',  'TRUE'],
  ['EE', 'エストニア',                           '372',  'TRUE',  'TRUE'],
  ['SZ', 'エスワティニ',                         '268',  'TRUE',  'TRUE'],
  ['ET', 'エチオピア',                           '251',  'TRUE',  'TRUE'],
  ['FK', 'フォークランド諸島',                   '500',  'TRUE',  'TRUE'],
  ['FO', 'フェロー諸島',                         '298',  'TRUE',  'TRUE'],
  ['FJ', 'フィジー',                             '679',  'TRUE',  'TRUE'],
  ['FI', 'フィンランド',                         '358',  'TRUE',  'TRUE'],
  ['FR', 'フランス',                             '33',   'TRUE',  'TRUE'],
  ['GF', 'フランス領ギアナ',                     '594',  'TRUE',  'TRUE'],
  ['PF', 'フランス領ポリネシア',                 '689',  'TRUE',  'TRUE'],
  ['TF', 'フランス領南方・南極地域',             '262',  'TRUE',  'TRUE'],
  ['GA', 'ガボン',                               '241',  'TRUE',  'TRUE'],
  ['GM', 'ガンビア',                             '220',  'TRUE',  'TRUE'],
  ['GE', 'ジョージア',                           '995',  'TRUE',  'TRUE'],
  ['DE', 'ドイツ',                               '49',   'TRUE',  'TRUE'],
  ['GH', 'ガーナ',                               '233',  'TRUE',  'TRUE'],
  ['GI', 'ジブラルタル',                         '350',  'TRUE',  'TRUE'],
  ['GR', 'ギリシャ',                             '30',   'TRUE',  'TRUE'],
  ['GL', 'グリーンランド',                       '299',  'TRUE',  'TRUE'],
  ['GD', 'グレナダ',                             '1473', 'TRUE',  'TRUE'],
  ['GP', 'グアドループ',                         '590',  'TRUE',  'TRUE'],
  ['GU', 'グアム',                               '1671', 'TRUE',  'TRUE'],
  ['GT', 'グアテマラ',                           '502',  'TRUE',  'TRUE'],
  ['GG', 'ガーンジー',                           '44',   'TRUE',  'TRUE'],
  ['GN', 'ギニア',                               '224',  'TRUE',  'TRUE'],
  ['GW', 'ギニアビサウ',                         '245',  'TRUE',  'TRUE'],
  ['GY', 'ガイアナ',                             '592',  'TRUE',  'TRUE'],
  ['HT', 'ハイチ',                               '509',  'TRUE',  'TRUE'],
  ['HM', 'ハード島・マクドナルド諸島',           '672',  'TRUE',  'TRUE'],
  ['VA', 'バチカン市国',                         '379',  'TRUE',  'TRUE'],
  ['HN', 'ホンジュラス',                         '504',  'TRUE',  'TRUE'],
  ['HK', '香港',                                 '852',  'TRUE',  'TRUE'],
  ['HU', 'ハンガリー',                           '36',   'TRUE',  'TRUE'],
  ['IS', 'アイスランド',                         '354',  'TRUE',  'TRUE'],
  ['IN', 'インド',                               '91',   'TRUE',  'TRUE'],
  ['ID', 'インドネシア',                         '62',   'TRUE',  'TRUE'],
  ['IR', 'イラン',                               '98',   'TRUE',  'TRUE'],
  ['IQ', 'イラク',                               '964',  'TRUE',  'TRUE'],
  ['IE', 'アイルランド',                         '353',  'TRUE',  'TRUE'],
  ['IM', 'マン島',                               '44',   'TRUE',  'TRUE'],
  ['IL', 'イスラエル',                           '972',  'TRUE',  'TRUE'],
  ['IT', 'イタリア',                             '39',   'FALSE', 'TRUE'],
  ['JM', 'ジャマイカ',                           '1876', 'TRUE',  'TRUE'],
  ['JP', '日本',                                 '81',   'TRUE',  'TRUE'],
  ['JE', 'ジャージー',                           '44',   'TRUE',  'TRUE'],
  ['JO', 'ヨルダン',                             '962',  'TRUE',  'TRUE'],
  ['KZ', 'カザフスタン',                         '7',    'TRUE',  'TRUE'],
  ['KE', 'ケニア',                               '254',  'TRUE',  'TRUE'],
  ['KI', 'キリバス',                             '686',  'TRUE',  'TRUE'],
  ['KP', '北朝鮮',                               '850',  'TRUE',  'TRUE'],
  ['KR', '韓国',                                 '82',   'TRUE',  'TRUE'],
  ['XK', 'コソボ',                               '383',  'TRUE',  'TRUE'],
  ['KW', 'クウェート',                           '965',  'TRUE',  'TRUE'],
  ['KG', 'キルギス',                             '996',  'TRUE',  'TRUE'],
  ['LA', 'ラオス',                               '856',  'TRUE',  'TRUE'],
  ['LV', 'ラトビア',                             '371',  'TRUE',  'TRUE'],
  ['LB', 'レバノン',                             '961',  'TRUE',  'TRUE'],
  ['LS', 'レソト',                               '266',  'TRUE',  'TRUE'],
  ['LR', 'リベリア',                             '231',  'TRUE',  'TRUE'],
  ['LY', 'リビア',                               '218',  'TRUE',  'TRUE'],
  ['LI', 'リヒテンシュタイン',                   '423',  'TRUE',  'TRUE'],
  ['LT', 'リトアニア',                           '370',  'TRUE',  'TRUE'],
  ['LU', 'ルクセンブルク',                       '352',  'TRUE',  'TRUE'],
  ['MO', 'マカオ',                               '853',  'TRUE',  'TRUE'],
  ['MG', 'マダガスカル',                         '261',  'TRUE',  'TRUE'],
  ['MW', 'マラウイ',                             '265',  'TRUE',  'TRUE'],
  ['MY', 'マレーシア',                           '60',   'TRUE',  'TRUE'],
  ['MV', 'モルディブ',                           '960',  'TRUE',  'TRUE'],
  ['ML', 'マリ',                                 '223',  'TRUE',  'TRUE'],
  ['MT', 'マルタ',                               '356',  'TRUE',  'TRUE'],
  ['MH', 'マーシャル諸島',                       '692',  'TRUE',  'TRUE'],
  ['MQ', 'マルティニーク',                       '596',  'TRUE',  'TRUE'],
  ['MR', 'モーリタニア',                         '222',  'TRUE',  'TRUE'],
  ['MU', 'モーリシャス',                         '230',  'TRUE',  'TRUE'],
  ['YT', 'マヨット',                             '262',  'TRUE',  'TRUE'],
  ['MX', 'メキシコ',                             '52',   'TRUE',  'TRUE'],
  ['FM', 'ミクロネシア連邦',                     '691',  'TRUE',  'TRUE'],
  ['MD', 'モルドバ',                             '373',  'TRUE',  'TRUE'],
  ['MC', 'モナコ',                               '377',  'TRUE',  'TRUE'],
  ['MN', 'モンゴル',                             '976',  'TRUE',  'TRUE'],
  ['ME', 'モンテネグロ',                         '382',  'TRUE',  'TRUE'],
  ['MS', 'モントセラト',                         '1664', 'TRUE',  'TRUE'],
  ['MA', 'モロッコ',                             '212',  'TRUE',  'TRUE'],
  ['MZ', 'モザンビーク',                         '258',  'TRUE',  'TRUE'],
  ['MM', 'ミャンマー',                           '95',   'TRUE',  'TRUE'],
  ['NA', 'ナミビア',                             '264',  'TRUE',  'TRUE'],
  ['NR', 'ナウル',                               '674',  'TRUE',  'TRUE'],
  ['NP', 'ネパール',                             '977',  'TRUE',  'TRUE'],
  ['NL', 'オランダ',                             '31',   'TRUE',  'TRUE'],
  ['NC', 'ニューカレドニア',                     '687',  'TRUE',  'TRUE'],
  ['NZ', 'ニュージーランド',                     '64',   'TRUE',  'TRUE'],
  ['NI', 'ニカラグア',                           '505',  'TRUE',  'TRUE'],
  ['NE', 'ニジェール',                           '227',  'TRUE',  'TRUE'],
  ['NG', 'ナイジェリア',                         '234',  'TRUE',  'TRUE'],
  ['NU', 'ニウエ',                               '683',  'TRUE',  'TRUE'],
  ['NF', 'ノーフォーク島',                       '672',  'TRUE',  'TRUE'],
  ['MK', '北マケドニア',                         '389',  'TRUE',  'TRUE'],
  ['MP', '北マリアナ諸島',                       '1670', 'TRUE',  'TRUE'],
  ['NO', 'ノルウェー',                           '47',   'TRUE',  'TRUE'],
  ['OM', 'オマーン',                             '968',  'TRUE',  'TRUE'],
  ['PK', 'パキスタン',                           '92',   'TRUE',  'TRUE'],
  ['PW', 'パラオ',                               '680',  'TRUE',  'TRUE'],
  ['PS', 'パレスチナ',                           '970',  'TRUE',  'TRUE'],
  ['PA', 'パナマ',                               '507',  'TRUE',  'TRUE'],
  ['PG', 'パプアニューギニア',                   '675',  'TRUE',  'TRUE'],
  ['PY', 'パラグアイ',                           '595',  'TRUE',  'TRUE'],
  ['PE', 'ペルー',                               '51',   'TRUE',  'TRUE'],
  ['PH', 'フィリピン',                           '63',   'TRUE',  'TRUE'],
  ['PN', 'ピトケアン諸島',                       '64',   'TRUE',  'TRUE'],
  ['PL', 'ポーランド',                           '48',   'TRUE',  'TRUE'],
  ['PT', 'ポルトガル',                           '351',  'TRUE',  'TRUE'],
  ['PR', 'プエルトリコ',                         '1787', 'TRUE',  'TRUE'],
  ['QA', 'カタール',                             '974',  'TRUE',  'TRUE'],
  ['RO', 'ルーマニア',                           '40',   'TRUE',  'TRUE'],
  ['RU', 'ロシア',                               '7',    'TRUE',  'TRUE'],
  ['RW', 'ルワンダ',                             '250',  'TRUE',  'TRUE'],
  ['RE', 'レユニオン',                           '262',  'TRUE',  'TRUE'],
  ['BL', 'サン・バルテルミー',                   '590',  'TRUE',  'TRUE'],
  ['SH', 'セントヘレナ',                         '290',  'TRUE',  'TRUE'],
  ['KN', 'セントクリストファー・ネイビス',       '1869', 'TRUE',  'TRUE'],
  ['LC', 'セントルシア',                         '1758', 'TRUE',  'TRUE'],
  ['MF', 'サン・マルタン（仏）',                 '590',  'TRUE',  'TRUE'],
  ['PM', 'サンピエール島・ミクロン島',           '508',  'TRUE',  'TRUE'],
  ['VC', 'セントビンセント・グレナディーン',     '1784', 'TRUE',  'TRUE'],
  ['WS', 'サモア',                               '685',  'TRUE',  'TRUE'],
  ['SM', 'サンマリノ',                           '378',  'TRUE',  'TRUE'],
  ['ST', 'サントメ・プリンシペ',                 '239',  'TRUE',  'TRUE'],
  ['SA', 'サウジアラビア',                       '966',  'TRUE',  'TRUE'],
  ['SN', 'セネガル',                             '221',  'TRUE',  'TRUE'],
  ['RS', 'セルビア',                             '381',  'TRUE',  'TRUE'],
  ['SC', 'セーシェル',                           '248',  'TRUE',  'TRUE'],
  ['SL', 'シエラレオネ',                         '232',  'TRUE',  'TRUE'],
  ['SG', 'シンガポール',                         '65',   'TRUE',  'TRUE'],
  ['SX', 'シント・マールテン（蘭）',             '1721', 'TRUE',  'TRUE'],
  ['SK', 'スロバキア',                           '421',  'TRUE',  'TRUE'],
  ['SI', 'スロベニア',                           '386',  'TRUE',  'TRUE'],
  ['SB', 'ソロモン諸島',                         '677',  'TRUE',  'TRUE'],
  ['SO', 'ソマリア',                             '252',  'TRUE',  'TRUE'],
  ['ZA', '南アフリカ',                           '27',   'TRUE',  'TRUE'],
  ['GS', 'サウスジョージア・サウスサンドウィッチ諸島', '500', 'TRUE', 'TRUE'],
  ['SS', '南スーダン',                           '211',  'TRUE',  'TRUE'],
  ['ES', 'スペイン',                             '34',   'TRUE',  'TRUE'],
  ['LK', 'スリランカ',                           '94',   'TRUE',  'TRUE'],
  ['SD', 'スーダン',                             '249',  'TRUE',  'TRUE'],
  ['SR', 'スリナム',                             '597',  'TRUE',  'TRUE'],
  ['SJ', 'スバールバル諸島・ヤンマイエン島',     '47',   'TRUE',  'TRUE'],
  ['SE', 'スウェーデン',                         '46',   'TRUE',  'TRUE'],
  ['CH', 'スイス',                               '41',   'TRUE',  'TRUE'],
  ['SY', 'シリア',                               '963',  'TRUE',  'TRUE'],
  ['TW', '台湾',                                 '886',  'TRUE',  'TRUE'],
  ['TJ', 'タジキスタン',                         '992',  'TRUE',  'TRUE'],
  ['TZ', 'タンザニア',                           '255',  'TRUE',  'TRUE'],
  ['TH', 'タイ',                                 '66',   'TRUE',  'TRUE'],
  ['TL', '東ティモール',                         '670',  'TRUE',  'TRUE'],
  ['TG', 'トーゴ',                               '228',  'TRUE',  'TRUE'],
  ['TK', 'トケラウ',                             '690',  'TRUE',  'TRUE'],
  ['TO', 'トンガ',                               '676',  'TRUE',  'TRUE'],
  ['TT', 'トリニダード・トバゴ',                 '1868', 'TRUE',  'TRUE'],
  ['TN', 'チュニジア',                           '216',  'TRUE',  'TRUE'],
  ['TR', 'トルコ',                               '90',   'TRUE',  'TRUE'],
  ['TM', 'トルクメニスタン',                     '993',  'TRUE',  'TRUE'],
  ['TC', 'タークス・カイコス諸島',               '1649', 'TRUE',  'TRUE'],
  ['TV', 'ツバル',                               '688',  'TRUE',  'TRUE'],
  ['UG', 'ウガンダ',                             '256',  'TRUE',  'TRUE'],
  ['UA', 'ウクライナ',                           '380',  'TRUE',  'TRUE'],
  ['AE', 'アラブ首長国連邦',                     '971',  'TRUE',  'TRUE'],
  ['GB', 'イギリス',                             '44',   'TRUE',  'TRUE'],
  ['UM', '合衆国領有小離島',                     '1',    'TRUE',  'TRUE'],
  ['US', 'アメリカ合衆国',                       '1',    'TRUE',  'TRUE'],
  ['UY', 'ウルグアイ',                           '598',  'TRUE',  'TRUE'],
  ['UZ', 'ウズベキスタン',                       '998',  'TRUE',  'TRUE'],
  ['VU', 'バヌアツ',                             '678',  'TRUE',  'TRUE'],
  ['VE', 'ベネズエラ',                           '58',   'TRUE',  'TRUE'],
  ['VN', 'ベトナム',                             '84',   'TRUE',  'TRUE'],
  ['VG', 'イギリス領ヴァージン諸島',             '1284', 'TRUE',  'TRUE'],
  ['VI', 'アメリカ領ヴァージン諸島',             '1340', 'TRUE',  'TRUE'],
  ['WF', 'ウォリス・フツナ',                     '681',  'TRUE',  'TRUE'],
  ['EH', '西サハラ',                             '212',  'TRUE',  'TRUE'],
  ['YE', 'イエメン',                             '967',  'TRUE',  'TRUE'],
  ['ZM', 'ザンビア',                             '260',  'TRUE',  'TRUE'],
  ['ZW', 'ジンバブエ',                           '263',  'TRUE',  'TRUE']
];

// ============================================================
// 1. seedCountryMaster()
// ============================================================

/**
 * 「国マスタ」タブ新設・全240カ国地域をシード（冪等）
 * データ行が既に存在する場合はスキップ
 */
function seedCountryMaster() {
  const ss = getSpreadsheet();
  const sheetName = '国マスタ';
  let sh = ss.getSheetByName(sheetName);

  if (sh && sh.getLastRow() > 1) {
    return '国マスタ: 既存（' + (sh.getLastRow() - 1) + '行）。スキップ。再シードするにはデータ行を削除してください。';
  }

  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }

  const headers = ['国ID(ISO2)', '国名（表示）', '国番号', 'トランク0除去', '有効'];
  const headerRange = sh.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1565c0');
  headerRange.setFontColor('#ffffff');
  sh.setFrozenRows(1);

  sh.getRange(2, 1, COUNTRY_DATA.length, COUNTRY_DATA[0].length).setValues(COUNTRY_DATA);

  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 80);
  sh.setColumnWidth(4, 110);
  sh.setColumnWidth(5, 60);

  // トランク0除去=FALSE の国を確認
  const falseCount = COUNTRY_DATA.filter(function(r) { return r[3] === 'FALSE'; }).length;

  return [
    '国マスタ: ' + COUNTRY_DATA.length + '件をシード完了',
    'トランク0除去=FALSE（保持国）: ' + falseCount + '件',
    '  ' + COUNTRY_DATA.filter(function(r){ return r[3]==='FALSE'; }).map(function(r){ return r[1]+'('+r[0]+')'; }).join(', ')
  ].join('\n');
}

// ============================================================
// 2. normalizePhone(countryName, raw)
// ============================================================

/**
 * 電話番号を E.164 形式へ正規化
 * @param {string} countryName - 国名（表示）（国マスタと突合）
 * @param {string} raw - 生の電話番号
 * @returns {{value: string, flag: string}}
 *   flag: '✓' / '空欄' / '要確認(国番号不一致)' / '要確認(桁数異常:N)' / '要確認(国不明)' / '要確認(非数字)'
 */
function normalizePhone(countryName, raw) {
  const rawStr = String(raw || '').trim();
  if (!rawStr) return { value: '', flag: '空欄' };

  // 国マスタ引き
  const ss = getSpreadsheet();
  const msh = ss.getSheetByName('国マスタ');
  let countryCode = null, trunkRemove = true;
  if (msh) {
    const mData = msh.getDataRange().getValues();
    const mh = mData[0];
    const nameIdx  = mh.indexOf('国名（表示）');
    const codeIdx  = mh.indexOf('国番号');
    const trunkIdx = mh.indexOf('トランク0除去');
    const row = mData.slice(1).find(function(r) {
      return String(r[nameIdx]) === String(countryName);
    });
    if (row) {
      countryCode  = String(row[codeIdx]);
      trunkRemove  = String(row[trunkIdx]).toUpperCase() === 'TRUE';
    }
  }

  // 記号除去（スペース・ハイフン・括弧・ドット・スラッシュ）、+ は先頭のみ保持
  const cleaned = rawStr.replace(/[\s\-\(\)\.\/]/g, '');

  // ---- +始まり（E.164 候補） ----
  if (cleaned.charAt(0) === '+') {
    const digits = cleaned.slice(1);
    if (!/^\d+$/.test(digits)) return { value: rawStr, flag: '要確認(非数字)' };
    if (countryCode && !digits.startsWith(countryCode)) {
      return { value: cleaned, flag: '要確認(国番号不一致)' };
    }
    if (digits.length < 7 || digits.length > 15) {
      return { value: cleaned, flag: '要確認(桁数異常:' + digits.length + ')' };
    }
    return { value: cleaned, flag: '✓' };
  }

  // ---- 00始まり（国際プレフィックス） ----
  if (cleaned.startsWith('00')) {
    const digits = cleaned.slice(2);
    if (!/^\d+$/.test(digits)) return { value: rawStr, flag: '要確認(非数字)' };
    if (digits.length < 7 || digits.length > 15) {
      return { value: '+' + digits, flag: '要確認(桁数異常:' + digits.length + ')' };
    }
    return { value: '+' + digits, flag: '✓' };
  }

  // ---- 国内形式 ----
  if (!countryCode) return { value: rawStr, flag: '要確認(国不明)' };
  if (!/^\d+$/.test(cleaned)) return { value: rawStr, flag: '要確認(非数字)' };

  var national = cleaned;
  if (cleaned.charAt(0) === '0' && trunkRemove) {
    national = cleaned.slice(1);  // トランク0除去
  }
  // trunkRemove=FALSE（イタリア等）→ 0 をそのまま保持

  var totalDigits = countryCode.length + national.length;
  var e164 = '+' + countryCode + national;
  if (totalDigits < 7 || totalDigits > 15) {
    return { value: e164, flag: '要確認(桁数異常:' + totalDigits + ')' };
  }
  return { value: e164, flag: '✓' };
}

// ============================================================
// 3. testNormalizePhone()
// ============================================================

/**
 * normalizePhone の12ケーステスト
 * 全件突合して PASS/FAIL を報告
 */
function testNormalizePhone() {
  // [id, countryName, raw, expectValue, expectFlag]
  var CASES = [
    ['01', '日本',           '03-1234-5678',     '+81312345678',    '✓'],
    ['02', '日本',           '312345678',         '+81312345678',    '✓'],
    ['03', 'アメリカ合衆国', '+12125551234',       '+12125551234',    '✓'],
    ['04', 'アメリカ合衆国', '0012125551234',      '+12125551234',    '✓'],
    ['05', '日本',           '03 1234 5678',       '+81312345678',    '✓'],
    ['06', '日本',           '(03).1234-5678',     '+81312345678',    '✓'],
    ['07', '日本',           '+442071234567',       '+442071234567',   '要確認(国番号不一致)'],
    ['08', '日本',           '+8112',              '+8112',           '要確認(桁数異常:4)'],
    ['09', 'イタリア',       '06-12345678',        '+390612345678',   '✓'],
    ['10', '日本',           '',                   '',                '空欄'],
    ['11', '日本',           '+81312345678',       '+81312345678',    '✓'],
    ['12', '日本',           '0-1-2',              '+8112',           '要確認(桁数異常:4)']
  ];

  var lines = ['=== testNormalizePhone ==='];
  var pass = 0, fail = 0;

  CASES.forEach(function(c) {
    var id = c[0], country = c[1], raw = c[2];
    var expectValue = c[3], expectFlag = c[4];
    var result = normalizePhone(country, raw);
    var valueOk = (result.value === expectValue);
    var flagOk  = (result.flag  === expectFlag);
    var ok = valueOk && flagOk;
    if (ok) { pass++; } else { fail++; }
    lines.push(
      (ok ? '✓' : '✗') + ' [' + id + '] ' + country + ' / "' + raw + '"' +
      '\n  期待: value=' + expectValue + '  flag=' + expectFlag +
      (!ok ? '\n  実際: value=' + result.value + '  flag=' + result.flag : '')
    );
  });

  lines.push('');
  lines.push('結果: ' + pass + '/' + CASES.length + ' PASS' +
             (fail > 0 ? ' ✗ / ' + fail + ' FAIL' : ' ✓'));
  return lines.join('\n');
}

// ============================================================
// 4. auditAddressLength()
// ============================================================
// ============================================================
// 5. fixAddressSplits(confirmArg)  ← PR17
// ============================================================

/**
 * 35文字超の住所をカンマ位置で分割して是正する。
 * CT-00037 の City 全角括弧修正も含む。
 *
 * DRY RUN（デフォルト）: 変更予定の before/after 一覧を返す（書き込みなし）
 * CONFIRM             : 全行を検証してから一括書き込み（2パス）
 *
 * @param {string} [confirmArg] - 'CONFIRM' のみ書き込みモード
 * @returns {string} 実行ログ
 */
function fixAddressSplits(confirmArg) {
  var dryRun = (String(confirmArg || '').trim().toUpperCase() !== 'CONFIRM');
  var ss = getSpreadsheet();
  var LIMIT = 35;
  var lines = ['=== fixAddressSplits (' + (dryRun ? 'DRY RUN' : 'CONFIRM') + ') ==='];
  var pendingWrites = [];  // {sh, rowIdx, colIdx（1始まり）, newVal}
  var totalChanges = 0;

  var targets = [
    { key: CONFIG.SHEETS.CRM_SHIPPING, addrCols: ['Address 1', 'Address 2', 'Address 3'] },
    { key: CONFIG.SHEETS.CRM_PAYMENT,  addrCols: ['Address 1', 'Address 2'] }
  ];

  targets.forEach(function(t) {
    var sh = ss.getSheetByName(t.key);
    if (!sh) { lines.push('[' + t.key + '] ERROR: シートが存在しません'); return; }
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var cidIdx  = h.indexOf('顧客ID');
    var cityIdx = h.indexOf('City');
    var colIdxs = t.addrCols.map(function(c) { return h.indexOf(c); });

    lines.push('[' + t.key + ']');
    var sheetChanges = 0;

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var cid = String(r[cidIdx] || '');
      var addrs = colIdxs.map(function(ci) { return ci >= 0 ? String(r[ci] || '') : ''; });
      var cityVal  = cityIdx >= 0 ? String(r[cityIdx] || '') : '';

      var needsAddrFix = addrs.some(function(a) { return a.length > LIMIT; });

      // CT-00037: City 全角括弧除去
      var newCity = cityVal;
      if (cid === 'CT-00037' && /[（）]/.test(cityVal)) {
        newCity = 'Jakarta Barat';
      }

      if (!needsAddrFix && newCity === cityVal) continue;

      // 正しい shift-down 分割
      var shifted   = _shiftDown(addrs, LIMIT);
      var newAddrs  = shifted.result;
      var overflow  = shifted.overflow;

      // 変更セルを収集
      var rowChanges = [];
      for (var k = 0; k < colIdxs.length; k++) {
        if (colIdxs[k] >= 0 && addrs[k] !== newAddrs[k]) {
          rowChanges.push({ colIdx: colIdxs[k], label: t.addrCols[k],
                            oldVal: addrs[k], newVal: newAddrs[k] });
        }
      }
      if (cityIdx >= 0 && cityVal !== newCity) {
        rowChanges.push({ colIdx: cityIdx, label: 'City', oldVal: cityVal, newVal: newCity });
      }
      if (rowChanges.length === 0) continue;

      sheetChanges++;
      totalChanges++;

      // レポート
      var rpt = '  ' + cid + ' (row' + (i + 1) + ')';
      rowChanges.forEach(function(c) {
        rpt += '\n    ' + c.label;
        rpt += '\n      BEFORE: "' + c.oldVal + '" (' + c.oldVal.length + '字)';
        rpt += '\n      AFTER : "' + c.newVal + '" (' + c.newVal.length + '字)';
      });
      if (overflow) {
        rpt += '\n    ⚠ overflow未収容（格納列なし）: "' + overflow + '"';
      }
      lines.push(rpt);

      if (!dryRun) {
        rowChanges.forEach(function(c) {
          pendingWrites.push({ sh: sh, rowIdx: i + 1, colIdx: c.colIdx + 1, newVal: c.newVal });
        });
      }
    }

    if (sheetChanges === 0) lines.push('  変更対象なし ✓');
    lines.push('');
  });

  lines.push('変更対象合計: ' + totalChanges + '行');

  if (!dryRun) {
    if (pendingWrites.length === 0) {
      lines.push('書き込み対象なし');
      return lines.join('\n');
    }
    // 2パス目: 書き込み
    pendingWrites.forEach(function(w) {
      w.sh.getRange(w.rowIdx, w.colIdx).setValue(w.newVal);
    });
    lines.push('書き込み完了: ' + pendingWrites.length + 'セル ✓');
  } else {
    lines.push('（DRY RUN: 書き込みなし。CONFIRM で実行してください）');
  }

  return lines.join('\n');
}

/**
 * 住所行配列をシフトダウン方式で分割する
 * overflow が既存の次列を上書きせず、キューの後ろへ押し込む正しいアルゴリズム。
 * @param {string[]} addrs  元の住所行配列
 * @param {number}   limit  文字数上限
 * @returns {{result: string[], overflow: string}}
 */
function _shiftDown(addrs, limit) {
  var queue  = addrs.slice();   // 元の内容をキューに投入
  var result = [];
  var i = 0;

  while (result.length < addrs.length) {
    var line = i < queue.length ? queue[i] : '';
    i++;

    if (!line || line.length <= limit) {
      result.push(line);
    } else {
      var s = _splitAddrLine(line, limit);
      result.push(s[0]);
      queue.splice(i, 0, s[1]);   // overflow を次の位置に挿入（既存内容は後ろへ）
    }
  }

  // 格納できなかった余剰
  var overflow = queue.slice(i).filter(function(s) { return s && s.trim(); }).join(', ');
  return { result: result, overflow: overflow };
}

/**
 * 住所1行を limit 以内で分割する内部ヘルパー
 * 優先順: カンマ > スペース > 強制35字
 * @param {string} line
 * @param {number} [limit=35]
 * @returns {string[]} [part1, part2]
 */
function _splitAddrLine(line, limit) {
  limit = limit || 35;
  if (line.length <= limit) return [line, ''];

  var splitAt   = -1;
  var isComma   = false;

  // 最後のカンマを limit 以内で探す（0始まりインデックス）
  for (var i = limit - 1; i >= 0; i--) {
    if (line.charAt(i) === ',') { splitAt = i; isComma = true; break; }
  }
  // カンマなければ最後のスペース
  if (splitAt < 0) {
    for (var j = limit - 1; j >= 0; j--) {
      if (line.charAt(j) === ' ') { splitAt = j; break; }
    }
  }
  // それもなければ強制カット
  if (splitAt < 0) splitAt = limit;

  var part1, part2;
  if (isComma) {
    // カンマの後ろで分割。カンマ自体は part1 に残すが末尾カンマは除去
    part1 = line.substring(0, splitAt + 1).trim().replace(/,+$/, '').trim();
    part2 = line.substring(splitAt + 1).trim().replace(/,+$/, '').trim();
  } else {
    // スペースまたは強制カット: 区切り文字は捨てる
    part1 = line.substring(0, splitAt).trim();
    part2 = line.substring(splitAt + 1).trim().replace(/,+$/, '').trim();
  }

  return [part1, part2];
}

// ============================================================
// 6. auditAddressCharset()  ← PR17
// ============================================================

/**
 * 配送先・支払先の住所フィールドで許容外文字を含む行を列挙
 * 許容: 半角英数 + , . - # / ' スペース
 * @returns {string} 実行ログ
 */
function auditAddressCharset() {
  var ss = getSpreadsheet();
  var ALLOWED = /^[A-Za-z0-9\s,.\-#\/']*$/;
  var lines = ['=== auditAddressCharset ==='];
  var total = 0;

  var targets = [
    {
      name: CONFIG.SHEETS.CRM_SHIPPING,
      cols: ['宛名', 'Address 1', 'Address 2', 'Address 3', 'City', 'State']
    },
    {
      name: CONFIG.SHEETS.CRM_PAYMENT,
      cols: ['請求名義', 'Address 1', 'Address 2', 'City', 'State']
    },
    {
      name: CONFIG.SHEETS.CRM_CUSTOMERS,
      cols: ['顧客名']
    }
  ];

  targets.forEach(function(t) {
    var sh = ss.getSheetByName(t.name);
    if (!sh) { lines.push('[' + t.name + '] シートが存在しません'); return; }
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var cidIdx = h.indexOf('顧客ID');

    lines.push('[' + t.name + ']');
    var sheetFound = 0;

    t.cols.forEach(function(col) {
      var colIdx = h.indexOf(col);
      if (colIdx < 0) { lines.push('  ' + col + ': 列なし'); return; }

      data.slice(1).forEach(function(row, ri) {
        var val = String(row[colIdx] || '');
        if (val === '') return;
        if (!ALLOWED.test(val)) {
          sheetFound++;
          total++;
          // 許容外文字を抽出
          var bad = val.split('').filter(function(c) { return !ALLOWED.test(c); });
          var uniq = bad.filter(function(c, idx, arr) { return arr.indexOf(c) === idx; });
          lines.push(
            '  行' + (ri + 2) + ' ' + String(row[cidIdx] || '') +
            ' [' + col + '] 許容外文字: ' + uniq.map(function(c) {
              return '"' + c + '"(U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0') + ')';
            }).join(', ') +
            '\n    値: ' + val.substring(0, 60)
          );
        }
      });
    });

    if (sheetFound === 0) lines.push('  許容外文字なし ✓');
    lines.push('');
  });

  lines.push('合計: ' + total + '件' + (total === 0 ? ' ✓' : ''));
  return lines.join('\n');
}

// ============================================================
// 7. expandCountryMaster()  ← PR17
// ============================================================

/**
 * 国マスタに 州必須・郵便番号必須 列を追加（冪等）
 *
 * 州必須: US・CA のみ TRUE（FedExで州コードが必須な国）
 * 郵便番号必須: FedEx の郵便番号必須国リストに基づく
 *
 * @returns {string} 実行ログ
 */
function expandCountryMaster() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('国マスタ');
  if (!sh) return 'ERROR: 国マスタが存在しません。先に seedCountryMaster() を実行してください。';

  var data = sh.getDataRange().getValues();
  var h = data[0];
  var lastCol = h.length;

  // 冪等チェック
  var stateIdx  = h.indexOf('州必須');
  var postalIdx = h.indexOf('郵便番号必須');
  if (stateIdx >= 0 && postalIdx >= 0) {
    return '州必須・郵便番号必須 列は既に存在します（col' + (stateIdx+1) + '・col' + (postalIdx+1) + '）。スキップ。';
  }

  var isoIdx = h.indexOf('国ID(ISO2)');
  if (isoIdx < 0) return 'ERROR: 国ID(ISO2) 列が見つかりません';

  // 州必須: US, CA のみ
  var STATE_REQUIRED = { 'US': true, 'CA': true };

  // 郵便番号必須（FedEx基準）
  var POSTAL_REQUIRED = {};
  [
    'AD','AR','AT','AU','AZ',
    'BD','BE','BG','BM','BR','BN','BY',
    'CA','CH','CN','CO','CR','CZ',
    'DE','DK',
    'EE','ES',
    'FI','FO','FR',
    'GB','GE','GL','GR',
    'HR','HU',
    'ID','IL','IN','IS','IT',
    'JP',
    'KG','KH','KR','KZ',
    'LA','LI','LK','LT','LU','LV',
    'MC','MD','ME','MK','MM','MT','MV','MX','MY',
    'NL','NO','NP','NZ',
    'PE','PH','PK','PL','PT',
    'RO','RS','RU',
    'SE','SG','SI','SK','TH','TN','TR','TW',
    'UA','US','UZ',
    'VN',
    'ZA'
  ].forEach(function(iso) { POSTAL_REQUIRED[iso] = true; });

  var lines = ['=== expandCountryMaster ==='];

  // ヘッダー追加（まだない列のみ）
  var newCols = [];
  if (stateIdx < 0) {
    lastCol++;
    stateIdx = lastCol - 1;
    sh.getRange(1, lastCol).setValue('州必須').setFontWeight('bold').setBackground('#1565c0').setFontColor('#ffffff');
    newCols.push('州必須 → col' + lastCol);
  }
  if (postalIdx < 0) {
    lastCol++;
    postalIdx = lastCol - 1;
    sh.getRange(1, lastCol).setValue('郵便番号必須').setFontWeight('bold').setBackground('#1565c0').setFontColor('#ffffff');
    newCols.push('郵便番号必須 → col' + lastCol);
    sh.setColumnWidth(lastCol, 120);
  }
  lines.push('追加列: ' + newCols.join(', '));

  // データ行に値をセット（行ごとに個別書き込み → スプレッドシートの行数が多くないので許容）
  var stateRows  = [];
  var postalRows = [];
  var stateCount = 0, postalCount = 0;

  for (var i = 1; i < data.length; i++) {
    var iso2 = String(data[i][isoIdx] || '').trim();
    var stateVal  = STATE_REQUIRED[iso2]  ? 'TRUE' : 'FALSE';
    var postalVal = POSTAL_REQUIRED[iso2] ? 'TRUE' : 'FALSE';
    stateRows.push([stateVal]);
    postalRows.push([postalVal]);
    if (stateVal  === 'TRUE') stateCount++;
    if (postalVal === 'TRUE') postalCount++;
  }

  // 一括書き込み
  var startRow = 2;
  var rowCount = data.length - 1;
  sh.getRange(startRow, stateIdx + 1,  rowCount, 1).setValues(stateRows);
  sh.getRange(startRow, postalIdx + 1, rowCount, 1).setValues(postalRows);

  lines.push('州必須=TRUE: ' + stateCount + '件 (US, CA)');
  lines.push('郵便番号必須=TRUE: ' + postalCount + '件');
  lines.push('書き込み完了 ✓');
  return lines.join('\n');
}

/**
 * 配送先・支払先マスタの住所列で35文字超の行を全件リスト
 * 顧客ID・列名・文字数・実値先頭40字 を報告
 */
function auditAddressLength() {
  var ss = getSpreadsheet();
  var LIMIT = 35;
  var lines = ['=== auditAddressLength (>' + LIMIT + '文字) ==='];
  var total = 0;

  var targets = [
    { name: CONFIG.SHEETS.CRM_SHIPPING, cols: ['Address 1', 'Address 2', 'Address 3'] },
    { name: CONFIG.SHEETS.CRM_PAYMENT,  cols: ['Address 1', 'Address 2'] }
  ];

  targets.forEach(function(t) {
    var sh = ss.getSheetByName(t.name);
    if (!sh) { lines.push('[' + t.name + '] シートが存在しません'); return; }
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var cidIdx = h.indexOf('顧客ID');
    lines.push('[' + t.name + ']');

    var sheetFound = 0;
    t.cols.forEach(function(col) {
      var colIdx = h.indexOf(col);
      if (colIdx < 0) { lines.push('  ' + col + ': 列なし'); return; }
      data.slice(1).forEach(function(row, ri) {
        var val = String(row[colIdx] || '');
        if (val.length > LIMIT) {
          sheetFound++;
          total++;
          lines.push('  行' + (ri + 2) + ' ' + String(row[cidIdx] || '') +
                     ' [' + col + '] ' + val.length + '文字: ' + val.substring(0, 40));
        }
      });
    });

    if (sheetFound === 0) lines.push('  超過行なし ✓');
    lines.push('');
  });

  lines.push('合計: ' + total + '件' + (total === 0 ? ' ✓' : ''));
  return lines.join('\n');
}
