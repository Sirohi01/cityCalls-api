// Placeholder seam for the real Notification Engine (docs/13-notification-and-template-system.md),
// which is Phase 8 scope and not built yet. Every module that needs to send something calls this
// single function so swapping in the real engine later is a one-file change, not a hunt through
// every call site — matching the "notifications.trigger()" single-entry-point pattern from
// docs/manish/05-module-wise-backend-plan.md §Notifications, just not wired to a real channel yet.
export function sendPlaceholderNotification(context: { to: string; purpose: string; payload: Record<string, unknown> }): void {
  if (process.env.NODE_ENV !== 'production') {
     
    console.log(`[notification-stub] to=${context.to} purpose=${context.purpose}`, context.payload);
  }
  // In production, this currently does nothing beyond logging — no SMTP/AiSensy
  // integration exists yet (Phase 8). This is a known, documented gap, not a silent failure:
  // password-reset and OTP codes will not actually reach a user until that phase lands.
}
