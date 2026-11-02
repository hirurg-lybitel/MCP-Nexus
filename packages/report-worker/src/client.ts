import type { ReportWorkerConfig } from './config.js';

export class ReportWorkerError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'ReportWorkerError';
  }
}

export interface TrialBalanceParams {
  companyKey: number;
  dateBegin: string;
  dateEnd: string;
  accountKey?: number;
  includeInternal?: boolean;
  allHoldingCompanies?: boolean;
}

export class ReportWorkerClient {
  constructor(private readonly config: ReportWorkerConfig) {}

  async getTrialBalance(params: TrialBalanceParams): Promise<unknown> {
    const url = new URL('/mcp/trial_balance', this.config.baseUrl);
    url.searchParams.set('token', this.config.token);
    url.searchParams.set('companyKey', String(params.companyKey));
    url.searchParams.set('dateBegin', params.dateBegin);
    url.searchParams.set('dateEnd', params.dateEnd);
    if (params.accountKey != null) {
      url.searchParams.set('accountKey', String(params.accountKey));
    }
    url.searchParams.set(
      'includeInternal',
      params.includeInternal ? '1' : '0'
    );
    url.searchParams.set(
      'allHoldingCompanies',
      params.allHoldingCompanies ? '1' : '0'
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        throw new ReportWorkerError(
          text.slice(0, 500) || res.statusText,
          'WORKER_HTTP_ERROR',
          res.status
        );
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new ReportWorkerError(
          `Worker returned non-JSON: ${text.slice(0, 200)}`,
          'WORKER_BAD_JSON',
          res.status
        );
      }
    } catch (error) {
      if (error instanceof ReportWorkerError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ReportWorkerError(message, 'WORKER_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }
}
