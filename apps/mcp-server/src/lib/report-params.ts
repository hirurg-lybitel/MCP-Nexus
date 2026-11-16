import * as z from 'zod/v4';

/** Shared company parameter for accounting reports (TZ common schema). */
export const companyKeyParam = z
  .number()
  .int()
  .positive()
  .optional()
  .describe(
    'Working organization id from find_counterparty / GD_OURCOMPANY. ' +
      'Never invent (do not use 1 or 0). ' +
      'Omit when the user did not name an organization: the server uses the only ' +
      'working organization with an active chart, or returns AMBIGUOUS_COMPANY if several exist.'
  );

/** Sibling A/S accounts outside LB/RB that share a short alias prefix (51, 62, 90…). */
export const relatedSiblingAccountSchema = z.object({
  accountKey: z.number(),
  alias: z.string(),
  name: z.string(),
  accountType: z.string(),
});

/** Extra company fields returned after resolveWorkingCompany (must be in outputSchema). */
export const companyOutputFields = {
  companyName: z.string().optional(),
  companyScope: z.enum(['explicit', 'default_single_working']).optional(),
  companies: z
    .array(
      z.object({
        companyKey: z.number(),
        name: z.string(),
      })
    )
    .optional(),
};

/** Account id from find_account — never an alias like 60/62. */
export const accountKeyParam = z
  .number()
  .int()
  .positive()
  .describe(
    'Account id from find_account / get_chart_of_accounts (AC_ACCOUNT.ID). ' +
      'Never pass an alias such as 60 or 62 as accountKey.'
  );

export const isoDateParam = (label: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(`${label}, YYYY-MM-DD`);

export const includeInternalParam = z
  .boolean()
  .optional()
  .describe(
    'Include internal entries (same account and analytics on both sides). Default false; platform recommends leaving this off.'
  );

export const allHoldingCompaniesParam = z
  .boolean()
  .optional()
  .describe('Include holding companies of the organization. Default false');

export const withSubAccountsParam = z
  .boolean()
  .optional()
  .describe(
    'Include subaccounts inside the account LB/RB tree in calculation (default true). ' +
      'WARNING: false excludes all subaccounts from calculation and almost always returns 0 on synthetic accounts (60, 62, 51, 10, 76…). ' +
      'If the user asks for totals "without subaccounts in the answer", keep withSubAccounts=true and use totals / summaryOnly=true.'
  );

export function appliedFilters(args: {
  companyKey: number;
  companyName?: string;
  companyScope?: 'explicit' | 'default_single_working';
  dateBegin?: string;
  dateEnd?: string;
  accountKey?: number;
  includeInternal?: boolean;
  allHoldingCompanies?: boolean;
  withSubAccounts?: boolean;
  summaryOnly?: boolean;
  fieldName?: string;
  currKey?: number;
  includeOffBalance?: boolean;
  accountAliases?: string[];
}) {
  return {
    companyKey: args.companyKey,
    ...(args.companyName != null ? { companyName: args.companyName } : {}),
    ...(args.companyScope != null ? { companyScope: args.companyScope } : {}),
    ...(args.dateBegin != null ? { dateBegin: args.dateBegin } : {}),
    ...(args.dateEnd != null ? { dateEnd: args.dateEnd } : {}),
    ...(args.accountKey != null ? { accountKey: args.accountKey } : {}),
    includeInternal: args.includeInternal ?? false,
    allHoldingCompanies: args.allHoldingCompanies ?? false,
    ...(args.withSubAccounts != null
      ? { withSubAccounts: args.withSubAccounts }
      : {}),
    ...(args.summaryOnly != null ? { summaryOnly: args.summaryOnly } : {}),
    ...(args.fieldName != null ? { fieldName: args.fieldName } : {}),
    ...(args.currKey != null ? { currKey: args.currKey } : {}),
    ...(args.includeOffBalance != null
      ? { includeOffBalance: args.includeOffBalance }
      : {}),
    ...(args.accountAliases?.length
      ? { accountAliases: args.accountAliases }
      : {}),
  };
}
