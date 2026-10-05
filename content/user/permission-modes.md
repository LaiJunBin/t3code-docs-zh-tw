---
title: 權限模式
source: docs/user/permission-modes.md
source_hash: c7e45519acdb3c6bbecf99336069cc98d4b7adf9
---

權限模式決定 agent 在什麼時候需要先取得你的核准才能動作。在訊息輸入框（composer）裡選擇模式，選好的模式只套用在那一個 Thread。

:::screenshot permission-mode-picker
訊息輸入框裡的權限模式選單，展開後列出四種模式。
:::

新 Thread 的預設模式在 **Settings → General → New threads → Permissions** 設定。專案可以覆寫環境的預設值。新 Thread 用的是這個設定，而不是你當時正在看的那個 Thread 的模式。一開始的預設值是 **Full access**；既有的 Thread，以及你在草稿裡自己選過的模式，都會保留原本的權限。

:::note 剛裝好時，agent 不會先問你
初始預設是 **Full access**，也就是 agent 執行指令、修改檔案都不會跳出核准提示。如果你希望 agent 動手前先問過你，請在送出第一則訊息之前，先把模式改成 **Supervised**，或是到上面那個設定路徑改掉預設值。
:::

| 模式                  | 行為                                                               |
| --------------------- | ------------------------------------------------------------------ |
| **Supervised**        | 執行指令和修改檔案前，都會請你核准。                               |
| **Auto-accept edits** | 自動核准檔案編輯；其他動作仍可能需要你核准。                       |
| **Auto**              | 交給 Provider 自己的自動審查：例行動作直接放行，其餘的才來問你。   |
| **Full access**       | 指令和編輯都直接執行，不跳出核准提示。                             |

:::example 同一個任務，在四種模式下的差別
假設你請 agent「把 `getUser` 改名成 `fetchUser`，改完跑一次測試」。這個任務包含兩種動作：修改檔案，以及執行測試指令。

| 模式                  | 修改檔案時                 | 執行測試指令時             |
| --------------------- | -------------------------- | -------------------------- |
| **Supervised**        | 先問你                     | 先問你                     |
| **Auto-accept edits** | 直接改                     | 仍可能先問你               |
| **Auto**              | 由 Provider 的審查機制決定 | 由 Provider 的審查機制決定 |
| **Full access**       | 直接改                     | 直接執行                   |

實際會不會跳出提示，還要看你用的是哪一個 Provider，見下方「各 Provider 的差異」。
:::

在對話中核准或拒絕請求，agent 才會繼續。權限模式不會阻止 agent 針對任務內容向你提問。

:::plain 「核准請求」和「提問」是兩回事
核准請求是 agent 問「我可以做這個動作嗎」，權限模式管的是這個。提問是 agent 問「你要的是 A 還是 B」，這跟權限無關，所以就算選了 **Full access**，agent 還是可能停下來問你問題。
:::

## 各 Provider 的差異 {#provider-differences}

每個 Provider 執行權限控管的方式不同。在 **Supervised** 模式下，有些唯讀動作可以直接進行。**Auto** 模式在 Codex、Claude、Cursor 和 Grok 上會使用它們的自動審查；沒有對應機制的 Provider（包括 OpenCode 和 Antigravity）則會退回成「每次都問你」。在 Grok 上，被它的審查擋下來的指令會轉交給你核准。

:::plain Auto 模式是誰在把關
**Auto** 模式下，判斷「這個動作安不安全」的是 Provider 自己（例如 Claude Code 或 Codex 內建的審查），不是 T3 Code。所以同樣選 **Auto**，換一個 Provider 行為就可能不同；Provider 沒有這種審查功能時，T3 Code 會保守處理，改成每次都問你。
:::

Grok 沒有 **Auto-accept edits** 模式。原本就設成這個模式的 Grok Thread 會以 **Supervised** 執行。Grok 的檔案變更核准會提供 **Allow all edits this session**（本次工作階段允許所有編輯）選項。它的指令核准則沒有「整個工作階段都允許」的選項，因為 Grok 會把那個指令記在整個專案上。

ACP Registry 的 agent 以它們自己的模式執行自己的工具；T3 Code 會依照權限模式回覆它們送來的核准請求。詳見 [ACP Registry 的權限](./providers-acp.md#permissions-and-terminals)。

Antigravity 即使在 **Full access** 模式下，仍可能送出它原生的核准請求。它只會對支援的動作提供「記住這次核准」的選項。

各 Provider 的設定方式與限制，請看 [Provider 指南](./install.md#providers)。

:::note 改壞了能不能復原
可以把對話倒回某一則訊息之前，但檔案能不能一起還原，要看 Thread 是在哪裡工作的。只有在 Worktree 裡執行的 Thread 才提供「連檔案一起還原」；直接在專案目錄工作的 Thread 只會倒回對話，檔案不會動。如果你打算用 **Full access** 放手讓 agent 做，建議開 Thread 時選 **New worktree**。細節見[編輯先前的訊息](./composer.md#edit-an-earlier-prompt)。
:::
