export function readableModelFile(uri: string | null | undefined): string | null {
  if (typeof uri !== "string" || uri.length === 0) {
    return null;
  }
  if (
    uri.startsWith("asset:") ||
    uri.startsWith("file:///android_asset") ||
    uri.startsWith("file:///android_res/")
  ) {
    return null;
  }
  if (uri.startsWith("file://") || uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }
  return null;
}
