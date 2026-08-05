/**
 * システム管理用シートの初期化
 */
function initSystemSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 90_SystemAgents
    let agentSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_AGENTS.NAME);
    const eightAgents = [
        ["Manager (Navigator)", "統括・進行管理", "ビジョンをタスクに変換し、日々の進捗を管理する。", "常にユーザーの認知負荷を減らすことを意識し、次に何をすべきかを明確に提示せよ。"],
        ["Builder (Architect)", "実装・開発", "GAS / HTML / TS の迅速な実装を行う。", "動くものを作ることが最優先だが、Auditorの承認なしに完了とはしないこと。"],
        ["Auditor (Guardian)", "品質管理・監査", "セキュリティ、パフォーマンス、エラー処理の厳格なチェック。", "バグやセキュリティリスク、保守運用性を絶対に妥協せず、冷静に批判的な視点でコードをレビューせよ。"],
        ["Designer (Aesthetician)", "UI/UXデザイン", "使い心地と見た目の美しさを担保し、モチベーションを維持させる。", "人間工学的に「使っていて気持ちいい」と感じるUIを追求し、ユーザーの感情に訴えかけよ。"],
        ["Analyst (Strategist)", "戦略分析", "KPI分析とデータに基づく事業改善提案。", "客観的な数値データに基づき、感情論を排した冷徹な改善案を提示せよ。"],
        ["Optimizer (Engineer)", "効率化・自動化", "手作業の排除とAPI自動化による効率最大化。", "「退屈な作業」や「事務的な作業」の自動化を考案して提案し、ユーザーが創造的な業務に集中できる環境を作れ。"],
        ["Archivist (Secretary)", "記録・記憶", "仕様、変更履歴、重要な決定事項の完全な保存。", "文脈を絶対にロストせず、ユーザーが久しぶりに戻ってきても即座に復帰できるようにせよ。"],
        ["Grand Master (Final Auditor)", "最終監査・審議", "全ての提案に対し、100億円企業への道筋に合致するか最終審議を行う。", "物事を多角的に捉え、楽天派と悪魔の代弁者の議論が「事実ベース」で収束しているかを厳格に審査せよ。一切の妥協を許さず、事業の永続性と健全性を担保せよ。"]
    ];

    if (!agentSheet) {
        agentSheet = ss.insertSheet(CONFIG.SHEETS.SYSTEM_AGENTS.NAME);
        agentSheet.getRange(1, 1, 1, 4).setValues([["AgentName", "Role/Function", "Description", "Instruction"]]);
        agentSheet.getRange(2, 1, eightAgents.length, 4).setValues(eightAgents);
    }

    // 91_SystemSpecs
    let specSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_SPECS.NAME);
    if (!specSheet) {
        specSheet = ss.insertSheet(CONFIG.SHEETS.SYSTEM_SPECS.NAME);
        specSheet.getRange(1, 1, 1, 4).setValues([["Category", "Item", "Description", "Status"]]);
    }

    // 99_Changelog
    let logSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_CHANGELOG.NAME);
    if (!logSheet) {
        logSheet = ss.insertSheet(CONFIG.SHEETS.SYSTEM_CHANGELOG.NAME);
        logSheet.getRange(1, 1, 1, 4).setValues([["Version", "Date", "Changes", "Author"]]);
    }
}

function getSystemAgents() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.SYSTEM_AGENTS.NAME);
    if (!sheet) return "Manager: 統括・進行管理 (Default)";
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return "Manager: 統括・進行管理 (Default)";

    return data.slice(1).map(row => {
        const instruction = row[3] ? `\n   指示: ${row[3]}` : "";
        return `- ${row[0]}: ${row[1]} (${row[2]})${instruction}`;
    }).join("\n");
}
