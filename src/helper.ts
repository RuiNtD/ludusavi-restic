export function isTruthy<T>(
  data: T
): data is Exclude<T, "" | 0 | false | null | undefined> {
  return Boolean(data);
}

export function findEXE(exeName: string, envName: string) {
  const envPath = Bun.env[envName];
  if (envPath) return envPath;

  const exePath = Bun.which(exeName);
  if (exePath) return exePath;
}
