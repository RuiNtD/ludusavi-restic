import prettyBytesRaw from "pretty-bytes";

export function isTruthy<T>(
  data: T
): data is Exclude<T, "" | 0 | false | null | undefined> {
  return Boolean(data);
}

export function prettyBytes(bytes: number) {
  return prettyBytesRaw(bytes, { binary: true });
}
