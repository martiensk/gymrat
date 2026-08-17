import type { PlanSplit, PlanSplitKey } from '../types/plan';

export const PLAN_SPLITS: readonly PlanSplit[] = [
  { key: 'ppl', label: 'Push / Pull / Legs' },
  { key: 'upper_lower', label: 'Upper / Lower' },
  { key: 'full_body', label: 'Full Body' },
  { key: 'push_pull', label: 'Push / Pull' },
  { key: 'body_part', label: 'Body Part' },
  { key: 'custom', label: 'Custom' },
] as const;

export function getPlanSplit(key: PlanSplitKey) {
  return PLAN_SPLITS.find((split) => split.key === key) ?? PLAN_SPLITS[PLAN_SPLITS.length - 1];
}

export function isPlanSplitKey(value: string): value is PlanSplitKey {
  return PLAN_SPLITS.some((split) => split.key === value);
}
