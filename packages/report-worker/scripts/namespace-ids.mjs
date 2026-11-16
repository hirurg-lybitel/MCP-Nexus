/** Stable GD_FUNCTION ids for MCP worker handlers (install / uninstall). */
export const MCP_FUNCTION_IDS = {
  jsonEscape: 949805510,
  trialBalance: 949805511,
  webHandlers: 949805512,
  registerHandlers: 949805513,
  accountCard: 949805520,
  accountReview: 949805521,
  journalOrder: 949805522,
  runReportConfig: 949805523,
};

export const MCP_FUNCTION_ID_LIST = Object.values(MCP_FUNCTION_IDS);

export const MCP_FUNCTION_NAMES = [
  'MCP_JSONESCAPE',
  'MCP_TRIAL_BALANCE',
  'MCP_WEB_HANDLERS',
  'MCP_REGISTERHANDLERS',
  'MCP_ACCOUNT_CARD',
  'MCP_ACCOUNT_REVIEW',
  'MCP_JOURNAL_ORDER',
  'MCP_RUN_REPORT_CONFIG',
];
