function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

export function nextLocalDateKey(date: Date): string {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);

  return localDateKey(nextDate);
}
