/**
 * 99_DevElogiDhlImport.js
 *
 * 目的: eLogi DHL の配送会社・地帯・送料・超過単価を DEV スプレッドシートに投入する。
 *
 * 前提（事前に完了していること）:
 *   - setupOverweightRateMaster('APPLY') → CARRIERS 16列、OVERWEIGHT_UNIT_RATES シート作成済み
 *   - addPackageTypeColumn('APPLY') → SHIPPING_RATES に荷姿区分列追加済み
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 料金・単価の値をログ・報告・作業ログに出力すること
 *   - 既存3社（CAR-0001/0002/0003）のデータ変更
 *
 * eLogi 料金表データは会員限定情報のため、コードに埋め込んだ値を外部に漏らさないこと。
 *
 * 使い方:
 *   clasp run importElogiDhlRates --params '["DRY_RUN"]'
 *   clasp run importElogiDhlRates --params '["APPLY"]'
 *
 * 設計メモ（ADD_TO_BASE の基準重量について）:
 *   eLogi DHL 送料表は 30.0kg まで。30.0kg 超は「30.0kg の料金 + 超過分 × 単価」。
 *   送料計算機の ADD_TO_BASE ロジックは carrier.unitRateFromKg の重量帯を ratesMap から
 *   参照するため、CARRIERS の unitRateFromKg には 30.0 を格納する（PDF 記載の 30.1 ではなく）。
 *   30.5kg 以上が実際の超過帯。30.0kg 自体は ADD_TO_BASE で計算しても超過額 0 円で一致する。
 */

// ============================================================
// 配送会社定義
// ============================================================

var ELOGI_DHL_CARRIER_ID        = 'CAR-0007';
var ELOGI_DHL_CARRIER_NAME      = 'eLogi DHL';
var ELOGI_DHL_VOLUMETRIC_DIVISOR = 5000;
var ELOGI_DHL_ROUNDING_UNIT     = 0.5;
var ELOGI_DHL_DIM_ROUNDING      = 'CEIL';
var ELOGI_DHL_WEIGHT_STEP_SMALL = 0.5;
var ELOGI_DHL_WEIGHT_STEP_LARGE = 0.5;
var ELOGI_DHL_MAX_WEIGHT        = 68;
// ADD_TO_BASE の基準重量: 送料計算機が ratesMap から参照できる最大の実在重量値
var ELOGI_DHL_UNIT_RATE_FROM_KG = 30.0;
var ELOGI_DHL_OVERWEIGHT_METHOD = 'ADD_TO_BASE';

// ============================================================
// ゾーンラベル（zoneLabels のインデックスと z 配列が対応）
// ============================================================

var ELOGI_DHL_ZONE_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// ============================================================
// 料金データ（埋め込み）
// ★ eLogi 会員限定情報。値をログ・報告・コミットコメントに出力しないこと
// ============================================================

/* eslint-disable */
var ELOGI_DHL_RATES = [
  { w: 0.5,  z: [3100,3200,3300,3600,4900,3400,6300,6600,7000] },
  { w: 1.0,  z: [3200,3400,3500,3800,5200,3700,6400,6800,7100] },
  { w: 1.5,  z: [3500,3600,3700,3900,5500,4300,6600,6900,7300] },
  { w: 2.0,  z: [4000,3900,4000,4100,5800,5000,6700,7100,7500] },
  { w: 2.5,  z: [4900,5000,5400,6200,7500,7700,15400,15700,16100] },
  { w: 3.0,  z: [5000,5100,5600,6200,7900,7900,15500,15900,16200] },
  { w: 3.5,  z: [5100,5200,5700,6500,8400,8100,15700,16000,16400] },
  { w: 4.0,  z: [5300,5300,5800,6700,8900,8400,15800,16200,16500] },
  { w: 4.5,  z: [5400,5500,5900,6800,9600,8600,16000,16300,16700] },
  { w: 5.0,  z: [5500,5600,6000,7000,10700,8900,16100,16500,16900] },
  { w: 5.5,  z: [6600,6700,7200,8400,11700,10700,19000,19600,20400] },
  { w: 6.0,  z: [7600,7700,8400,10600,13800,15100,22700,23400,24700] },
  { w: 6.5,  z: [8700,8800,9800,12700,16400,18300,26300,27300,29100] },
  { w: 7.0,  z: [9800,9900,11100,14900,19000,21500,30000,31100,33400] },
  { w: 7.5,  z: [10900,10900,12400,17100,21500,24700,33700,35000,37700] },
  { w: 8.0,  z: [11900,12000,13800,19300,24100,28000,37300,38800,42100] },
  { w: 8.5,  z: [13000,13100,15100,21400,26700,31200,41000,42700,46400] },
  { w: 9.0,  z: [14100,14200,16500,23600,29200,34400,44600,46500,50700] },
  { w: 9.5,  z: [15200,15200,17800,25800,31800,37600,48300,50300,55000] },
  { w: 10.0, z: [16200,16300,19200,27900,34400,40800,51900,54200,59400] },
  { w: 10.5, z: [16900,17000,19500,28500,34700,40900,54000,56300,61300] },
  { w: 11.0, z: [17700,17700,19800,29000,35100,40900,56000,58300,63200] },
  { w: 11.5, z: [18400,18500,20500,29500,35700,41500,58000,60400,65200] },
  { w: 12.0, z: [19100,19200,21100,30000,36400,42100,60000,62500,67100] },
  { w: 12.5, z: [19800,19900,21800,30500,37000,42700,62100,64500,69000] },
  { w: 13.0, z: [20500,20600,22500,31100,37600,43200,64100,66600,70900] },
  { w: 13.5, z: [21200,21300,23200,31600,38300,43800,66100,68700,72900] },
  { w: 14.0, z: [21900,22000,23900,32100,38900,44400,68100,70700,74800] },
  { w: 14.5, z: [22700,22700,24600,32600,39500,45000,70200,72800,76700] },
  { w: 15.0, z: [23400,23400,25300,33100,40200,45500,72200,74900,78700] },
  { w: 15.5, z: [24100,24200,26000,33700,40800,46100,74200,76900,80600] },
  { w: 16.0, z: [24800,24900,26700,34200,41500,46700,76300,79000,82500] },
  { w: 16.5, z: [25500,25600,27300,34700,42100,47300,78300,81100,84400] },
  { w: 17.0, z: [26200,26300,28000,35200,42700,47800,80300,83100,86400] },
  { w: 17.5, z: [26900,27000,28700,35700,43400,48400,82300,85200,88300] },
  { w: 18.0, z: [27700,27700,29400,36300,44000,49000,84400,87300,90200] },
  { w: 18.5, z: [28400,28400,30100,36800,44600,49600,86400,89400,92200] },
  { w: 19.0, z: [29100,29200,30800,37300,45300,50200,88400,91400,94100] },
  { w: 19.5, z: [29800,29900,31500,37800,45900,50700,90400,93500,96000] },
  { w: 20.0, z: [30500,30600,32200,38400,46600,51300,92500,95600,97900] },
  { w: 20.5, z: [31200,31400,33000,39100,47400,52300,94200,97200,99800] },
  { w: 21.0, z: [31900,32200,33800,39900,48200,53400,95900,98800,101600] },
  { w: 21.5, z: [32600,32900,34600,40600,49100,54400,97600,100400,103400] },
  { w: 22.0, z: [33200,33700,35400,41400,49900,55500,99300,102000,105300] },
  { w: 22.5, z: [33900,34500,36200,42200,50800,56500,101000,103600,107100] },
  { w: 23.0, z: [34600,35300,37000,42900,51600,57600,102700,105200,108900] },
  { w: 23.5, z: [35300,36100,37800,43700,52500,58600,104400,106800,110800] },
  { w: 24.0, z: [36000,36900,38600,44500,53300,59600,106100,108400,112600] },
  { w: 24.5, z: [36600,37700,39400,45200,54200,60700,107900,110000,114400] },
  { w: 25.0, z: [37300,38500,40200,46000,55000,61700,109600,111600,116300] },
  { w: 25.5, z: [38000,39300,41000,46700,55900,62800,111300,113200,118100] },
  { w: 26.0, z: [38700,40000,41800,47500,56700,63800,113000,114800,119900] },
  { w: 26.5, z: [39400,40800,42600,48300,57500,64800,114700,116500,121800] },
  { w: 27.0, z: [40100,41600,43400,49000,58400,65900,116400,118100,123600] },
  { w: 27.5, z: [40700,42400,44200,49800,59200,66900,118100,119700,125500] },
  { w: 28.0, z: [41400,43200,45100,50600,60100,68000,119800,121300,127300] },
  { w: 28.5, z: [42100,44000,45900,51300,60900,69000,121600,122900,129100] },
  { w: 29.0, z: [42800,44800,46700,52100,61800,70100,123300,124500,131000] },
  { w: 29.5, z: [43500,45600,47500,52900,62600,71100,125000,126100,132800] },
  { w: 30.0, z: [44200,46300,48300,53600,63500,72100,126700,127700,134600] }
];

// 超過料金単価データ（PDF「単価開始重量」30.1kg以上）
// MIN_WEIGHT は ADD_TO_BASE 基準重量 30.0 の直前ステップ（29.5）を起点とする
var ELOGI_DHL_UNIT_RATES = [
  { from: 30.1, to: 31.0,  z: [969,930,948,1213,5353,5353,1894,2792,2831] },
  { from: 31.1, to: 70.0,  z: [970,925,958,1199,2262,1836,1887,2803,2826] },
  { from: 70.1, to: 300.0, z: [1098,1098,1130,1791,2371,2029,3086,3470,3641] },
  { from: 300.1, to: 99999.0, z: [1098,1098,1132,1789,2368,2029,3084,3470,3641] }
];
/* eslint-enable */

// ============================================================
// 地帯データ（DHL 国名 → ゾーン）
// 出典: クーリエ別ゾーン表.pdf / matchBy: englishName
// ============================================================

var ELOGI_DHL_ZONE_DATA = {
  'AFGHANISTAN': '9', 'ALBANIA': '7', 'ALGERIA': '9', 'AMERICAN SAMOA': '9',
  'ANDORRA': '6', 'ANGOLA': '9', 'ANGUILLA': '9', 'ANTIGUA': '9',
  'ARGENTINA': '8', 'ARMENIA': '7', 'ARUBA': '9', 'AUSTRALIA': '4',
  'AUSTRIA': '6', 'AZERBAIJAN': '7', 'BAHAMAS': '9', 'BAHRAIN': '9',
  'BANGLADESH': '4', 'BARBADOS': '9', 'BELARUS': '9', 'BELGIUM': '6',
  'BELIZE': '9', 'BENIN': '9', 'BERMUDA': '9', 'BHUTAN': '4',
  'BOLIVIA': '8', 'BONAIRE': '9', 'BOSNIA AND HERZEGOVINA': '7',
  'BOTSWANA': '9', 'BRAZIL': '8', 'BRUNEI': '3', 'BULGARIA': '6',
  'BURKINA FASO': '9', 'BURUNDI': '9', 'CAMBODIA': '4', 'CAMEROON': '9',
  'CANADA': '5', 'CANARY ISLANDS, THE': '9', 'CAPE VERDE': '9',
  'CAYMAN ISLANDS': '9', 'CENTRAL AFRICAN REPUBLIC': '9', 'CHAD': '9',
  'CHILE': '8', 'CHINA, PEOPLES REPUBLIC': '2', 'COLOMBIA': '8',
  'COMMONWEALTH NO. MARIANA': '9', 'COMOROS': '9', 'CONGO': '9',
  'CONGO, THE DEMOCRATIC REP': '9', 'COOK ISLANDS': '9', 'COSTA RICA': '9',
  'COTE D IVOIRE': '9', 'CROATIA': '6', 'CUBA': '9', 'CURACAO': '9',
  'CYPRUS': '6', 'CZECH REPUBLIC, THE': '6', 'DENMARK': '6',
  'DJIBOUTI': '9', 'DOMINICA': '9', 'DOMINICAN REPUBLIC': '9',
  'ECUADOR': '8', 'EGYPT': '9', 'EL SALVADOR': '9', 'ERITREA': '9',
  'ESTONIA': '6', 'ESWATINI': '9', 'ETHIOPIA': '9', 'FALKLAND ISLANDS': '9',
  'FAROE ISLANDS': '9', 'FIJI': '4', 'FINLAND': '6', 'FRANCE': '6',
  'FRENCH GUYANA': '8', 'FYROM)': '8', 'GABON': '9', 'GAMBIA': '9',
  'GEORGIA': '9', 'GERMANY': '6', 'GHANA': '9', 'GIBRALTAR': '7',
  'GREECE': '6', 'GREENLAND': '7', 'GRENADA': '9', 'GUADELOUPE': '9',
  'GUAM': '9', 'GUATEMALA': '9', 'GUINEA REPUBLIC': '9',
  'GUINEA-BISSAU': '9', 'GUINEA-EQUATORIAL': '9', 'GUYANA (BRITISH)': '8',
  'HAITI': '9', 'HONDURAS': '9', 'HONG KONG SAR CHINA': '2',
  'HUNGARY': '6', 'IS)': '7', 'INDIA': '4', 'INDONESIA': '3',
  'IRAN (ISLAMIC REPUBLIC OF': '9', 'IRAQ': '9',
  'IRELAND, REPUBLIC OF': '6', 'ISRAEL': '8', 'ITALY': '6',
  'JAMAICA': '9', 'JERSEY': '7', 'JORDAN': '9', 'KAZAKHSTAN': '9',
  'KENYA': '9', 'KIRIBATI': '9', 'KOREA, REPUBLIC OF (SOUTH': '1',
  'KOSOVO': '7', 'KUWAIT': '9', 'KYRGYZSTAN': '9',
  'LAO PEOPLES DEMOCRATIC RE': '4', 'LATVIA': '6', 'LEBANON': '9',
  'LESOTHO': '9', 'LIBERIA': '9', 'LIBYA': '9', 'LIECHTENSTEIN': '6',
  'LITHUANIA': '6', 'LUXEMBOURG': '6', 'MACAU SAR CHINA': '2',
  'MADAGASCAR': '9', 'MALAWI': '9', 'MALAYSIA': '3', 'MALDIVES': '9',
  'MALI': '9', 'MALTA': '6', 'MARSHALL ISLANDS': '9', 'MARTINIQUE': '9',
  'MAURITANIA': '9', 'MAURITIUS': '9', 'MAYOTTE': '9', 'MEXICO': '5',
  'MICRONESIA, FEDERATED STA': '4', 'MOLDOVA, REPUBLIC OF': '9',
  'MONACO': '6', 'MONGOLIA': '9', 'MONTENEGRO, REPUBLIC OF': '7',
  'MONTSERRAT': '9', 'MOROCCO': '9', 'MOZAMBIQUE': '9', 'MYANMAR': '4',
  'NAMIBIA': '9', 'NAURU, REPUBLIC OF': '9', 'NEPAL': '9',
  'NETHERLANDS, THE': '6', 'NEVIS': '9', 'NEW CALEDONIA': '9',
  'NEW ZEALAND': '4', 'NICARAGUA': '9', 'NIGER': '9', 'NIGERIA': '9',
  'NIUE': '9', 'NORTH MACEDONIA': '7', 'NORWAY': '6', 'OMAN': '9',
  'PAKISTAN': '9', 'PALAU': '9', 'PANAMA': '9', 'PAPUA NEW GUINEA': '4',
  'PARAGUAY': '8', 'PERU': '8', 'PHILIPPINES, THE': '3', 'POLAND': '6',
  'PORTUGAL': '6', 'PUERTO RICO': '9', 'QATAR': '9',
  'REUNION, ISLAND OF': '9', 'ROMANIA': '6', 'RUSSIAN FEDERATION, THE': '7',
  'RWANDA': '9', 'SAINT HELENA': '9', 'SAMOA': '9', 'SAN MARINO': '6',
  'SAO TOME AND PRINCIPE': '9', 'SAUDI ARABIA': '9', 'SENEGAL': '9',
  'SERBIA, REPUBLIC OF': '7', 'SEYCHELLES': '9', 'SIERRA LEONE': '9',
  'SINGAPORE': '3', 'SLOVAKIA': '6', 'SLOVENIA': '6',
  'SOLOMON ISLANDS': '9', 'SOMALIA': '9', 'SOMALILAND, REP OF (NORTH': '9',
  'SOUTH AFRICA': '9', 'SOUTH SUDAN': '9', 'SPAIN': '6', 'SRI LANKA': '9',
  'ST. BARTHELEMY': '9', 'ST. EUSTATIUS': '9', 'ST. KITTS': '9',
  'ST. LUCIA': '9', 'ST. MAARTEN': '9', 'ST. VINCENT': '9', 'SUDAN': '9',
  'SURINAME': '9', 'SWEDEN': '6', 'SWITZERLAND': '6', 'SYRIA': '9',
  'TAHITI': '9', 'TAIWAN': '1', 'TAJIKISTAN': '9', 'TANZANIA': '9',
  'THAILAND': '3', 'TIMOR LESTE': '9', 'TOGO': '9', 'TONGA': '9',
  'TRINIDAD AND TOBAGO': '9', 'TUNISIA': '9', 'TURKEY': '6', 'TM)': '9',
  'TURKS AND CAICOS ISLANDS': '9', 'TUVALU': '9', 'UGANDA': '9',
  'UKRAINE': '9', 'UNITED ARAB EMIRATES': '9', 'UNITED KINGDOM': '6',
  'UNITED STATES OF AMERICA': '5', 'URUGUAY': '8', 'UZBEKISTAN': '9',
  'VANUATU': '9', 'VATICAN CITY STATE': '6', 'VENEZUELA': '8',
  'VIETNAM': '3', 'VIRGIN ISLANDS (BRITISH)': '9',
  'VIRGIN ISLANDS (US)': '9', 'YEMEN, REPUBLIC OF': '9', 'ZAMBIA': '9',
  'ZIMBABWE': '9'
};

// ============================================================
// DHL 国名 → ISO2 コード上書きマップ
// 通常の正規化（小文字化・記号除去）では照合できない名称のみ列挙する
// null = スキップ（PDF 解析アーティファクト・非国家地域）
// ============================================================

var ELOGI_DHL_ISO2_OVERRIDE = {
  // PDF の行分割アーティファクト（意味のあるデータを持つ別エントリが存在する）
  'FYROM)':                     null,
  'IS)':                        null,
  'TM)':                        null,
  // 非国家地域 / 国際未承認
  'SOMALILAND, REP OF (NORTH':  null,
  'TAHITI':                     null,   // French Polynesia (PF) と重複。DHL 表記での区別不可
  'ST. EUSTATIUS':              null,   // BQ の一部。個別コードなし

  // 短縮・略称
  'ANTIGUA':                    'AG',   // Antigua and Barbuda
  'BONAIRE':                    'BQ',   // Bonaire, Sint Eustatius and Saba
  'BRUNEI':                     'BN',   // Brunei Darussalam
  'NEVIS':                      'KN',   // Saint Kitts and Nevis の一部
  'GUINEA REPUBLIC':            'GN',   // Guinea
  'GUINEA-EQUATORIAL':          'GQ',   // Equatorial Guinea
  'TIMOR LESTE':                'TL',   // Timor-Leste

  // 'ST.' 略称
  'ST. BARTHELEMY':             'BL',
  'ST. KITTS':                  'KN',
  'ST. LUCIA':                  'LC',
  'ST. MAARTEN':                'SX',
  'ST. VINCENT':                'VC',   // Saint Vincent and the Grenadines

  // 非標準の地域名
  'CANARY ISLANDS, THE':        'IC',
  'VIRGIN ISLANDS (US)':        'VI',
  'VIRGIN ISLANDS (BRITISH)':   'VG',

  // 表記差異
  'CHINA, PEOPLES REPUBLIC':    'CN',
  'HONG KONG SAR CHINA':        'HK',
  'MACAU SAR CHINA':            'MO',
  'KOREA, REPUBLIC OF (SOUTH':  'KR',
  'IRAN (ISLAMIC REPUBLIC OF':  'IR',
  'MICRONESIA, FEDERATED STA':  'FM',
  'COMMONWEALTH NO. MARIANA':   'MP',  // Northern Mariana Islands
  'CONGO, THE DEMOCRATIC REP':  'CD',
  'LAO PEOPLES DEMOCRATIC RE':  'LA',  // Laos
  'COTE D IVOIRE':              'CI',
  'FRENCH GUYANA':              'GF',  // French Guiana
  'GUYANA (BRITISH)':           'GY',
  'UNITED STATES OF AMERICA':   'US',
  'RUSSIAN FEDERATION, THE':    'RU',
  'GUINEA-BISSAU':              'GW',
  'CAPE VERDE':                 'CV',  // May also be "Cabo Verde" in master
  'CURACAO':                    'CW',
  'ESWATINI':                   'SZ',  // Formerly Swaziland
  'TAIWAN':                     'TW',
  'VATICAN CITY STATE':         'VA',
  'SAO TOME AND PRINCIPE':      'ST',
  'TURKS AND CAICOS ISLANDS':   'TC',
  'TRINIDAD AND TOBAGO':        'TT',
  'UNITED ARAB EMIRATES':       'AE',
  'SAUDI ARABIA':               'SA',
  'SOUTH AFRICA':               'ZA',
  'SOUTH SUDAN':                'SS',
  'NEW CALEDONIA':              'NC',
  'SAINT HELENA':               'SH',
  'MARSHALL ISLANDS':           'MH',
  'SRI LANKA':                  'LK',
  'PUERTO RICO':                'PR',
  'SOLOMON ISLANDS':            'SB',
  'FALKLAND ISLANDS':           'FK',
  'PAPUA NEW GUINEA':           'PG',
  'CAYMAN ISLANDS':             'KY',
  'FAROE ISLANDS':              'FO',
  'COOK ISLANDS':               'CK',
  'AMERICAN SAMOA':             'AS',
  'DOMINICAN REPUBLIC':         'DO',
  'EL SALVADOR':                'SV',
  'BURKINA FASO':               'BF',
  'CENTRAL AFRICAN REPUBLIC':   'CF',
  'COSTA RICA':                 'CR',
  'NORTH MACEDONIA':            'MK',
  'BOSNIA AND HERZEGOVINA':     'BA',
  'JERSEY':                     'JE',
  'GIBRALTAR':                  'GI',
  'GUADELOUPE':                 'GP',
  'MARTINIQUE':                 'MQ',
  'MAYOTTE':                    'YT',
  'MONTSERRAT':                 'MS',
  'NIUE':                       'NU',
  'PALAU':                      'PW',
  'TUVALU':                     'TV',
  'VANUATU':                    'VU',
  'KIRIBATI':                   'KI',
  'TONGA':                      'TO',
  'SAMOA':                      'WS',
  'REUNION, ISLAND OF':         'RE',
  'NAURU, REPUBLIC OF':         'NR',
  'MOLDOVA, REPUBLIC OF':       'MD',
  'MONTENEGRO, REPUBLIC OF':    'ME',
  'SERBIA, REPUBLIC OF':        'RS',
  'IRELAND, REPUBLIC OF':       'IE',
  'YEMEN, REPUBLIC OF':         'YE',
  'CZECH REPUBLIC, THE':        'CZ',
  'NETHERLANDS, THE':           'NL',
  'PHILIPPINES, THE':           'PH',
  'RUSSIAN FEDERATION, THE':    'RU'
};

// ============================================================
// メイン関数
// ============================================================

/**
 * eLogi DHL の配送会社・地帯・送料・超過単価を投入する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function importElogiDhlRates(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }
  if (getEnvironment() !== 'development') {
    throw new Error('importElogiDhlRates は development 環境でのみ実行できます。');
  }

  var ss  = getSpreadsheet();
  var now = new Date().toISOString();

  // --- 1. 国マスタからマッピングを構築 ---
  var countryMapping = _buildCountryMapping(ss); // 99_DevShippingRateDataImport.js に定義済み

  // --- 2. 地帯行を構築（国名 → ISO2 照合） ---
  var zonesResult   = _edhBuildZonesRows(countryMapping, now);
  var zonesRows     = zonesResult.rows;
  var unmatchedList = zonesResult.unmatched;

  if (unmatchedList.length > 40) {
    throw new Error(
      '未照合の国が40件を超えました（' + unmatchedList.length + '件）。処理を中止します。\n' +
      unmatchedList.join(', ')
    );
  }

  // --- 3. 送料行・超過単価行を構築 ---
  var ratesRows    = _edhBuildRatesRows(now);
  var unitRatesRows = _edhBuildUnitRatesRows(now);

  // --- 配送会社行 ---
  var carrierRow = {
    CARRIER_ID:         ELOGI_DHL_CARRIER_ID,
    NAME:               ELOGI_DHL_CARRIER_NAME,
    VOLUMETRIC_DIVISOR: ELOGI_DHL_VOLUMETRIC_DIVISOR,
    ROUNDING_UNIT:      ELOGI_DHL_ROUNDING_UNIT,
    ACTIVE:             true,
    REGISTERED_AT:      now,
    UPDATED_AT:         now,
    DIM_ROUNDING:       ELOGI_DHL_DIM_ROUNDING,
    WEIGHT_STEP_SMALL:  ELOGI_DHL_WEIGHT_STEP_SMALL,
    WEIGHT_STEP_LARGE:  ELOGI_DHL_WEIGHT_STEP_LARGE,
    MAX_WEIGHT:         ELOGI_DHL_MAX_WEIGHT,
    API_ENABLED:        false,
    API_ENDPOINT:       '',
    API_AUTH_KEY_NAME:  '',
    UNIT_RATE_FROM_KG:  ELOGI_DHL_UNIT_RATE_FROM_KG,
    OVERWEIGHT_METHOD:  ELOGI_DHL_OVERWEIGHT_METHOD
  };

  // --- ログ出力（料金値は出力しない） ---
  Logger.log('=== importElogiDhlRates (' + mode + ') ===');
  Logger.log('');
  Logger.log('[配送会社マスタ] 投入予定: 1件 (' + ELOGI_DHL_CARRIER_ID + ')');
  Logger.log('[地帯マスタ]     投入予定: ' + zonesRows.length + '件');
  Logger.log('[送料表マスタ]   投入予定: ' + ratesRows.length + '件');
  Logger.log('[超過単価マスタ] 投入予定: ' + unitRatesRows.length + '件');
  if (unmatchedList.length > 0) {
    Logger.log('');
    Logger.log('[未照合の国: ' + unmatchedList.length + '件]');
    unmatchedList.forEach(function(n) { Logger.log('  ' + n); });
  }

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際の書き込みは行っていません。');
    return {
      mode:           'DRY_RUN',
      carrier:        { id: ELOGI_DHL_CARRIER_ID, name: ELOGI_DHL_CARRIER_NAME },
      zones:          { count: zonesRows.length, unmatched: unmatchedList },
      rates:          { count: ratesRows.length },
      unitRates:      { count: unitRatesRows.length }
    };
  }

  // --- APPLY: 二重投入防止チェック ---
  var carriersSheet     = getCoreSchemaV1Sheet(ss, 'CARRIERS');
  var zonesSheet        = getCoreSchemaV1Sheet(ss, 'ZONES');
  var ratesSheet        = getCoreSchemaV1Sheet(ss, 'SHIPPING_RATES');
  var overweightSheet   = ss.getSheetByName(getCoreSchemaV1Table('OVERWEIGHT_UNIT_RATES').sheetName);

  if (!overweightSheet) {
    throw new Error(
      'OVERWEIGHT_UNIT_RATES シートが見つかりません。' +
      '先に setupOverweightRateMaster("APPLY") を実行してください。'
    );
  }

  // CAR-0007 の既存登録チェック
  if (_edhCarrierExists(carriersSheet)) {
    throw new Error(
      ELOGI_DHL_CARRIER_ID + ' は既に CARRIERS に登録されています。二重投入を防止するため中止します。'
    );
  }

  // ゾーン・送料の既存データチェック（CAR-0007 のデータがあれば中止）
  if (_edhCarrierDataExists(zonesSheet, 'ZONES') ||
      _edhCarrierDataExists(ratesSheet, 'SHIPPING_RATES') ||
      _edhCarrierDataExists(overweightSheet, 'OVERWEIGHT_UNIT_RATES')) {
    throw new Error(
      ELOGI_DHL_CARRIER_ID + ' のデータが既に存在します。二重投入を防止するため中止します。'
    );
  }

  // --- 採番（最大 ID を読み取り） ---
  var nextZoneNum    = _edhGetNextNum(zonesSheet,      'ZONES',              'ZON-', 'ZONE_ID');
  var nextRateNum    = _edhGetNextNum(ratesSheet,       'SHIPPING_RATES',     'RAT-', 'RATE_ID');
  var nextUnitRateNum = _edhGetNextNum(overweightSheet, 'OVERWEIGHT_UNIT_RATES', 'RPU-', 'UNIT_RATE_ID');

  // ID を付与
  zonesRows.forEach(function(r, i) {
    r.ZONE_ID = 'ZON-' + _edhPad(nextZoneNum + i);
  });
  ratesRows.forEach(function(r, i) {
    r.RATE_ID = 'RAT-' + _edhPad(nextRateNum + i);
  });
  unitRatesRows.forEach(function(r, i) {
    r.UNIT_RATE_ID = 'RPU-' + _edhPad(nextUnitRateNum + i);
  });

  // --- データ書き込み ---
  _edhWriteRows(carriersSheet,   'CARRIERS',              [carrierRow]);
  Logger.log('配送会社マスタ: 1件 書き込み完了');

  _edhWriteRows(zonesSheet,      'ZONES',                 zonesRows);
  Logger.log('地帯マスタ: ' + zonesRows.length + '件 書き込み完了');

  _edhWriteRows(ratesSheet,      'SHIPPING_RATES',        ratesRows);
  Logger.log('送料表マスタ: ' + ratesRows.length + '件 書き込み完了');

  _edhWriteRows(overweightSheet, 'OVERWEIGHT_UNIT_RATES', unitRatesRows);
  Logger.log('超過単価マスタ: ' + unitRatesRows.length + '件 書き込み完了');

  Logger.log('');
  Logger.log('APPLY 完了。');

  return {
    mode:       'APPLY',
    carrier:    { written: 1 },
    zones:      { written: zonesRows.length, unmatched: unmatchedList },
    rates:      { written: ratesRows.length },
    unitRates:  { written: unitRatesRows.length }
  };
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * DHL 国名を ISO2 コードに解決する。
 * 解決順序: 上書きマップ → 正規化して byEnglish 照合
 *
 * @param {string} dhlName - ELOGI_DHL_ZONE_DATA のキー（大文字）
 * @param {{ byEnglish: Object }} countryMapping
 * @returns {string|null|undefined}
 *   string  → ISO2 コード
 *   null    → スキップ（明示的に除外）
 *   undefined → 未照合
 */
function _edhResolveIso2(dhlName, countryMapping) {
  if (Object.prototype.hasOwnProperty.call(ELOGI_DHL_ISO2_OVERRIDE, dhlName)) {
    return ELOGI_DHL_ISO2_OVERRIDE[dhlName]; // null の場合はスキップ
  }
  var normalized = dhlName
    .toLowerCase()
    .replace(/[.,'\(\)\*]/g, '')
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+the$/, '');
  return countryMapping.byEnglish[normalized] || undefined;
}

/**
 * 地帯マスタ行データを構築する。
 * ID は採番前のため ZONE_ID は空文字（APPLY 時に付与）。
 */
function _edhBuildZonesRows(countryMapping, now) {
  var rows      = [];
  var unmatched = [];

  Object.keys(ELOGI_DHL_ZONE_DATA).forEach(function(dhlName) {
    var zone = ELOGI_DHL_ZONE_DATA[dhlName];
    var iso2 = _edhResolveIso2(dhlName, countryMapping);

    if (iso2 === null) return; // 明示スキップ
    if (iso2 === undefined) {
      unmatched.push(dhlName);
      return;
    }

    rows.push({
      ZONE_ID:      '', // APPLY 時に付与
      CARRIER_ID:   ELOGI_DHL_CARRIER_ID,
      COUNTRY_CODE: iso2,
      ZONE:         zone,
      ACTIVE:       true,
      REGISTERED_AT: now,
      UPDATED_AT:   now
    });
  });

  return { rows: rows, unmatched: unmatched };
}

/**
 * 送料表マスタ行データを構築する（60件 × 9ゾーン = 540行）。
 * minWeight = 前エントリの w（先頭は 0.0）
 * maxWeight = 当エントリの w
 */
function _edhBuildRatesRows(now) {
  var rows = [];
  ELOGI_DHL_RATES.forEach(function(entry, idx) {
    var minWeight = idx === 0 ? 0.0 : ELOGI_DHL_RATES[idx - 1].w;
    var maxWeight = entry.w;
    ELOGI_DHL_ZONE_LABELS.forEach(function(zone, zIdx) {
      rows.push({
        RATE_ID:      '', // APPLY 時に付与
        CARRIER_ID:   ELOGI_DHL_CARRIER_ID,
        ZONE:         zone,
        MIN_WEIGHT:   minWeight,
        MAX_WEIGHT:   maxWeight,
        RATE:         entry.z[zIdx],
        ACTIVE:       true,
        REGISTERED_AT: now,
        UPDATED_AT:   now,
        PACKAGE_TYPE: 'BOX'
      });
    });
  });
  return rows;
}

/**
 * 超過料金単価マスタ行データを構築する（4区分 × 9ゾーン = 36行）。
 *
 * MIN_WEIGHT の決定方針:
 *   ADD_TO_BASE の基準重量 unitRateFromKg=30.0 が ratesMap で参照できるよう、
 *   最初の単価帯の minWeight を 29.5（30.0 直前ステップ）に設定する。
 *   以降は前区分の to 値を minWeight とする。
 */
function _edhBuildUnitRatesRows(now) {
  var rows = [];
  ELOGI_DHL_UNIT_RATES.forEach(function(entry, idx) {
    var minWeight;
    if (idx === 0) {
      // ADD_TO_BASE 基準重量 (30.0) の直前ステップ
      minWeight = ELOGI_DHL_UNIT_RATE_FROM_KG - ELOGI_DHL_WEIGHT_STEP_SMALL; // 29.5
    } else {
      minWeight = ELOGI_DHL_UNIT_RATES[idx - 1].to;
    }
    var maxWeight = entry.to;
    ELOGI_DHL_ZONE_LABELS.forEach(function(zone, zIdx) {
      rows.push({
        UNIT_RATE_ID: '', // APPLY 時に付与
        CARRIER_ID:   ELOGI_DHL_CARRIER_ID,
        ZONE:         zone,
        PACKAGE_TYPE: 'BOX',
        MIN_WEIGHT:   minWeight,
        MAX_WEIGHT:   maxWeight,
        UNIT_RATE:    entry.z[zIdx],
        ACTIVE:       true,
        REGISTERED_AT: now,
        UPDATED_AT:   now
      });
    });
  });
  return rows;
}

/**
 * CARRIERS シートに CAR-0007 が既に存在するか確認する。
 */
function _edhCarrierExists(carriersSheet) {
  var table   = getCoreSchemaV1Table('CARRIERS');
  var lastCol = carriersSheet.getLastColumn();
  var lastRow = carriersSheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return false;

  var headers = carriersSheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  var pkCol = headers.indexOf(table.headers['CARRIER_ID']);
  if (pkCol < 0) return false;

  var dataRowCount = lastRow - table.headerRowNumber;
  var ids = carriersSheet
    .getRange(table.headerRowNumber + 1, pkCol + 1, dataRowCount, 1)
    .getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === ELOGI_DHL_CARRIER_ID) return true;
  }
  return false;
}

/**
 * 指定シートに CAR-0007 のデータが存在するか確認する。
 */
function _edhCarrierDataExists(sheet, tableKey) {
  var table   = getCoreSchemaV1Table(tableKey);
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return false;

  var headers = sheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  var carrierColName = table.headers['CARRIER_ID'];
  var carrierCol = headers.indexOf(carrierColName);
  if (carrierCol < 0) return false;

  var dataRowCount = lastRow - table.headerRowNumber;
  var ids = sheet
    .getRange(table.headerRowNumber + 1, carrierCol + 1, dataRowCount, 1)
    .getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === ELOGI_DHL_CARRIER_ID) return true;
  }
  return false;
}

/**
 * シートの PK 列を読み取り、次の連番を返す。
 * 例: 最大が ZON-0717 → 718 を返す
 */
function _edhGetNextNum(sheet, tableKey, prefix, pkKey) {
  var table   = getCoreSchemaV1Table(tableKey);
  var lastRow = sheet.getLastRow();
  if (lastRow < table.headerRowNumber + 1) return 1;

  var lastCol = sheet.getLastColumn();
  var headers = sheet
    .getRange(table.headerRowNumber, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function(h) { return String(h).trim(); });
  var pkColName = table.headers[pkKey];
  var pkCol = headers.indexOf(pkColName);
  if (pkCol < 0) return 1;

  var dataRowCount = lastRow - table.headerRowNumber;
  var ids = sheet
    .getRange(table.headerRowNumber + 1, pkCol + 1, dataRowCount, 1)
    .getValues();

  var maxNum = 0;
  ids.forEach(function(row) {
    var id = String(row[0] || '').trim();
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return maxNum + 1;
}

/**
 * 行データをシートに書き込む。列順は CoreSchemaRegistry のキー順に従う。
 */
function _edhWriteRows(sheet, tableKey, rows) {
  if (rows.length === 0) return;
  var headerKeys = Object.keys(getCoreSchemaV1Table(tableKey).headers);
  var values = rows.map(function(row) {
    return headerKeys.map(function(key) {
      var v = row[key];
      return v === undefined ? '' : v;
    });
  });
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, headerKeys.length).setValues(values);
}

/**
 * 連番を4桁ゼロパディングする。
 */
function _edhPad(n) {
  return ('0000' + n).slice(-4);
}
