export interface NotificationMessage {
  userId: string;
  alertId: string;
  title: string;
  body: string;
}

export interface DeliveryResult {
  channel: "in_app" | "email" | "line";
  status: "sent" | "skipped";
  detail: string;
}

/**
 * Transport stub. In-app always records. Email and LINE stay skipped until
 * SMTP_URL or LINE_CHANNEL_ACCESS_TOKEN is set, and even then this version
 * does not open a socket. A later adapter can become async without changing
 * the message shape.
 */
export interface NotificationAdapter {
  channel: DeliveryResult["channel"];
  deliver(message: NotificationMessage): DeliveryResult;
}

export const inAppAdapter: NotificationAdapter = {
  channel: "in_app",
  deliver() {
    return { channel: "in_app", status: "sent", detail: "Shown on the desk." };
  },
};

export const emailAdapter: NotificationAdapter = {
  channel: "email",
  deliver() {
    if (!process.env.SMTP_URL) {
      return {
        channel: "email",
        status: "skipped",
        detail: "SMTP_URL is not set. The email adapter is a stub.",
      };
    }
    return {
      channel: "email",
      status: "skipped",
      detail: "SMTP_URL is set, but outbound mail is not wired in this version.",
    };
  },
};

export const lineAdapter: NotificationAdapter = {
  channel: "line",
  deliver() {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return {
        channel: "line",
        status: "skipped",
        detail: "LINE_CHANNEL_ACCESS_TOKEN is not set. The LINE adapter is a stub.",
      };
    }
    return {
      channel: "line",
      status: "skipped",
      detail: "A LINE token is set, but the push call is not wired in this version.",
    };
  },
};

export const adapters: NotificationAdapter[] = [inAppAdapter, emailAdapter, lineAdapter];

export function dispatchNotification(message: NotificationMessage): DeliveryResult[] {
  return adapters.map((adapter) => adapter.deliver(message));
}
