interface UmamiTracker {
  track: (eventName: string, props?: Record<string, string | number | boolean>) => void;
}

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

export {};
