import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';
import type { Locale } from '@/lib/i18n/types';
import { DEFAULT_LOCALE } from '@/lib/i18n/types';
import {
  describeFirebirdSqlDialect,
  parseFirebirdSqlDialect,
  type FirebirdSqlDialect,
} from '@mcp-nexus/db-firebird/sql-dialect';

/**
 * UI-only host tools (not on the MCP server). Always appended for the web chat.
 */
export const WEB_HOST_TOOLS_SECTION =
  '## Host tools (MCP-Nexus web UI only)\n' +
  '- **create_query_plan** — call FIRST for non-trivial questions; shown as To-dos (not on the MCP server).\n' +
  '- **present_query_result** — optional UI table helper. Modes:\n' +
  '  - after **execute_sql** / **run_sql**: pass the **same sql** (+ params, tableName, columnLabels);\n' +
  '  - after an accounting tool: pass **rows** (array of objects) + title/columnLabels when you need a curated subset (UI already auto-renders tables from get_trial_balance / get_account_analysis / get_balance / get_journal_order / get_account_card / list_report_configs when they return row arrays).\n' +
  'Skip planning only for trivial probes.\n\n' +
  '## After data tools\n' +
  '- Always state key totals in the final answer: organization, period/date, currency (бел. руб. / NCU), and figures from totals / saldo* / turnover* (never answer only "отчёт получен").\n' +
  '- Do **not** paste hundreds of rows as markdown/pipe tables in chat text.\n' +
  '- Prefer "см. таблицу выше" / "see the table above" for row detail **only when** a UI table was shown in this turn (accounting auto-table or present_query_result). If no UI table appeared (e.g. get_balance with summaryOnly), put the needed numbers in the text.';

/**
 * Legacy Firebird-explorer prompt — used only when MCP server instructions are missing.
 */
function buildFirebirdSqlDialectSection(dialect: FirebirdSqlDialect): string {
  const bullets = describeFirebirdSqlDialect(dialect);
  return (
    `\n\n## Firebird SQL dialect (${dialect})\n` +
    bullets.map((line) => `- ${line}`).join('\n')
  );
}

function buildLegacyFirebirdPrompt(dialect: FirebirdSqlDialect): string {
  const executeSqlNote =
    dialect === '3'
      ? 'read-only SELECT/WITH on Firebird 5 (windows, RECURSIVE, OFFSET/FETCH OK; no LIMIT)'
      : 'read-only SELECT/WITH on legacy dialect 2.5 override (no windows / RECURSIVE / OFFSET)';

  return (
    'You are a Firebird data assistant with Gedemin metadata (AT_RELATIONS, AT_RELATION_FIELDS, AT_FIELDS).\n\n' +
    '## Firebird MCP (read-only — never guess table names)\n' +
    '- Prefer accounting MCP tools from the server when available (trial balance, balance, account card, …).\n' +
    `- **run_sql** / **execute_sql** — ${executeSqlNote}.\n` +
    '- Never invent table or account names; resolve via find_* / chart tools first.\n\n' +
    '## Security\n' +
    '- Never ask for or dump passwords, tokens, or secrets.\n' +
    '- Read-only: do not attempt mutations.\n' +
    buildFirebirdSqlDialectSection(dialect)
  );
}

function buildResponseLanguageSection(locale: Locale): string {
  switch (locale) {
    case 'ru':
      return '\n\n## Language\nВсегда отвечай на русском языке, если пользователь явно не просит другой язык.';
    case 'by':
      return '\n\n## Language\nЗаўсёды адказвай на беларускай мове, калі карыстальнік яўна не просіць іншую мову.';
    default:
      return '\n\n## Language\nAlways respond in English unless the user explicitly asks for another language.';
  }
}

export function truncateDomainContext(userContext: string): string {
  return userContext.slice(0, MAX_DOMAIN_CONTEXT_CHARS);
}

export interface BuildSystemPromptOptions {
  userContext?: string;
  locale?: Locale;
  dialectOverride?: FirebirdSqlDialect;
  /** From MCP initialize `instructions` (preferred — D5 / 2.10). */
  serverInstructions?: string | null;
}

export function buildSystemPrompt(
  userContextOrOptions?: string | BuildSystemPromptOptions,
  localeArg: Locale = DEFAULT_LOCALE,
  dialectOverride?: FirebirdSqlDialect
): string {
  const opts: BuildSystemPromptOptions =
    typeof userContextOrOptions === 'object' && userContextOrOptions !== null
      ? userContextOrOptions
      : {
          userContext: userContextOrOptions,
          locale: localeArg,
          dialectOverride,
        };

  const locale = opts.locale ?? DEFAULT_LOCALE;
  const dialect = opts.dialectOverride ?? parseFirebirdSqlDialect();
  const server = opts.serverInstructions?.trim();

  const core = server
    ? `You help the user with Gedemin accounting data via MCP (read-only).\n\n` +
      `## Server instructions\n${server}\n\n${WEB_HOST_TOOLS_SECTION}`
    : buildLegacyFirebirdPrompt(dialect) +
      '\n\n' +
      WEB_HOST_TOOLS_SECTION;

  const base = core + buildResponseLanguageSection(locale);
  const trimmed = opts.userContext?.trim();
  if (!trimmed) {
    return base;
  }
  return (
    base +
    '\n\n## Domain context (user-provided — follow for business meaning and joins)\n' +
    truncateDomainContext(trimmed)
  );
}
