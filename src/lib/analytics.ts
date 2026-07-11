type AnalyticsEventProps = Record<string, string | number | boolean>;

/**
 * Fire a custom Umami event. No-op if the script hasn't loaded
 * (ad-blocked, dev environment, or not yet initialized).
 * Never pass email, name, user ID or free text in props.
 */
export function track(eventName: string, props?: AnalyticsEventProps): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(eventName, props);
  } catch {
    // analytics must never break the app
  }
}
