---
title: 產品使用資料
source: docs/user/telemetry.md
source_hash: 5fd4f91c9327ca2510abf83689574782afcef4f0
---

T3 Code 的 server 會把產品使用事件送到 PostHog，並且關聯到一個經過雜湊的帳號識別碼或安裝識別碼。事件內容包含 Provider、模型、reasoning effort（推理強度）、權限模式、turn 的結果、執行時間，以及主要 agent 的 token 總數（有的話）。

事件不包含提示內容、回覆內容、檔案內容、驗證用的 token、對話 ID、Provider 的原始事件，也不包含子 agent 的輸出。子 agent 的 token 用量不會算進總數裡。

如果要停用資料收集，請在啟動 server 之前，在 server 的環境變數裡設定 `T3CODE_TELEMETRY_ENABLED=false`。這樣產品事件就不會被記錄，也不會被送出。

:::example 在終端機啟動 server 時停用
把變數寫在指令前面，只對這一次啟動有效：

```bash
T3CODE_TELEMETRY_ENABLED=false t3 serve
```

這個設定是 server 啟動時讀取的，所以已經在執行的 server 要先停掉再重新啟動，才會生效。
:::

:::note 設定的位置是 server，不是你手上的裝置
送出事件的是 server，所以變數要設在執行 server 的那台機器上。在手機或另一台電腦的 client 上設定沒有作用。另外，[背景服務](./background-service.md)不會沿用你終端機裡的環境變數：服務的設定檔只寫入它自己需要的幾個變數，所以在 shell 裡 `export` 之後再重新啟動服務，這個變數並不會傳進去。
:::
