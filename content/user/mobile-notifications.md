---
title: 手機通知
source: docs/user/mobile-notifications.md
source_hash: 9c5e30ef760746bc31cdc190392305eaedf13a80
---

登入 T3 Connect、連結你的 environment，並在 **Settings → Notifications** 啟用 **Device Notifications**（裝置通知），就能在 agent 完成、失敗、需要核准，或是需要你輸入時收到提醒。點一下通知會開啟對應的 Thread。你的 environment 必須啟用「發布 agent 活動」（agent activity publishing）。

:::note 「發布 agent 活動」在哪裡開
這個開關在主機那一邊，不在手機上。在主機的網頁版或桌面版，開啟 **Settings → Connections**，找到 **Publish agent activity**。如果主機只有命令列，執行 `t3 connect publish`；要停止發布則加上 `--disable`。
:::

在 Android 上啟用 **Ongoing Agent Activity**，或在 iOS 上啟用 **Live Activity Updates**，不用開啟 app 就能追蹤工作進度。完成的結果最多會保留顯示 15 分鐘。你可以把 Android 的活動卡片滑掉，這不會停用提醒；要讓之後不再出現卡片，請到 Settings 關閉 ongoing activity。

一般的提醒在手機 app 位於前景時會保持安靜。進行中的活動則會繼續更新。在另一台裝置上查看某個 Thread，並不會讓你手機上的提醒靜音。

Android 通知需要 Android 7.0 以上的版本，以及 Google Play 服務。Android 16 以上的版本可以把進行中的活動提升為 Live Update，但要視系統設定和裝置支援而定。其他裝置則顯示一般的持續性通知。Android 7 的省電模式可能會讓過期的卡片比較晚才被移除。

通知權限和 Android 的通知頻道是在系統的「設定」裡控制的。背景推播需要 T3 Connect；只有直接連線或 Tailscale 連線，並不會啟用推播通知。手機 app 不需要一直維持和 environment 的連線。在系統「設定」裡強制停止 Android app 之後，推播會送不進來，直到你再次開啟 app 為止。

:::plain 收不到通知時，依序檢查這幾件事
1. 手機 app 已經登入 T3 Connect，而且 environment 已經連結。只用區域網路配對或 Tailscale 連線的話，不會有推播。
2. 手機 app 的 **Settings → Notifications** 裡，**Device Notifications** 已經啟用。
3. 主機那邊已經啟用發布 agent 活動。
4. 手機系統的「設定」裡，這個 app 的通知權限是開的。
5. Android 上沒有把 app 強制停止過；如果有，重新開啟一次 app。
:::
