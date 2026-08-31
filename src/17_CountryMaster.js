/**
 * 国マスタ管理・電話番号正規化・住所長さ監査
 * PR16: country-master
 */

// ============================================================
// 国データ定義 [ISO2, 国名（表示）, 国番号, トランク0除去, 有効, 州必須, 郵便番号必須]
// 国名（表示）: 英語短縮名・昇順
// トランク0除去=FALSE: 国際ダイヤルでもトランク0を保持（イタリア等）
// 州必須: US, CA のみ TRUE
// 郵便番号必須: FedEx基準
// ============================================================
const COUNTRY_DATA = [
  ['AF', 'Afghanistan',                           '93',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AX', 'Aland Islands',                         '358',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AL', 'Albania',                               '355',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['DZ', 'Algeria',                               '213',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AS', 'American Samoa',                        '1684', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AD', 'Andorra',                               '376',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['AO', 'Angola',                                '244',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AI', 'Anguilla',                              '1264', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AQ', 'Antarctica',                            '672',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AG', 'Antigua and Barbuda',                   '1268', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AR', 'Argentina',                             '54',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['AM', 'Armenia',                               '374',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AW', 'Aruba',                                 '297',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['AU', 'Australia',                             '61',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['AT', 'Austria',                               '43',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['AZ', 'Azerbaijan',                            '994',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BS', 'Bahamas',                               '1242', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BH', 'Bahrain',                               '973',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BD', 'Bangladesh',                            '880',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BB', 'Barbados',                              '1246', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BY', 'Belarus',                               '375',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BE', 'Belgium',                               '32',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BZ', 'Belize',                                '501',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BJ', 'Benin',                                 '229',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BM', 'Bermuda',                               '1441', 'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BT', 'Bhutan',                                '975',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BO', 'Bolivia',                               '591',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BQ', 'Bonaire',                               '599',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BA', 'Bosnia and Herzegovina',                '387',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BW', 'Botswana',                              '267',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BV', 'Bouvet Island',                         '47',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BR', 'Brazil',                                '55',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['IO', 'British Indian Ocean Territory',        '246',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BN', 'Brunei',                                '673',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BG', 'Bulgaria',                              '359',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['BF', 'Burkina Faso',                          '226',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BI', 'Burundi',                               '257',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CV', 'Cabo Verde',                            '238',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KH', 'Cambodia',                              '855',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['CM', 'Cameroon',                              '237',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CA', 'Canada',                                '1',    'TRUE', 'TRUE', 'TRUE',  'TRUE'],
  ['KY', 'Cayman Islands',                        '1345', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CF', 'Central African Republic',              '236',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TD', 'Chad',                                  '235',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CL', 'Chile',                                 '56',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CN', 'China',                                 '86',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['CX', 'Christmas Island',                      '61',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CC', 'Cocos (Keeling) Islands',               '61',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CO', 'Colombia',                              '57',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['KM', 'Comoros',                               '269',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CG', 'Congo',                                 '242',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CD', 'Congo (Dem. Rep.)',                     '243',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CK', 'Cook Islands',                          '682',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CR', 'Costa Rica',                            '506',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['CI', "Cote d'Ivoire",                         '225',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['HR', 'Croatia',                               '385',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['CU', 'Cuba',                                  '53',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CW', 'Curacao',                               '599',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CY', 'Cyprus',                                '357',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['CZ', 'Czechia',                               '420',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['DK', 'Denmark',                               '45',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['DJ', 'Djibouti',                              '253',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['DM', 'Dominica',                              '1767', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['DO', 'Dominican Republic',                    '1809', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['EC', 'Ecuador',                               '593',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['EG', 'Egypt',                                 '20',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SV', 'El Salvador',                           '503',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GQ', 'Equatorial Guinea',                     '240',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ER', 'Eritrea',                               '291',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['EE', 'Estonia',                               '372',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SZ', 'Eswatini',                              '268',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ET', 'Ethiopia',                              '251',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['FK', 'Falkland Islands',                      '500',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['FO', 'Faroe Islands',                         '298',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['FJ', 'Fiji',                                  '679',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['FI', 'Finland',                               '358',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['FR', 'France',                                '33',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['GF', 'French Guiana',                         '594',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PF', 'French Polynesia',                      '689',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TF', 'French Southern Territories',           '262',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GA', 'Gabon',                                 '241',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GM', 'Gambia',                                '220',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GE', 'Georgia',                               '995',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['DE', 'Germany',                               '49',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['GH', 'Ghana',                                 '233',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GI', 'Gibraltar',                             '350',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GR', 'Greece',                                '30',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['GL', 'Greenland',                             '299',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['GD', 'Grenada',                               '1473', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GP', 'Guadeloupe',                            '590',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GU', 'Guam',                                  '1671', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GT', 'Guatemala',                             '502',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GG', 'Guernsey',                              '44',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GN', 'Guinea',                                '224',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GW', 'Guinea-Bissau',                         '245',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GY', 'Guyana',                                '592',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['HT', 'Haiti',                                 '509',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['HM', 'Heard & McDonald Islands',              '672',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['VA', 'Holy See',                              '379',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['HN', 'Honduras',                              '504',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['HK', 'Hong Kong',                             '852',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['HU', 'Hungary',                               '36',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['IS', 'Iceland',                               '354',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['IN', 'India',                                 '91',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['ID', 'Indonesia',                             '62',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['IR', 'Iran',                                  '98',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['IQ', 'Iraq',                                  '964',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['IE', 'Ireland',                               '353',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['IM', 'Isle of Man',                           '44',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['IL', 'Israel',                                '972',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['IT', 'Italy',                                 '39',   'FALSE','TRUE', 'FALSE', 'TRUE'],
  ['JM', 'Jamaica',                               '1876', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['JP', 'Japan',                                 '81',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['JE', 'Jersey',                                '44',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['JO', 'Jordan',                                '962',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KZ', 'Kazakhstan',                            '7',    'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['KE', 'Kenya',                                 '254',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KI', 'Kiribati',                              '686',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KP', 'Korea (North)',                          '850',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KR', 'Korea (South)',                          '82',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['XK', 'Kosovo',                                '383',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KW', 'Kuwait',                                '965',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KG', 'Kyrgyzstan',                            '996',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['LA', 'Laos',                                  '856',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['LV', 'Latvia',                                '371',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['LB', 'Lebanon',                               '961',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['LS', 'Lesotho',                               '266',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['LR', 'Liberia',                               '231',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['LY', 'Libya',                                 '218',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['LI', 'Liechtenstein',                         '423',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['LT', 'Lithuania',                             '370',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['LU', 'Luxembourg',                            '352',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MO', 'Macao',                                 '853',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MG', 'Madagascar',                            '261',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MW', 'Malawi',                                '265',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MY', 'Malaysia',                              '60',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MV', 'Maldives',                              '960',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['ML', 'Mali',                                  '223',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MT', 'Malta',                                 '356',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MH', 'Marshall Islands',                      '692',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MQ', 'Martinique',                            '596',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MR', 'Mauritania',                            '222',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MU', 'Mauritius',                             '230',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['YT', 'Mayotte',                               '262',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MX', 'Mexico',                                '52',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['FM', 'Micronesia',                            '691',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MD', 'Moldova',                               '373',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MC', 'Monaco',                                '377',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MN', 'Mongolia',                              '976',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ME', 'Montenegro',                            '382',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MS', 'Montserrat',                            '1664', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MA', 'Morocco',                               '212',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MZ', 'Mozambique',                            '258',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MM', 'Myanmar',                               '95',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['NA', 'Namibia',                               '264',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NR', 'Nauru',                                 '674',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NP', 'Nepal',                                 '977',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['NL', 'Netherlands',                           '31',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['NC', 'New Caledonia',                         '687',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NZ', 'New Zealand',                           '64',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['NI', 'Nicaragua',                             '505',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NE', 'Niger',                                 '227',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NG', 'Nigeria',                               '234',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NU', 'Niue',                                  '683',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NF', 'Norfolk Island',                        '672',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MK', 'North Macedonia',                       '389',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['MP', 'Northern Mariana Islands',              '1670', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['NO', 'Norway',                                '47',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['OM', 'Oman',                                  '968',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PK', 'Pakistan',                              '92',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['PW', 'Palau',                                 '680',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PS', 'Palestine',                             '970',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PA', 'Panama',                                '507',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PG', 'Papua New Guinea',                      '675',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PY', 'Paraguay',                              '595',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PE', 'Peru',                                  '51',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['PH', 'Philippines',                           '63',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['PN', 'Pitcairn Islands',                      '64',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PL', 'Poland',                                '48',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['PT', 'Portugal',                              '351',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['PR', 'Puerto Rico',                           '1787', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['QA', 'Qatar',                                 '974',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['RE', 'Reunion',                               '262',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['RO', 'Romania',                               '40',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['RU', 'Russia',                                '7',    'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['RW', 'Rwanda',                                '250',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['BL', 'Saint Barthelemy',                      '590',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SH', 'Saint Helena',                          '290',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['KN', 'Saint Kitts and Nevis',                 '1869', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['LC', 'Saint Lucia',                           '1758', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['MF', 'Saint Martin',                          '590',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['PM', 'Saint Pierre and Miquelon',             '508',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['VC', 'Saint Vincent and the Grenadines',      '1784', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['WS', 'Samoa',                                 '685',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SM', 'San Marino',                            '378',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ST', 'Sao Tome and Principe',                 '239',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SA', 'Saudi Arabia',                          '966',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SN', 'Senegal',                               '221',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['RS', 'Serbia',                                '381',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SC', 'Seychelles',                            '248',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SL', 'Sierra Leone',                          '232',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SG', 'Singapore',                             '65',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SX', 'Sint Maarten',                          '1721', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SK', 'Slovakia',                              '421',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SI', 'Slovenia',                              '386',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SB', 'Solomon Islands',                       '677',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SO', 'Somalia',                               '252',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ZA', 'South Africa',                          '27',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['GS', 'South Georgia and S. Sandwich Islands', '500',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SS', 'South Sudan',                           '211',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ES', 'Spain',                                 '34',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['LK', 'Sri Lanka',                             '94',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SD', 'Sudan',                                 '249',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SR', 'Suriname',                              '597',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SJ', 'Svalbard and Jan Mayen',                '47',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['SE', 'Sweden',                                '46',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['CH', 'Switzerland',                           '41',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['SY', 'Syria',                                 '963',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TW', 'Taiwan',                                '886',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['TJ', 'Tajikistan',                            '992',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TZ', 'Tanzania',                              '255',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TH', 'Thailand',                              '66',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['TL', 'Timor-Leste',                           '670',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TG', 'Togo',                                  '228',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TK', 'Tokelau',                               '690',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TO', 'Tonga',                                 '676',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TT', 'Trinidad and Tobago',                   '1868', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TN', 'Tunisia',                               '216',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['TR', 'Turkey',                                '90',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['TM', 'Turkmenistan',                          '993',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TC', 'Turks and Caicos Islands',              '1649', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['TV', 'Tuvalu',                                '688',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['UG', 'Uganda',                                '256',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['UA', 'Ukraine',                               '380',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['AE', 'United Arab Emirates',                  '971',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['GB', 'United Kingdom',                        '44',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['US', 'United States',                         '1',    'TRUE', 'TRUE', 'TRUE',  'TRUE'],
  ['UM', 'United States Minor Outlying Islands',  '1',    'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['UY', 'Uruguay',                               '598',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['UZ', 'Uzbekistan',                            '998',  'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['VU', 'Vanuatu',                               '678',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['VE', 'Venezuela',                             '58',   'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['VN', 'Vietnam',                               '84',   'TRUE', 'TRUE', 'FALSE', 'TRUE'],
  ['VG', 'Virgin Islands (British)',              '1284', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['VI', 'Virgin Islands (U.S.)',                 '1340', 'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['WF', 'Wallis and Futuna',                     '681',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['EH', 'Western Sahara',                        '212',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['YE', 'Yemen',                                 '967',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ZM', 'Zambia',                                '260',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
  ['ZW', 'Zimbabwe',                              '263',  'TRUE', 'TRUE', 'FALSE', 'FALSE'],
];

// ============================================================
// 1. seedCountryMaster()
// ============================================================

/**
 * 「国マスタ」タブ新設・全250カ国地域をシード（冪等）
 * @param {string} [forceArg] - 'RESEED' を渡すと既存データ行を削除して再シード
 */
function seedCountryMaster(forceArg) {
  const ss = getSpreadsheet();
  const sheetName = '国マスタ';
  let sh = ss.getSheetByName(sheetName);
  const isReseed = String(forceArg || '').trim().toUpperCase() === 'RESEED';

  if (sh && sh.getLastRow() > 1) {
    if (!isReseed) {
      return '国マスタ: 既存（' + (sh.getLastRow() - 1) + '行）。スキップ。再シードするには seedCountryMaster("RESEED") を実行してください。';
    }
    // RESEED: データ行を全削除
    const lastRow = sh.getLastRow();
    if (lastRow > 1) {
      sh.deleteRows(2, lastRow - 1);
    }
  }

  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }

  const headers = ['country_code', 'display_name', '国番号', 'トランク0除去', '有効', '州必須', '郵便番号必須'];
  const headerRange = sh.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1565c0');
  headerRange.setFontColor('#ffffff');
  sh.setFrozenRows(1);

  sh.getRange(2, 1, COUNTRY_DATA.length, COUNTRY_DATA[0].length).setValues(COUNTRY_DATA);

  sh.setColumnWidth(1, 80);
  sh.setColumnWidth(2, 210);
  sh.setColumnWidth(3, 80);
  sh.setColumnWidth(4, 110);
  sh.setColumnWidth(5, 55);
  sh.setColumnWidth(6, 70);
  sh.setColumnWidth(7, 110);

  const falseCount = COUNTRY_DATA.filter(function(r) { return r[3] === 'FALSE'; }).length;
  const stateCount  = COUNTRY_DATA.filter(function(r) { return r[5] === 'TRUE'; }).length;
  const postalCount = COUNTRY_DATA.filter(function(r) { return r[6] === 'TRUE'; }).length;

  return [
    '国マスタ: ' + COUNTRY_DATA.length + '件をシード完了' + (isReseed ? '（RESEED）' : ''),
    'トランク0除去=FALSE（保持国）: ' + falseCount + '件 — ' +
      COUNTRY_DATA.filter(function(r){ return r[3]==='FALSE'; }).map(function(r){ return r[1]+'('+r[0]+')'; }).join(', '),
    '州必須=TRUE: ' + stateCount + '件',
    '郵便番号必須=TRUE: ' + postalCount + '件'
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
/**
 * 電話番号を正規化し E.164・国番号・ナショナル番号に分解して返す
 * @param {string} countryName - 国名（表示）
 * @param {string} raw         - 入力電話番号
 * @returns {{value: string, dialCode: string, national: string, flag: string}}
 *   value:    E.164形式 '+81312345678'（検証・表示用）
 *   dialCode: 国番号桁のみ '81'（国番号列に格納）
 *   national: ナショナル番号 '312345678'（電話番号列に格納）
 *   flag:     '✓' | '空欄' | '要確認(…)'
 */
function normalizePhone(countryName, raw) {
  const rawStr = String(raw || '').trim();
  if (!rawStr) return { value: '', dialCode: '', national: '', flag: '空欄' };

  // 国マスタ引き
  const ss = getSpreadsheet();
  const msh = ss.getSheetByName('国マスタ');
  let countryCode = null, trunkRemove = true;
  if (msh) {
    const mData = msh.getDataRange().getValues();
    const mh = mData[0];
    const nameIdx  = mh.indexOf('display_name');
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

  /** E.164 文字列から dialCode・national を抽出するヘルパー */
  function splitE164(e164str, cc) {
    // e164str = '+81312345678', cc = '81'
    var digits = e164str.charAt(0) === '+' ? e164str.slice(1) : e164str;
    if (cc && digits.startsWith(cc)) {
      return { dialCode: cc, national: digits.slice(cc.length) };
    }
    return { dialCode: '', national: digits };
  }

  // ---- +始まり（E.164 候補） ----
  if (cleaned.charAt(0) === '+') {
    const digits = cleaned.slice(1);
    if (!/^\d+$/.test(digits)) {
      return { value: rawStr, dialCode: '', national: rawStr, flag: '要確認(非数字)' };
    }
    if (countryCode && !digits.startsWith(countryCode)) {
      return { value: cleaned, dialCode: '', national: digits, flag: '要確認(国番号不一致)' };
    }
    if (digits.length < 7 || digits.length > 15) {
      return { value: cleaned, dialCode: countryCode || '', national: digits, flag: '要確認(桁数異常:' + digits.length + ')' };
    }
    var sp1 = splitE164(cleaned, countryCode);
    return { value: cleaned, dialCode: sp1.dialCode, national: sp1.national, flag: '✓' };
  }

  // ---- 00始まり（国際プレフィックス） ----
  if (cleaned.startsWith('00')) {
    const digits = cleaned.slice(2);
    if (!/^\d+$/.test(digits)) {
      return { value: rawStr, dialCode: '', national: rawStr, flag: '要確認(非数字)' };
    }
    const e164cc = '+' + digits;
    if (digits.length < 7 || digits.length > 15) {
      return { value: e164cc, dialCode: '', national: digits, flag: '要確認(桁数異常:' + digits.length + ')' };
    }
    var sp2 = splitE164(e164cc, countryCode);
    return { value: e164cc, dialCode: sp2.dialCode, national: sp2.national, flag: '✓' };
  }

  // ---- 国内形式 ----
  if (!countryCode) {
    return { value: rawStr, dialCode: '', national: cleaned, flag: '要確認(国不明)' };
  }
  if (!/^\d+$/.test(cleaned)) {
    return { value: rawStr, dialCode: '', national: cleaned, flag: '要確認(非数字)' };
  }

  var national = cleaned;
  if (cleaned.charAt(0) === '0' && trunkRemove) {
    national = cleaned.slice(1);  // トランク0除去
  }
  // trunkRemove=FALSE（イタリア等）→ 0 をそのまま保持

  var totalDigits = countryCode.length + national.length;
  var e164 = '+' + countryCode + national;
  if (totalDigits < 7 || totalDigits > 15) {
    return { value: e164, dialCode: countryCode, national: national, flag: '要確認(桁数異常:' + totalDigits + ')' };
  }
  return { value: e164, dialCode: countryCode, national: national, flag: '✓' };
}

// ============================================================
// 3. testNormalizePhone()
// ============================================================

/**
 * normalizePhone の12ケーステスト
 * 全件突合して PASS/FAIL を報告
 */
function testNormalizePhone() {
  // [id, countryName, raw, expectValue, expectFlag, expectDialCode, expectNational]
  // expectDialCode/expectNational が null = エラーケースのためスキップ
  var CASES = [
    ['01', 'Japan',         '03-1234-5678',    '+81312345678',  '✓',                    '81', '312345678'],
    ['02', 'Japan',         '312345678',        '+81312345678',  '✓',                    '81', '312345678'],
    ['03', 'United States', '+12125551234',      '+12125551234',  '✓',                    '1',  '2125551234'],
    ['04', 'United States', '0012125551234',     '+12125551234',  '✓',                    '1',  '2125551234'],
    ['05', 'Japan',         '03 1234 5678',      '+81312345678',  '✓',                    '81', '312345678'],
    ['06', 'Japan',         '(03).1234-5678',    '+81312345678',  '✓',                    '81', '312345678'],
    ['07', 'Japan',         '+442071234567',      '+442071234567', '要確認(国番号不一致)', null, null],
    ['08', 'Japan',         '+8112',             '+8112',         '要確認(桁数異常:4)',   null, null],
    ['09', 'Italy',         '06-12345678',       '+390612345678', '✓',                    '39', '0612345678'],
    ['10', 'Japan',         '',                  '',              '空欄',                 '',   ''],
    ['11', 'Japan',         '+81312345678',      '+81312345678',  '✓',                    '81', '312345678'],
    ['12', 'Japan',         '0-1-2',             '+8112',         '要確認(桁数異常:4)',   null, null]
  ];

  var lines = ['=== testNormalizePhone ==='];
  var pass = 0, fail = 0;

  CASES.forEach(function(c) {
    var id = c[0], country = c[1], raw = c[2];
    var expectValue = c[3], expectFlag = c[4], expectDial = c[5], expectNat = c[6];
    var result = normalizePhone(country, raw);
    var valueOk = (result.value    === expectValue);
    var flagOk  = (result.flag     === expectFlag);
    var dialOk  = (expectDial === null) || (result.dialCode === expectDial);
    var natOk   = (expectNat  === null) || (result.national === expectNat);
    var ok = valueOk && flagOk && dialOk && natOk;
    if (ok) { pass++; } else { fail++; }
    var detail = '';
    if (!ok) {
      detail = '\n  期待: value=' + expectValue + ' flag=' + expectFlag;
      if (expectDial !== null) detail += ' dialCode=' + expectDial + ' national=' + expectNat;
      detail += '\n  実際: value=' + result.value + ' flag=' + result.flag +
                ' dialCode=' + result.dialCode + ' national=' + result.national;
    } else if (expectDial !== null) {
      detail = '\n  dialCode=' + result.dialCode + ' national=' + result.national;
    }
    lines.push((ok ? '✓' : '✗') + ' [' + id + '] ' + country + ' / "' + raw + '"' + detail);
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
    { key: CONFIG.SHEETS.CRM_PAYMENT,  addrCols: ['Address 1', 'Address 2', 'Address 3'] }
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
 *
 * 欄種別許容セット:
 *   名前系（顧客名・宛名・請求名義）: 半角英数 + , . - # / ' ( ) & スペース
 *   住所系（Address1-3, City, State）: 半角英数 + , . - # / ' スペース
 *                                      + Latin-1 Supplement (U+00C0-U+00FF) 欧州アクセント文字
 *
 * @returns {string} 実行ログ
 */
function auditAddressCharset() {
  var ss = getSpreadsheet();
  // 名前系: 半角英数 + , . - # / ' スペース + ( ) &
  var ALLOWED_NAME = /^[A-Za-z0-9\s,.\-#\/'()&]*$/;
  // 住所系 ASCII 基本セット
  var ALLOWED_ADDR_BASE = /^[A-Za-z0-9\s,.\-#\/']*$/;
  // 名前系欄のセット
  var NAME_COLS = ['顧客名', '宛名', '請求名義'];

  // 住所系: 1文字が許容か（ASCII基本セット OR Latin-1補助 U+00C0-U+00FF）
  function _isAddrCharOk(c) {
    if (ALLOWED_ADDR_BASE.test(c)) return true;
    var code = c.charCodeAt(0);
    return code >= 192 && code <= 255; // U+00C0 = 192, U+00FF = 255
  }

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

      var isNameCol = NAME_COLS.indexOf(col) >= 0;

      data.slice(1).forEach(function(row, ri) {
        var val = String(row[colIdx] || '');
        if (val === '') return;

        var ok = isNameCol
          ? ALLOWED_NAME.test(val)
          : val.split('').every(function(c) { return _isAddrCharOk(c); });

        if (!ok) {
          sheetFound++;
          total++;
          var bad = val.split('').filter(function(c) {
            return isNameCol ? !ALLOWED_NAME.test(c) : !_isAddrCharOk(c);
          });
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

  var isoIdx = h.indexOf('country_code');
  if (isoIdx < 0) return 'ERROR: country_code 列が見つかりません';

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
