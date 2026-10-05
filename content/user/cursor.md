---
title: Cursor
source: docs/user/cursor.md
source_hash: ad1a69ef956c26a79f9dbdcabe5764f9a3588bb1
---

Cursor V2 透過官方的 [`@cursor/sdk`](https://cursor.com/docs/api/sdk/typescript) TypeScript 套件執行。V2 的執行不使用 Cursor 的 ACP transport。

:::note 這一頁怎麼讀
這一頁和其他 Provider 指南不太一樣：只有「先決條件」和「登入」兩節是設定步驟，後面的「V2 功能對應」與「Replay 與實機測試」是在說明 adapter 的實作範圍和測試方式，主要給想了解限制或參與開發的人看。只想把 Cursor 用起來的話，讀完前兩節就夠了。另外，Cursor 在 T3 Code 裡預設是停用的，要先到 **Settings > Providers** 啟用。
:::

## 先決條件 {#prerequisites}

- Node.js 22.13 或更新的版本。Repository 所支援的 Node 版本已經滿足這項要求。
- 在 **Settings > Providers > Cursor** 用 Cursor 登入，或是在 `CURSOR_API_KEY` 提供 Cursor API key。
- 一個 Cursor SDK 接受的模型。`auto` 會以 SDK 的 `default` 模型選項送出。

Adapter 目前使用 SDK 的 local-agent runtime，所以 run 會在所選的 T3 Code workspace 裡進行。Cursor 的 cloud agent 需要 repository 和雲端環境的設定，T3 Code 目前還沒有提供這些設定。

## 登入 {#sign-in}

選擇 **Sign in**，然後開啟登入頁面，在瀏覽器裡完成登入。登入完成後 T3 Code 會自動更新。連到遠端 environment 時也同樣可以這樣做。在手機上，已經設定好的 Cursor instance 請用 **Settings > Provider accounts**。

每個 Provider instance 的登入，都保存在執行它的那個 environment 上。你的 Cursor 編輯器和 CLI 的登入是另外一回事。有設定 `CURSOR_API_KEY` 時，它會蓋過瀏覽器登入；要使用瀏覽器登入流程，請先移除這個覆寫。

:::plain 三種登入各管各的
在 T3 Code 裡登入 Cursor，和你在 Cursor 編輯器、Cursor CLI 裡的登入互不相干：其中一邊登入了，不代表另一邊也登入。T3 Code 這邊的登入是跟著 Provider instance、存在 environment 那台機器上的，所以換一個 environment 或新增一個 instance，都要各自再登入一次。
:::

在同一個設定區塊裡可以用 **Change account** 或 **Sign out**。兩者都會停止該 instance 執行中的 Thread，並保留它們的歷史紀錄。登出會讓 T3 Code 忘掉已儲存的憑證；如果要在產生的 key 到期之前就撤銷它，請到 Cursor dashboard 的 API keys 把它移除。

## V2 功能對應 {#v2-capability-mapping}

Adapter 支援：

- 建立與接續本機的 Cursor agent Thread；
- 在 turn 之間更換模型和模型參數；
- 助理文字、推理過程、工具活動、計畫與待辦事項的串流；
- 以 Thread 為範圍的 T3 Code MCP 工具；
- 圖片附件；
- 中斷、app 訊息佇列，以及由 orchestrator 負責的「中斷後重啟」式 steering；
- 透過 `Agent.messages.list()` 取得 Provider 的對話 snapshot；
- Cursor 的 `task` subagent，會投影成唯讀的子 app Thread，並帶有它們的工具活動與最終結果。

公開的 SDK 目前沒有提供原生的 agent fork、對話 rollback、進行中的 steering，也沒有互動式的核准 callback。直接的進行中 steering 會被宣告為不支援，而 V2 的 steering 走的是 orchestrator 的「中斷後重啟」路徑，並且在跨 Provider turn 時保留 app 的 run 身分。同一個 Provider 內的 Cursor fork，使用的是 orchestrator 的可攜式完整 Thread 上下文交接（portable full-thread context handoff），把內容交給一個全新的 Cursor agent。SDK 有 in-process 的自訂 callback 工具，但 V2 adapter 刻意改用經過驗證、以 Thread 為範圍的 MCP server。

:::plain 這些限制在使用上的意思
- **中途追加指示**：Cursor 沒辦法在工作進行中直接收下新指示，所以 T3 Code 的做法是先中斷目前的工作，再帶著新指示重新開始。
- **Fork**：不是複製 Cursor 那邊原生的對話，而是由 T3 Code 把 Thread 的內容整理後交給一個新的 Cursor agent。
- **核准請求**：SDK 沒有提供互動式的核准 callback，所以 T3 Code 沒辦法把 Cursor 的動作變成對話裡等你回覆的核准請求。Cursor 自己的 Auto-review 也不會以這種形式出現。
:::

可攜式交接會把符合條件的時間軸項目做成摘要，而且可能略去長訊息的結尾。如果某項工作必須把確切的指示原封不動帶過去，使用 fork 之前請先讀[可攜式交接裡的上下文](./portable-handoffs.md)。

Cursor 的 task event 帶有 `agentId`，但本機 SDK 並不會把這個識別碼註冊成可以接續的 agent：`Agent.resume()` 會回傳 `AgentNotFoundError`。因此 adapter 不會把 Provider thread 附加到原生的 task projection 上，也不會宣告 subagent 的 thread ID。投影出來的子 Thread 是唯讀的：要送訊息請從父 Thread 送。

Runtime 模式會對應到本機 SDK 所提供的控制項：full access 會停用它的 sandbox，受限的模式以及明確指定的非 full-access sandbox 政策則會啟用 sandbox。明確指定的核准政策覆寫，也會控制 Cursor 的 Auto-review。Auto-review 不會呈現成 T3 Code 的互動式核准流程。

既有的 Cursor binary path 和 API endpoint 設定屬於 CLI／ACP 整合。Cursor V2 的執行不會啟動那個執行檔，SDK 也沒有提供覆寫 API endpoint 的方式。

## Replay 與實機測試 {#replay-and-live-testing}

Cursor 的 replay fixture 保留了 SDK 這一層邊界：agent 的 open／resume、送出、依序的 `onDelta` 更新、終止結果、取消、訊息 snapshot，以及 close。真正的 V2 adapter、orchestrator、event store、projection 和 checkpoint 邏輯，在測試裡仍然會實際執行。

用以下指令對真正的 SDK 錄製一份 fixture：

```bash
pnpm --filter t3 record:cursor-replay --scenario simple
```

用 `--out <path>` 可以錄一份暫時的探測結果，而不取代已經 check in 的 fixture。傳入無效的 scenario 時，錄製程式會列出支援的 scenario。
