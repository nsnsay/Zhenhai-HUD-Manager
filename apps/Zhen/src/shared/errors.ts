/** 统一把 unknown 异常转成可展示的文本。 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}