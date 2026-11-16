import type { ReportWorkerConfig } from './config.js';
import { ReportWorkerError } from './errors.js';
import { WorkerPool, type WorkerHungHandler } from './pool.js';

export { ReportWorkerError } from './errors.js';

export interface TrialBalanceParams {
  companyKey: number;
  dateBegin: string;
  dateEnd: string;
  accountKey?: number;
  includeInternal?: boolean;
  allHoldingCompanies?: boolean;
}

export interface AccountCardParams {
  companyKey: number;
  dateBegin: string;
  dateEnd: string;
  accountKey: number;
  includeInternal?: boolean;
  allHoldingCompanies?: boolean;
  withSubAccounts?: boolean;
  /** Optional worker-side row cap (0/omit = all rows). */
  maxRows?: number;
}

export type AccountReviewParams = AccountCardParams;

export interface JournalOrderParams extends AccountCardParams {
  showDebit?: boolean;
  showCredit?: boolean;
  /** Ledger analytics group field, e.g. ENTRYDATE / MONTH / YEAR. Default ENTRYDATE. */
  groupBy?: string;
}

export class ReportWorkerClient {
  private readonly pool: WorkerPool;

  constructor(
    private readonly config: ReportWorkerConfig,
    options: { pool?: WorkerPool; onHung?: WorkerHungHandler } = {}
  ) {
    this.pool =
      options.pool ?? WorkerPool.fromConfig(config, options.onHung);
  }

  getPool(): WorkerPool {
    return this.pool;
  }

  async getTrialBalance(params: TrialBalanceParams): Promise<unknown> {
    return this.pool.request('/mcp/trial_balance', {
      companyKey: String(params.companyKey),
      dateBegin: params.dateBegin,
      dateEnd: params.dateEnd,
      ...(params.accountKey != null
        ? { accountKey: String(params.accountKey) }
        : {}),
      includeInternal: params.includeInternal ? '1' : '0',
      allHoldingCompanies: params.allHoldingCompanies ? '1' : '0',
    });
  }

  async getAccountCard(params: AccountCardParams): Promise<unknown> {
    return this.pool.request('/mcp/account_card', {
      companyKey: String(params.companyKey),
      dateBegin: params.dateBegin,
      dateEnd: params.dateEnd,
      accountKey: String(params.accountKey),
      includeInternal: params.includeInternal ? '1' : '0',
      allHoldingCompanies: params.allHoldingCompanies ? '1' : '0',
      withSubAccounts: params.withSubAccounts === false ? '0' : '1',
      ...(params.maxRows != null && params.maxRows > 0
        ? { maxRows: String(params.maxRows) }
        : {}),
    });
  }

  async getAccountReview(params: AccountReviewParams): Promise<unknown> {
    return this.pool.request('/mcp/account_review', {
      companyKey: String(params.companyKey),
      dateBegin: params.dateBegin,
      dateEnd: params.dateEnd,
      accountKey: String(params.accountKey),
      includeInternal: params.includeInternal ? '1' : '0',
      allHoldingCompanies: params.allHoldingCompanies ? '1' : '0',
      withSubAccounts: params.withSubAccounts === false ? '0' : '1',
    });
  }

  async getJournalOrder(params: JournalOrderParams): Promise<unknown> {
    return this.pool.request('/mcp/journal_order', {
      companyKey: String(params.companyKey),
      dateBegin: params.dateBegin,
      dateEnd: params.dateEnd,
      accountKey: String(params.accountKey),
      includeInternal: params.includeInternal ? '1' : '0',
      allHoldingCompanies: params.allHoldingCompanies ? '1' : '0',
      withSubAccounts: params.withSubAccounts === false ? '0' : '1',
      showDebit: params.showDebit === false ? '0' : '1',
      showCredit: params.showCredit === false ? '0' : '1',
      groupBy: params.groupBy?.trim() || 'ENTRYDATE',
    });
  }

  async runReportConfig(params: {
    configId: number;
    companyKey?: number;
    dateBegin?: string;
    dateEnd?: string;
    limit?: number;
    className?: string;
    configName?: string;
    reportClass?: string;
  }): Promise<unknown> {
    return this.pool.request('/mcp/run_report_config', {
      configId: String(params.configId),
      ...(params.companyKey != null
        ? { companyKey: String(params.companyKey) }
        : {}),
      ...(params.dateBegin ? { dateBegin: params.dateBegin } : {}),
      ...(params.dateEnd ? { dateEnd: params.dateEnd } : {}),
      ...(params.limit != null ? { limit: String(params.limit) } : {}),
      ...(params.className ? { className: params.className } : {}),
      ...(params.configName ? { configName: params.configName } : {}),
      ...(params.reportClass ? { reportClass: params.reportClass } : {}),
    });
  }
}
