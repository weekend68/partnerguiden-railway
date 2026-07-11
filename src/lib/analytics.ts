type AnalyticsEventProps = Record<string, string | number | boolean>;

// Kept in sync by AuthProvider. Tracks only WHETHER a session exists, not who -
// never store user id/email here.
let isLoggedIn = false;

export function setAnalyticsLoggedIn(value: boolean): void {
  isLoggedIn = value;
}

/**
 * Fire a custom Umami event. Always includes `logged_in`. No-op if the
 * script hasn't loaded (ad-blocked, dev environment, or not yet initialized).
 * Never pass email, name, user ID or free text in props.
 */
export function track(eventName: string, props?: AnalyticsEventProps): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(eventName, { logged_in: isLoggedIn, ...props });
  } catch {
    // analytics must never break the app
  }
}
