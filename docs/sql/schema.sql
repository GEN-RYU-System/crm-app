-- GEN-RYU CRM — PostgreSQL DDL（段階3）
-- 生成日: 2026-09-03
-- 根拠ファイル:
--   src/00_CoreSchemaRegistry.js          (論理列名・PK・FK の正本)
--   docs/postgres-migration-analysis.md   (型・nonEmpty・サンプル行数の実測値)
--   docs/sql-migration-scope.md           (22 テーブルスコープ確定)
-- PO 判断: 全項目(a)採用（docs/sql/schema-notes.md §3 参照）
--
-- 命名規則
--   テーブル名  : CoreSchemaRegistry 論理キー → lowercase snake_case
--   列名        : CoreSchemaRegistry 論理キー → lowercase snake_case
--   外部キー名  : fk_<参照元テーブル>_<参照先テーブル>[_<識別子>]
--   インデックス: idx_<テーブル>_<列>
--
-- NOT NULL 付与基準
--   nonEmpty = 分析行 (100%) かつ サンプル行数 ≥ 5 の場合のみ付与
--   PK 列は常に NOT NULL
--
-- ON DELETE 方針
--   CASCADE : line item（order_lines→orders, quote_lines→quotes,
--             shipments→orders, purchases→orders）
--   RESTRICT: その他の FK すべて
--
-- 除外テーブル
--   shared_inventory（共用在庫）: primaryKey: null のため DDL 除外
--   → docs/sql/schema-notes.md §4 に記録
--
-- 22 テーブルスコープ中 21 テーブルを CREATE。残り 1 件（shared_inventory）は除外。

BEGIN;

-- ============================================================
-- Level 0: 参照されるのみ（外部キーなし）
-- ============================================================

CREATE TABLE countries (
    country_code     TEXT    NOT NULL,   -- 100/100, 256行
    display_name     TEXT    NOT NULL,   -- 100/100
    name_ja          TEXT    NOT NULL,   -- 100/100
    country_number   INTEGER NOT NULL,   -- 100/100, sample: 93/358/355
    strip_trunk_zero BOOLEAN NOT NULL,   -- 100/100
    is_active        BOOLEAN NOT NULL,   -- 100/100
    state_required   BOOLEAN NOT NULL,   -- 100/100
    zip_required     BOOLEAN NOT NULL,   -- 100/100
    CONSTRAINT pk_countries PRIMARY KEY (country_code)
);

CREATE TABLE currencies (
    currency_code TEXT          NOT NULL,   -- 5/5, 5行
    symbol        TEXT          NOT NULL,   -- 5/5
    name          TEXT          NOT NULL,   -- 5/5
    rate_to_jpy   NUMERIC(15,6) NOT NULL,   -- 5/5, hasDecimal
    is_active     BOOLEAN       NOT NULL,   -- 5/5
    CONSTRAINT pk_currencies PRIMARY KEY (currency_code)
);

CREATE TABLE lead_sources (
    source_id     TEXT    NOT NULL,   -- 9/9, 9行
    name          TEXT    NOT NULL,   -- 9/9
    is_inbound    BOOLEAN NOT NULL,   -- 9/9
    is_outbound   BOOLEAN NOT NULL,   -- 9/9
    is_active     BOOLEAN NOT NULL,   -- 9/9
    display_order INTEGER NOT NULL,   -- 9/9
    CONSTRAINT pk_lead_sources PRIMARY KEY (source_id)
);

CREATE TABLE settings (
    setting_key   TEXT        NOT NULL,   -- PK
    setting_value TEXT,                   -- 型混在列（number/boolean）→ 文字列統一済み（2026-09-02）
    value_type    TEXT,                   -- 3行のみのため NOT NULL 非付与
    description   TEXT,
    updated_at    TIMESTAMPTZ,            -- GAS では ISO 文字列として格納。移行時に型変換が必要
    CONSTRAINT pk_settings PRIMARY KEY (setting_key)
);

CREATE TABLE option_master (
    option_id  TEXT    NOT NULL,   -- CoreSchemaV1.OPTION_MASTER
    category   TEXT,               -- 分析データなし（SHEET_NOT_FOUND のため）
    value      TEXT,
    sort_order INTEGER,
    is_active  BOOLEAN,
    CONSTRAINT pk_option_master PRIMARY KEY (option_id)
);
-- 注: 旧「選択肢マスタ」(36列) は DEV 環境不在。「選択肢マスタV2」(OPTION_MASTER, 5列) を移行対象とする（PO判断A(a)）

CREATE TABLE ip_works (
    ip_id     TEXT    NOT NULL,   -- 11/11, 11行
    title     TEXT    NOT NULL,   -- 11/11 (作品名)
    alias     TEXT    NOT NULL,   -- 11/11 (別名)
    is_active BOOLEAN NOT NULL,   -- 11/11 (有効)
    CONSTRAINT pk_ip_works PRIMARY KEY (ip_id)
);
-- 注: CoreSchemaV1 未登録。分析では ip_id が全 11 行で一意のため PK として定義。
--     Registry の primaryKey: null は「GAS スプレッドシート上の PK 管理なし」を意味するが、
--     実データは一意。PO判断D(a): SQL 移行に際して ip_id を PK に採用。

CREATE TABLE issuers (
    issuer_id       TEXT    NOT NULL,
    company_name    TEXT,               -- 1行のみのため全列 NOT NULL 非付与
    contact_name    TEXT,
    address_line_1  TEXT,
    address_line_2  TEXT,
    address_line_3  TEXT,
    city            TEXT,
    state           TEXT,
    zip             TEXT,               -- GAS では number (7桁整数)。郵便番号のため TEXT で格納
    country         TEXT,
    phone           TEXT,
    email           TEXT,
    registration_no TEXT,               -- T+13桁（インボイス登録番号形式）
    payee_name      TEXT,
    payment_email   TEXT,
    note            TEXT,               -- Registry 論理キー PAYMENT_NOTE
    closing_message TEXT,
    is_active       BOOLEAN,
    CONSTRAINT pk_issuers PRIMARY KEY (issuer_id)
);

-- ============================================================
-- Level 1: Level 0 テーブルのみを参照
-- ============================================================

CREATE TABLE staff (
    staff_id                       TEXT        NOT NULL,
    last_name_ja                   TEXT        NOT NULL,   -- 8/8, 8行
    first_name_ja                  TEXT        NOT NULL,   -- 8/8
    full_name_ja                   TEXT,                   -- 6/8
    last_name_kana                 TEXT,                   -- 7/8
    first_name_kana                TEXT,                   -- 7/8
    last_name_en                   TEXT,                   -- 7/8
    first_name_en                  TEXT,                   -- 7/8
    email                          TEXT,                   -- 7/8
    discord_id                     TEXT,                   -- 3/8
    staff_role                     TEXT        NOT NULL,   -- 8/8 (Registry: ROLE → physical: staff_role)
    status                         TEXT        NOT NULL,   -- 8/8
    source_candidate_id            TEXT,                   -- 0/8 (unmanagedReferenceId, 親テーブルはスコープ外)
    dark_mode                      BOOLEAN,                -- 5/8
    chat_menu_visible              BOOLEAN,                -- 4/8
    sales_menu_visible             BOOLEAN,                -- 4/8
    settings_menu_visible          BOOLEAN,                -- 4/8
    admin_menu_visible             BOOLEAN,                -- 4/8
    buddy_maintenance_menu_visible BOOLEAN,                -- 4/8
    sidebar_visible                BOOLEAN,                -- 4/8
    password_hash                  TEXT        NOT NULL,   -- 8/8
    password_salt                  TEXT        NOT NULL,   -- 8/8
    login_fail_count               INTEGER     NOT NULL,   -- 8/8, sample: 0
    locked_until                   TIMESTAMPTZ,            -- 0/8
    CONSTRAINT pk_staff PRIMARY KEY (staff_id)
);

CREATE TABLE products (
    product_id              TEXT          NOT NULL,
    category                TEXT          NOT NULL,   -- 100/100, 267行
    mark                    TEXT          NOT NULL,   -- 100/100
    japanese_title          TEXT          NOT NULL,   -- 100/100
    english_title           TEXT          NOT NULL,   -- 100/100
    boxes_per_case          NUMERIC(15,2),            -- ★MIXED("-"→NULL): PO判断G(a)
    packs_per_box           NUMERIC(15,2),            -- ★MIXED("-"→NULL)
    volume_weight           NUMERIC(15,2),            -- 0/100
    box_weight              NUMERIC(15,2),            -- 96/100, hasDecimal
    case_weight             NUMERIC(15,2),            -- ★MIXED("-"→NULL)
    release_date            DATE          NOT NULL,   -- 100/100
    search_keywords         TEXT          NOT NULL,   -- 100/100
    exclude_keywords        TEXT,                     -- 18/100
    related_series          TEXT,                     -- 98/100
    category_classification TEXT          NOT NULL,   -- 100/100
    required_output_value   TEXT,                     -- 98/100
    moq                     INTEGER,                  -- 11/100
    item                    TEXT          NOT NULL,   -- 100/100 (品目)
    hs_code                 BIGINT        NOT NULL,   -- 100/100, 10桁数値
    material                TEXT          NOT NULL,   -- 100/100 (素材)
    major_category_id       TEXT          NOT NULL,   -- 100/100 (unmanagedRef: 親テーブルはスコープ外)
    work_id                 TEXT          NOT NULL,   -- 100/100 (unmanagedRef)
    manufacturer_id         TEXT          NOT NULL,   -- 100/100 (unmanagedRef)
    product_category_id     TEXT          NOT NULL,   -- 100/100 (unmanagedRef)
    CONSTRAINT pk_products PRIMARY KEY (product_id)
);
-- 注: major_category_id / work_id / manufacturer_id / product_category_id は
--     PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1 のため FK 制約なし

-- ============================================================
-- Level 2: leads（staff・lead_sources・leads 自己参照）
-- ============================================================

CREATE TABLE leads (
    -- CoreSchemaRegistry 登録 51 列
    lead_id                       TEXT          NOT NULL,
    registered_at                 TIMESTAMPTZ   NOT NULL,   -- 10/10, 10行
    customer_name                 TEXT          NOT NULL,   -- 10/10
    deal_result                   TEXT,                     -- 7/10
    english_call_name             TEXT          NOT NULL,   -- 10/10
    country                       TEXT          NOT NULL,   -- 10/10
    sheet_updated_at              TIMESTAMPTZ,              -- 0/10
    lead_assignee_name            TEXT,                     -- 0/10
    lead_type                     TEXT,                     -- 0/10
    lead_source                   TEXT,                     -- 0/10
    lead_source_id                TEXT,                     -- 0/10, FK → lead_sources
    message_url                   TEXT,                     -- 0/10
    handled_title                 TEXT,                     -- 0/10
    ip_ids                        TEXT,                     -- 0/10 (複数 ip_id をカンマ区切りで保持)
    cs_note                       TEXT,                     -- 0/10
    email                         TEXT          NOT NULL,   -- 10/10
    phone                         TEXT,                     -- 0/10
    contact_method                TEXT          NOT NULL,   -- 10/10
    temperature                   TEXT          NOT NULL,   -- 10/10 (高/中/低 等)
    expected_scale                TEXT,                     -- 0/10
    response_speed                TEXT,                     -- 0/10
    inquiry_count                 INTEGER,                  -- 0/10
    archived_at                   TIMESTAMPTZ,              -- 0/10
    archive_reason                TEXT,                     -- 0/10
    assigned_at                   TIMESTAMPTZ,              -- 0/10
    sales_assignee_id             TEXT          NOT NULL,   -- 10/10, FK → staff
    assignee_id                   TEXT,                     -- 0/10, FK → staff
    customer_type                 TEXT,                     -- 0/10
    last_responder_id             TEXT,                     -- 0/10, FK → staff
    prospect_score                INTEGER,                  -- 0/10
    next_action                   TEXT,                     -- 0/10
    next_action_date              DATE,                     -- 0/10
    deal_note                     TEXT,                     -- 0/10
    customer_issue                TEXT,                     -- 0/10
    sales_channel                 TEXT,                     -- 0/10
    monthly_expected_amount       NUMERIC(15,2),            -- 0/10
    competitor_comparison         TEXT,                     -- 0/10
    alert_confirmed_at            TIMESTAMPTZ,              -- 0/10
    exclusion_reason              TEXT,                     -- 0/10
    loss_reason                   TEXT,                     -- 1/10
    first_transaction_date        DATE,                     -- 0/10
    first_transaction_amount      NUMERIC(15,2),            -- 0/10
    cumulative_transaction_amount NUMERIC(15,2),            -- 0/10
    conversation_summary          TEXT,                     -- 0/10
    last_conversation_at          TIMESTAMPTZ,              -- 0/10
    conversation_count            INTEGER,                  -- 0/10
    duplicate_flag                BOOLEAN,                  -- 0/10
    duplicate_source_lead_id      TEXT,                     -- 0/10, FK → leads (自己参照)
    duplicate_confirmed_at        TIMESTAMPTZ,              -- 0/10
    duplicate_confirmed_by        TEXT,                     -- 0/10
    lead_status                   TEXT          NOT NULL,   -- 10/10
    -- PO判断B(a): LEADS +13 列（Buddy/商談レポート機能）をSQL移行
    lead_progress                 TEXT,                     -- リード進捗
    deal_progress                 TEXT,                     -- 商談進捗
    order_amount_per_session      NUMERIC(15,2),            -- 1回の発注金額
    purchase_frequency_monthly    NUMERIC(15,2),            -- 購入頻度(月次)
    deal_feel                     TEXT,                     -- 商談の手応え
    good_point                    TEXT,                     -- Good Point
    more_point                    TEXT,                     -- More Point
    reflection_and_goals          TEXT,                     -- 反省と今後の抱負
    report_submitted_at           DATE,                     -- レポート提出日
    report_reviewer               TEXT,                     -- レポート確認者
    report_reviewed_at            DATE,                     -- レポート確認日
    report_comment                TEXT,                     -- レポートコメント
    buddy_feedback                TEXT,                     -- Buddyフィードバック
    CONSTRAINT pk_leads PRIMARY KEY (lead_id),
    CONSTRAINT fk_leads_lead_sources FOREIGN KEY (lead_source_id)
        REFERENCES lead_sources(source_id) ON DELETE RESTRICT,
    CONSTRAINT fk_leads_staff_sales FOREIGN KEY (sales_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_leads_staff_assignee FOREIGN KEY (assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_leads_staff_last_responder FOREIGN KEY (last_responder_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_leads_self FOREIGN KEY (duplicate_source_lead_id)
        REFERENCES leads(lead_id) ON DELETE RESTRICT
);

CREATE INDEX idx_leads_registered_at        ON leads(registered_at);
CREATE INDEX idx_leads_lead_status          ON leads(lead_status);
CREATE INDEX idx_leads_lead_source_id       ON leads(lead_source_id);
CREATE INDEX idx_leads_sales_assignee_id    ON leads(sales_assignee_id);
CREATE INDEX idx_leads_assignee_id          ON leads(assignee_id);
CREATE INDEX idx_leads_last_responder_id    ON leads(last_responder_id);
CREATE INDEX idx_leads_duplicate_source     ON leads(duplicate_source_lead_id);

-- ============================================================
-- Level 3: customers, login_sessions, conversation_logs
-- ============================================================

CREATE TABLE customers (
    customer_id            TEXT        NOT NULL,
    source_lead_id         TEXT        NOT NULL,   -- 6/6, 6行, FK → leads
    customer_name          TEXT        NOT NULL,   -- 6/6
    country                TEXT        NOT NULL,   -- 6/6
    email                  TEXT        NOT NULL,   -- 6/6
    phone                  TEXT        NOT NULL,   -- 6/6
    country_code           TEXT        NOT NULL,   -- 6/6
    first_transaction_date DATE        NOT NULL,   -- 6/6
    registered_at          TIMESTAMPTZ NOT NULL,   -- 6/6
    sales_assignee_id      TEXT        NOT NULL,   -- 6/6, FK → staff
    contact_tool           TEXT        NOT NULL,   -- 6/6 (連絡ツール)
    fedex_id               TEXT,                   -- 0/6
    shipping_note          TEXT,                   -- 0/6
    customer_scale         TEXT,                   -- 0/6
    assignee_id            TEXT,                   -- 実シート追加列「担当者ID」PO判断(a)→正式列化, FK → staff
    CONSTRAINT pk_customers PRIMARY KEY (customer_id),
    CONSTRAINT fk_customers_leads FOREIGN KEY (source_lead_id)
        REFERENCES leads(lead_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customers_staff_sales FOREIGN KEY (sales_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_customers_staff_assignee FOREIGN KEY (assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT
);

CREATE INDEX idx_customers_source_lead_id    ON customers(source_lead_id);
CREATE INDEX idx_customers_registered_at     ON customers(registered_at);
CREATE INDEX idx_customers_sales_assignee_id ON customers(sales_assignee_id);
CREATE INDEX idx_customers_assignee_id       ON customers(assignee_id);

CREATE TABLE login_sessions (
    session_id   TEXT        NOT NULL,   -- UUID×2連結形式 maxLen=72, 64/64, 64行
    staff_id     TEXT        NOT NULL,   -- 64/64, FK → staff
    issued_at    TIMESTAMPTZ NOT NULL,   -- 64/64
    last_used_at TIMESTAMPTZ NOT NULL,   -- 64/64
    expires_at   TIMESTAMPTZ NOT NULL,   -- 64/64
    status       TEXT        NOT NULL,   -- 64/64
    CONSTRAINT pk_login_sessions PRIMARY KEY (session_id),
    CONSTRAINT fk_login_sessions_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT
);

CREATE INDEX idx_login_sessions_staff_id  ON login_sessions(staff_id);
CREATE INDEX idx_login_sessions_expires_at ON login_sessions(expires_at);

CREATE TABLE conversation_logs (
    log_id            TEXT        NOT NULL,
    lead_id           TEXT        NOT NULL,   -- 100/100, 249行, FK → leads
    occurred_at       TIMESTAMPTZ NOT NULL,   -- 100/100 (日時)
    direction         TEXT        NOT NULL,   -- 100/100 (送受信: 受信/送信 等)
    speaker           TEXT        NOT NULL,   -- 100/100 (発言者)
    original_text     TEXT        NOT NULL,   -- 100/100 (原文)
    original_language TEXT        NOT NULL,   -- 100/100 (原文言語, maxLen=2)
    translated_text   TEXT        NOT NULL,   -- 100/100 (翻訳文)
    recorder_id       TEXT        NOT NULL,   -- 100/100 (記録者ID, メールアドレス形式 maxLen=27)
    recorded_at       TIMESTAMPTZ NOT NULL,   -- 100/100 (記録日時)
    deal_analysis     TEXT,                   -- 0/100 (商談解析, 全空)
    CONSTRAINT pk_conversation_logs PRIMARY KEY (log_id),
    CONSTRAINT fk_conversation_logs_leads FOREIGN KEY (lead_id)
        REFERENCES leads(lead_id) ON DELETE RESTRICT
);
-- 注: CoreSchemaV1 未登録。recorder_id はメールアドレス形式（staff_id=EMP-XXXXX 形式ではない）

CREATE INDEX idx_conversation_logs_lead_id    ON conversation_logs(lead_id);
CREATE INDEX idx_conversation_logs_occurred_at ON conversation_logs(occurred_at);

-- ============================================================
-- Level 4: shipping_destinations, payment_destinations, orders
-- ============================================================

CREATE TABLE shipping_destinations (
    shipping_destination_id TEXT    NOT NULL,
    customer_id             TEXT    NOT NULL,   -- 6/6, 6行, FK → customers
    display_name            TEXT,               -- 0/6
    recipient_name          TEXT    NOT NULL,   -- 6/6
    address_line_1          TEXT    NOT NULL,   -- 6/6
    address_line_2          TEXT,               -- 0/6
    address_line_3          TEXT,               -- 0/6
    city                    TEXT    NOT NULL,   -- 6/6
    state                   TEXT    NOT NULL,   -- 6/6
    zip                     TEXT    NOT NULL,   -- 6/6, 型混在→文字列統一済み（2026-09-02）
    country                 TEXT    NOT NULL,   -- 6/6
    phone                   TEXT    NOT NULL,   -- 6/6
    country_code            TEXT    NOT NULL,   -- 6/6
    email                   TEXT,               -- 0/6
    tax_id                  TEXT,               -- 0/6
    is_default              BOOLEAN NOT NULL,   -- 6/6
    is_active               BOOLEAN NOT NULL,   -- 6/6
    CONSTRAINT pk_shipping_destinations PRIMARY KEY (shipping_destination_id),
    CONSTRAINT fk_shipping_destinations_customers FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id) ON DELETE RESTRICT
);

CREATE INDEX idx_shipping_destinations_customer_id ON shipping_destinations(customer_id);

CREATE TABLE payment_destinations (
    payment_destination_id TEXT    NOT NULL,
    customer_id            TEXT    NOT NULL,   -- 6/6, 6行, FK → customers
    display_name           TEXT,               -- 0/6
    billing_name           TEXT    NOT NULL,   -- 6/6
    address_line_1         TEXT    NOT NULL,   -- 6/6
    address_line_2         TEXT,               -- 0/6
    address_line_3         TEXT,               -- 0/6
    city                   TEXT    NOT NULL,   -- 6/6
    state                  TEXT    NOT NULL,   -- 6/6
    zip                    TEXT    NOT NULL,   -- 6/6, 型混在→文字列統一済み（2026-09-02）
    country                TEXT    NOT NULL,   -- 6/6
    payment_method         TEXT    NOT NULL,   -- 6/6
    currency               TEXT    NOT NULL,   -- 6/6
    tax_id                 TEXT,               -- 0/6
    is_default             BOOLEAN NOT NULL,   -- 6/6
    is_active              BOOLEAN NOT NULL,   -- 6/6
    CONSTRAINT pk_payment_destinations PRIMARY KEY (payment_destination_id),
    CONSTRAINT fk_payment_destinations_customers FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id) ON DELETE RESTRICT
);

CREATE INDEX idx_payment_destinations_customer_id ON payment_destinations(customer_id);

CREATE TABLE orders (
    order_id                    TEXT          NOT NULL,
    invoice_number              TEXT,                     -- 11/12
    customer_id                 TEXT          NOT NULL,   -- 12/12, 12行, FK → customers
    shipping_destination_id     TEXT          NOT NULL,   -- 12/12, FK → shipping_destinations
    payment_destination_id      TEXT          NOT NULL,   -- 12/12, FK → payment_destinations
    source_lead_id              TEXT          NOT NULL,   -- 12/12, FK → leads
    status                      TEXT          NOT NULL,   -- 12/12
    order_date                  DATE          NOT NULL,   -- 12/12 (受注日)
    currency                    TEXT          NOT NULL,   -- 12/12
    exchange_rate               NUMERIC(15,6) NOT NULL,   -- 12/12
    line_total                  NUMERIC(15,2) NOT NULL,   -- 12/12 (明細合計)
    shipping_fee                NUMERIC(15,2) NOT NULL,   -- 12/12
    duty                        NUMERIC(15,2) NOT NULL,   -- 12/12 (関税)
    invoice_total               NUMERIC(15,2) NOT NULL,   -- 12/12 (請求総額)
    payment_method              TEXT,                     -- 11/12
    invoice_link                TEXT,                     -- 0/12
    invoice_issued_at           DATE,                     -- 4/12
    payment_due_at              DATE,                     -- 9/12
    payment_confirmed_at        DATE,                     -- 6/12
    payment_confirmation_source TEXT,                     -- 0/12
    shipping_method             TEXT,                     -- 11/12
    shipped_at                  DATE,                     -- 0/12
    tracking_number             TEXT,                     -- 0/12
    shipping_note               TEXT,                     -- 0/12
    note                        TEXT,                     -- 0/12
    registered_at               TIMESTAMPTZ   NOT NULL,   -- 12/12
    updated_at                  TIMESTAMPTZ   NOT NULL,   -- 12/12
    order_assignee_id           TEXT,                     -- 0/12, FK → staff
    payment_confirmed_by_id     TEXT,                     -- 0/12, FK → staff
    sales_assignee_id           TEXT,                     -- 0/12, FK → staff
    shipping_assignee_id        TEXT,                     -- 0/12, FK → staff
    transaction_note            TEXT,                     -- 0/12
    reserved_invoice_number     TEXT,                     -- 0/12
    release_scheduled_at        DATE,                     -- 0/12
    deposit_rate                NUMERIC(5,2),             -- 0/12 (0.00–100.00%)
    other_fee                   NUMERIC(15,2),            -- 0/12 (その他手数料)
    discount                    NUMERIC(15,2),            -- 0/12
    payment_terms               TEXT,                     -- 0/12 (支払サイト)
    cancellation_reason         TEXT,                     -- 2/12
    cancellation_note           TEXT,                     -- 0/12
    payment_status              TEXT          NOT NULL,   -- 12/12
    invoice_total_jpy           NUMERIC(15,2),            -- 0/12 (円換算請求総額)
    internal_note               TEXT,                     -- 0/12
    CONSTRAINT pk_orders PRIMARY KEY (order_id),
    CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_shipping_destinations FOREIGN KEY (shipping_destination_id)
        REFERENCES shipping_destinations(shipping_destination_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_payment_destinations FOREIGN KEY (payment_destination_id)
        REFERENCES payment_destinations(payment_destination_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_leads FOREIGN KEY (source_lead_id)
        REFERENCES leads(lead_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_staff_order FOREIGN KEY (order_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_staff_payment FOREIGN KEY (payment_confirmed_by_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_staff_sales FOREIGN KEY (sales_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_staff_shipping FOREIGN KEY (shipping_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT
);

CREATE INDEX idx_orders_order_date             ON orders(order_date);
CREATE INDEX idx_orders_registered_at          ON orders(registered_at);
CREATE INDEX idx_orders_customer_id            ON orders(customer_id);
CREATE INDEX idx_orders_shipping_destination_id ON orders(shipping_destination_id);
CREATE INDEX idx_orders_payment_destination_id  ON orders(payment_destination_id);
CREATE INDEX idx_orders_source_lead_id         ON orders(source_lead_id);
CREATE INDEX idx_orders_order_assignee_id      ON orders(order_assignee_id);
CREATE INDEX idx_orders_payment_confirmed_by_id ON orders(payment_confirmed_by_id);
CREATE INDEX idx_orders_sales_assignee_id      ON orders(sales_assignee_id);
CREATE INDEX idx_orders_shipping_assignee_id   ON orders(shipping_assignee_id);
CREATE INDEX idx_orders_payment_status         ON orders(payment_status);

-- ============================================================
-- Level 5: order_lines, shipments, purchases, quotes
-- ============================================================

CREATE TABLE order_lines (
    order_line_id TEXT          NOT NULL,
    order_id      TEXT          NOT NULL,   -- 25/25, 25行, FK → orders CASCADE
    line_number   INTEGER       NOT NULL,   -- 25/25
    category      TEXT          NOT NULL,   -- 25/25
    product_name  TEXT          NOT NULL,   -- 25/25
    status        TEXT          NOT NULL,   -- 25/25 (状態: 在庫状況等)
    sku           TEXT,                     -- 0/25
    quantity      INTEGER       NOT NULL,   -- 25/25
    unit_price    NUMERIC(15,2) NOT NULL,   -- 25/25
    subtotal      NUMERIC(15,2) NOT NULL,   -- 25/25 (小計)
    product_id    TEXT,                     -- 1/25, FK → products
    condition     TEXT,                     -- 1/25 (コンディションマスタ参照値、スコープ外)
    CONSTRAINT pk_order_lines PRIMARY KEY (order_line_id),
    CONSTRAINT fk_order_lines_orders FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_lines_products FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE RESTRICT
);
-- 注: condition 列は CONDITIONS テーブル（コンディションマスタ）を参照するが
--     22 テーブルスコープ外のため FK 制約なし

CREATE INDEX idx_order_lines_order_id   ON order_lines(order_id);
CREATE INDEX idx_order_lines_product_id ON order_lines(product_id);

CREATE TABLE shipments (
    shipment_id           TEXT          NOT NULL,
    order_id              TEXT          NOT NULL,   -- 8/8, 8行, FK → orders CASCADE
    box_number            INTEGER       NOT NULL,   -- 8/8
    shipping_method       TEXT          NOT NULL,   -- 8/8
    shipped_at            DATE,                     -- 4/8
    tracking_number       TEXT,                     -- 4/8
    length                NUMERIC(15,2),            -- 0/8
    width                 NUMERIC(15,2),            -- 0/8
    height                NUMERIC(15,2),            -- 0/8
    weight                NUMERIC(15,3),            -- 0/8 (kg, 小数3桁)
    estimated_shipping_fee NUMERIC(15,2),           -- 0/8
    label_url             TEXT,                     -- 0/8
    invoice_url           TEXT,                     -- 0/8
    inspection            BOOLEAN,                  -- 2/8
    packing               BOOLEAN,                  -- 1/8
    storage               BOOLEAN,                  -- 1/8
    pickup_request        BOOLEAN,                  -- 4/8
    notification          BOOLEAN,                  -- 4/8
    shipping_assignee_id  TEXT,                     -- 1/8, FK → staff
    note                  TEXT,                     -- 1/8
    registered_at         TIMESTAMPTZ   NOT NULL,   -- 8/8
    updated_at            TIMESTAMPTZ   NOT NULL,   -- 8/8
    CONSTRAINT pk_shipments PRIMARY KEY (shipment_id),
    CONSTRAINT fk_shipments_orders FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_shipments_staff FOREIGN KEY (shipping_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT
);

CREATE INDEX idx_shipments_order_id           ON shipments(order_id);
CREATE INDEX idx_shipments_shipped_at         ON shipments(shipped_at);
CREATE INDEX idx_shipments_shipping_assignee_id ON shipments(shipping_assignee_id);

CREATE TABLE purchases (
    purchase_id            TEXT          NOT NULL,
    order_id               TEXT          NOT NULL,   -- 12/12, 12行, FK → orders CASCADE
    purchase_assignee_id   TEXT,                     -- 0/12, FK → staff
    paid_by_id             TEXT,                     -- 0/12, FK → staff
    ordered_at             TIMESTAMPTZ,              -- 8/12
    paid_at                TIMESTAMPTZ,              -- 0/12
    transaction_number     TEXT,                     -- 0/12
    supplier               TEXT          NOT NULL,   -- 12/12
    supplier_url           TEXT,                     -- 0/12
    quantity               INTEGER       NOT NULL,   -- 12/12
    unit_price             NUMERIC(15,2) NOT NULL,   -- 12/12
    amount                 NUMERIC(15,2) NOT NULL,   -- 12/12
    shipping_or_agency_fee NUMERIC(15,2),            -- 0/12
    carrier                TEXT,                     -- 0/12
    tracking_number        TEXT,                     -- 0/12
    status                 TEXT          NOT NULL,   -- 12/12
    note                   TEXT,                     -- 0/12
    registered_at          TIMESTAMPTZ   NOT NULL,   -- 12/12
    updated_at             TIMESTAMPTZ,              -- 11/12
    CONSTRAINT pk_purchases PRIMARY KEY (purchase_id),
    CONSTRAINT fk_purchases_orders FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_purchases_staff_assignee FOREIGN KEY (purchase_assignee_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchases_staff_paid_by FOREIGN KEY (paid_by_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT
);

CREATE INDEX idx_purchases_order_id            ON purchases(order_id);
CREATE INDEX idx_purchases_ordered_at          ON purchases(ordered_at);
CREATE INDEX idx_purchases_purchase_assignee_id ON purchases(purchase_assignee_id);
CREATE INDEX idx_purchases_paid_by_id          ON purchases(paid_by_id);

CREATE TABLE quotes (
    quote_id         TEXT          NOT NULL,
    lead_id          TEXT,                     -- 1/1 (サンプル <5行), FK → leads
    customer_id      TEXT,                     -- 0/1, FK → customers
    order_id         TEXT,                     -- 0/1, FK → orders
    staff_id         TEXT,                     -- 1/1 (<5), FK → staff
    issued_date      DATE,                     -- 0/1
    expiry_date      DATE,                     -- 0/1
    status           TEXT,                     -- 1/1 (<5)
    currency         TEXT,                     -- 1/1 (<5)
    exchange_rate    NUMERIC(15,6),            -- 1/1 (<5)
    subtotal         NUMERIC(15,2),            -- 1/1 (<5)
    shipping_fee     NUMERIC(15,2),            -- 1/1 (<5)
    discount         NUMERIC(15,2),            -- 1/1 (<5)
    total_amount     NUMERIC(15,2),            -- 1/1 (<5)
    total_amount_jpy NUMERIC(15,2),            -- 1/1 (<5) (円換算合計)
    pdf_url          TEXT,                     -- 0/1
    note             TEXT,                     -- 1/1 (<5)
    created_at       TIMESTAMPTZ,              -- 1/1 (<5)
    updated_at       TIMESTAMPTZ,              -- 1/1 (<5)
    CONSTRAINT pk_quotes PRIMARY KEY (quote_id),
    CONSTRAINT fk_quotes_leads FOREIGN KEY (lead_id)
        REFERENCES leads(lead_id) ON DELETE RESTRICT,
    CONSTRAINT fk_quotes_customers FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id) ON DELETE RESTRICT,
    CONSTRAINT fk_quotes_orders FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE RESTRICT,
    CONSTRAINT fk_quotes_staff FOREIGN KEY (staff_id)
        REFERENCES staff(staff_id) ON DELETE RESTRICT
);
-- 注: 全列が NOT NULL でない理由: 実データ 1行のみ（サンプル行数 <5）

CREATE INDEX idx_quotes_lead_id     ON quotes(lead_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_order_id    ON quotes(order_id);
CREATE INDEX idx_quotes_staff_id    ON quotes(staff_id);
CREATE INDEX idx_quotes_created_at  ON quotes(created_at);

-- ============================================================
-- Level 6: quote_lines
-- ============================================================

CREATE TABLE quote_lines (
    quote_line_id TEXT          NOT NULL,
    quote_id      TEXT,                     -- 3/3 (サンプル <5行), FK → quotes CASCADE
    line_no       INTEGER,                  -- 3/3 (<5)
    product_id    TEXT,                     -- 0/3, FK → products
    product_name  TEXT,                     -- 3/3 (<5)
    description   TEXT,                     -- 0/3
    condition     TEXT,                     -- 0/3
    weight        NUMERIC(15,3),            -- 0/3 (kg)
    quantity      INTEGER,                  -- 3/3 (<5)
    unit_price    NUMERIC(15,2),            -- 3/3 (<5)
    amount        NUMERIC(15,2),            -- 3/3 (<5) (金額)
    note          TEXT,                     -- 0/3
    CONSTRAINT pk_quote_lines PRIMARY KEY (quote_line_id),
    CONSTRAINT fk_quote_lines_quotes FOREIGN KEY (quote_id)
        REFERENCES quotes(quote_id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_lines_products FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE RESTRICT
);
-- 注: 全列が NOT NULL でない理由: 実データ 3行のみ（サンプル行数 <5）

CREATE INDEX idx_quote_lines_quote_id   ON quote_lines(quote_id);
CREATE INDEX idx_quote_lines_product_id ON quote_lines(product_id);

COMMIT;
