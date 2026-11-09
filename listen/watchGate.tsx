export function canWatchHere(): boolean {
  return false;
}

export function WatchScreen(_props: {
  onWarning: (phrase: string) => void;
  onReady: (phrase: string) => void;
  onCameraDenied: () => void;
  onModelError: () => void;
}) {
  return null;
}
