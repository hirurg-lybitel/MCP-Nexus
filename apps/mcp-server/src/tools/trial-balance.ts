import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { toolFailure } from '../lib/tool-result.js';

const inputSchema = z.object({
  companyKey: z
    .number()
    .int()
    .positive()
    .describe('Organization id (GD_COMPANY / contact id), e.g. 146866007'),
  dateBegin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Period start, YYYY-MM-DD'),
  dateEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Period end, YYYY-MM-DD'),
  accountKey: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Root account of the chart (default: plan of accounts 300001)'),
  includeInternal: z
    .boolean()
    .optional()
    .describe('Include internal entries (DONTINMOVE=0). Default false'),
  allHoldingCompanies: z
    .boolean()
    .optional()
    .describe('Include holding companies. Default false'),
});

/**
 * Placeholder until the Gedemin report worker is wired (tasks 0.7–0.8).
 * Registered so Cursor already lists the tool; calls return a clear error.
 */
export function registerTrialBalanceTool(server: McpServer): void {
  server.registerTool(
    'get_trial_balance',
    {
      title: 'Trial balance (ОСВ)',
      description:
        'Build the standard trial balance (оборотно-сальдовая ведомость) for a company and period ' +
        'via the Gedemin report worker. Numbers match the on-screen report. ' +
        'Do not compute trial balance with run_sql.',
      inputSchema,
    },
    async () =>
      toolFailure(
        'WORKER_NOT_CONFIGURED',
        'Report worker is not configured yet (stage 0 tasks 0.7–0.8). Use run_sql only for ad-hoc queries.'
      )
  );
}
