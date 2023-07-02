import { ChangeEvent } from "react";

function forceTwo(inp: number) {
  return inp.toString().padStart(2, "0");
}

export function formatHtmlDateTime(dateTime: Date) {
  return `${dateTime.getFullYear()}-${forceTwo(
    dateTime.getMonth() + 1
  )}-${forceTwo(dateTime.getDate())}T${forceTwo(
    dateTime.getHours()
  )}:${forceTwo(dateTime.getMinutes())}`;
}

export const getTimestampFromDateInputEvent = (
  event: ChangeEvent<HTMLInputElement>
) =>
  Math.round(
    new Date(
      new Date(event.target.value)
        .toUTCString()
        .split(" ")
        .filter((_, i) => [1, 2, 3].includes(i))
        .join("-")
    ).valueOf() / 1000
  );
