export interface DueDatePreset {
  label: string;
  value: Date | null;
  destructive?: boolean;
}

export function buildDueDatePresets(now: Date): DueDatePreset[] {
  const todayAt21 = new Date(now);
  todayAt21.setHours(21, 0, 0, 0);

  const tomorrowAt21 = new Date(todayAt21);
  tomorrowAt21.setDate(todayAt21.getDate() + 1);

  const nextWeekAt21 = new Date(todayAt21);
  nextWeekAt21.setDate(todayAt21.getDate() + 7);

  return [
    { label: '今日 21:00', value: todayAt21 },
    { label: '明日 21:00', value: tomorrowAt21 },
    { label: '1週間後 21:00', value: nextWeekAt21 },
    { label: '期限を解除', value: null, destructive: true },
  ];
}

