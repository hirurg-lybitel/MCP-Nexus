import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  markAllPlanStepsCompleted,
  markPlanStepCompleted,
  markPlanStepRunning,
} from './plan-progress';
import type { QueryPlanData } from '@/types';

const samplePlan = (): QueryPlanData => ({
  userIntent: 'test',
  summary: 'summary',
  tables: [],
  sqlStrategy: 'sql',
  discoverySteps: [
    {
      phase: 'discovery',
      tool: 'search_tables',
      description: 'find tables',
      status: 'pending',
    },
    {
      phase: 'discovery',
      tool: 'describe_table',
      description: 'schema',
      status: 'pending',
    },
    {
      phase: 'query',
      tool: 'execute_sql',
      description: 'run',
      status: 'pending',
    },
  ],
});

describe('plan-progress', () => {
  it('marks matching step running and completes prior pending steps', () => {
    const running = markPlanStepRunning(samplePlan(), 'describe_table');
    assert.equal(running.discoverySteps[0].status, 'completed');
    assert.equal(running.discoverySteps[1].status, 'running');
    assert.equal(running.discoverySteps[2].status, 'pending');
  });

  it('marks step completed after tool finishes', () => {
    const afterRun = markPlanStepCompleted(
      markPlanStepRunning(samplePlan(), 'search_tables'),
      'search_tables'
    );
    assert.equal(afterRun.discoverySteps[0].status, 'completed');
    assert.equal(afterRun.discoverySteps[1].status, 'pending');
  });

  it('marks all steps completed at end of turn', () => {
    const done = markAllPlanStepsCompleted(samplePlan());
    assert.ok(done.discoverySteps.every((s) => s.status === 'completed'));
  });

  it('matches plan step tool names with functions. prefix', () => {
    const plan: QueryPlanData = {
      ...samplePlan(),
      discoverySteps: [
        {
          phase: 'discovery',
          tool: 'functions.search_tables',
          description: 'find',
          status: 'pending',
        },
      ],
    };
    const running = markPlanStepRunning(plan, 'search_tables');
    assert.equal(running.discoverySteps[0].status, 'running');
    const done = markPlanStepCompleted(running, 'search_tables');
    assert.equal(done.discoverySteps[0].status, 'completed');
  });
});
