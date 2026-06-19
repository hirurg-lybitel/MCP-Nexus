'use client';

import { useState } from 'react';
import type { QueryPlanData, QueryPlanStep } from '@/types';
import {
  ChevronDown,
  Circle,
  CircleCheck,
  ListTodo,
  Loader2,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n/use-translations';

interface QueryPlanViewProps {
  data: QueryPlanData;
}

function PlanStepIcon({ status }: { status: QueryPlanStep['status'] }) {
  if (status === 'running') {
    return (
      <Loader2 className="w-3.5 h-3.5 shrink-0 text-gray-300 animate-spin mt-0.5" />
    );
  }
  if (status === 'completed') {
    return (
      <CircleCheck
        className="w-3.5 h-3.5 shrink-0 text-gray-500 mt-0.5"
        strokeWidth={1.75}
      />
    );
  }
  return (
    <Circle
      className="w-3.5 h-3.5 shrink-0 text-gray-600 mt-0.5"
      strokeWidth={1.75}
    />
  );
}

export default function QueryPlanView({ data }: QueryPlanViewProps) {
  const steps = data.discoverySteps;
  const [expanded, setExpanded] = useState(true);
  const { t } = useTranslations();

  const stepLabel = (step: QueryPlanStep): string => {
    const text = step.description?.trim();
    if (text) {
      return text;
    }
    const tool = step.tool?.replace(/^functions\./i, '').replace(/_/g, ' ');
    return tool || t('plan.step');
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left cursor-pointer hover:opacity-90"
        aria-expanded={expanded}
      >
        <ListTodo className="w-4 h-4 shrink-0 text-yellow-400" />
        <span className="text-xs font-semibold text-yellow-400 flex-1 min-w-0">
          {t('plan.todos')}
        </span>
        <span className="text-xs tabular-nums text-yellow-400/70 shrink-0">
          {steps.length}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-yellow-400/80 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-gray-600/80 bg-gray-900/70 px-2.5 py-2 min-w-0">
          <ul className="space-y-1.5">
            {steps.map((step, i) => {
              const status = step.status ?? 'pending';
              const done = status === 'completed';
              const active = status === 'running';

              return (
                <li
                  key={`${step.tool ?? 'step'}-${i}`}
                  className="flex items-start gap-2 min-w-0"
                >
                  <PlanStepIcon status={status} />
                  <span
                    className={`text-xs leading-relaxed min-w-0 ${
                      done
                        ? 'line-through text-gray-500'
                        : active
                          ? 'text-gray-200'
                          : 'text-gray-400'
                    }`}
                  >
                    {stepLabel(step)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
