function forceTwo(inp: number) {
  return inp.toString().padStart(2, "0");
}

export function formatHtmlDateTime(dateTime: Date) {
  return `${dateTime.getFullYear()}-${forceTwo(
    dateTime.getMonth() + 1,
  )}-${forceTwo(dateTime.getDate())}T${forceTwo(
    dateTime.getHours(),
  )}:${forceTwo(dateTime.getMinutes())}`;
}
