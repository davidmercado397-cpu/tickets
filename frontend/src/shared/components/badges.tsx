import type { PqrsStatus, Priority, SlaState, TaskStatus } from '@/shared/api/types';
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  SLA_LABEL,
  SLA_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from '@/shared/lib/labels';
import { Pill } from '@/shared/ui/pill';

export const StatusPill = ({ status }: { status: PqrsStatus }) => <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
export const PriorityPill = ({ priority }: { priority: Priority }) => (
  <Pill tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Pill>
);
export const SlaPill = ({ state }: { state: SlaState | null }) =>
  state ? <Pill tone={SLA_TONE[state]}>{SLA_LABEL[state]}</Pill> : <span className="text-xs text-muted-foreground">—</span>;
export const TaskStatusPill = ({ status }: { status: TaskStatus }) => (
  <Pill tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Pill>
);
