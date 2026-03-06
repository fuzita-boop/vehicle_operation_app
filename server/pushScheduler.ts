import webpush from "web-push";

// VAPIDキーの設定
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:noreply@vehicle-app.local",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

/**
 * 帰着未入力のユーザーにプッシュ通知を送信する
 */
export async function sendArrivalReminders() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[PushScheduler] VAPID keys not set, skipping push notifications");
    return;
  }

  try {
    const { getIncompleteArrivalsByUser, getPushSubscriptionsByUser } = await import("./db");
    const incompleteMap = await getIncompleteArrivalsByUser();

    if (incompleteMap.size === 0) {
      console.log("[PushScheduler] No incomplete arrivals found");
      return;
    }

    console.log(`[PushScheduler] Sending reminders to ${incompleteMap.size} user(s)`);

    for (const [userId, count] of Array.from(incompleteMap.entries())) {
      const subscriptions = await getPushSubscriptionsByUser(userId);

      for (const sub of subscriptions) {
        const payload = JSON.stringify({
          title: "車両運行日報 - 帰着未入力",
          body: `帰着未入力の記録が${count}件あります。帰着時間を入力してください。`,
          url: "/daily-record",
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
          console.log(`[PushScheduler] Sent to userId=${userId}`);
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // 購読が無効になっている場合は削除
            const { deletePushSubscription } = await import("./db");
            await deletePushSubscription(userId, sub.endpoint);
            console.log(`[PushScheduler] Removed expired subscription for userId=${userId}`);
          } else {
            console.error(`[PushScheduler] Failed to send to userId=${userId}:`, err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("[PushScheduler] Error:", err);
  }
}

/**
 * 毎日18時（JST）に帰着リマインダーを送信するスケジューラーを起動する
 * JST = UTC+9 なので UTC 09:00 = JST 18:00
 */
export function startPushScheduler() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[PushScheduler] VAPID keys not configured, scheduler not started");
    return;
  }

  console.log("[PushScheduler] Starting daily 18:00 JST reminder scheduler");

  function scheduleNext() {
    const now = new Date();
    // 次のUTC 09:00を計算（JST 18:00）
    const next = new Date(now);
    next.setUTCHours(9, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    const msUntilNext = next.getTime() - now.getTime();
    console.log(`[PushScheduler] Next reminder scheduled in ${Math.round(msUntilNext / 60000)} minutes`);

    setTimeout(async () => {
      await sendArrivalReminders();
      scheduleNext(); // 次の日の18時にまた実行
    }, msUntilNext);
  }

  scheduleNext();
}
