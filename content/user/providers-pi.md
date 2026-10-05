---
title: Pi
source: docs/user/providers-pi.md
source_hash: f57272b4de529edf0702b4c114f479a99aa110cb
---

T3 Code 可以使用你既有的 Pi coding agent 安裝，同時保留 Pi 的模型、驗證、extension、skill、context 檔案，以及原生的 session 歷史。

## 設定 Pi {#set-up-pi}

1. 在執行 T3 Code server 的那台機器上安裝 Pi。建議使用 Pi 1.0；T3 Code 支援的最舊版本是 0.80.5。
2. 在終端機裡執行一次 Pi，完成你平常使用的 Provider 登入或 API key 設定。
3. 開啟 T3 Code 的 Settings，啟用 Pi，然後重新整理這個 Provider。

如果 `pi` 不在 server 的 `PATH` 上，請把 Pi 的 binary path 設成那個執行檔。安裝環境需要自訂 agent 目錄、端點或模型設定時，也可以使用 Provider 的環境變數和 launch arguments。`--provider` 必須和 `--model` 成對使用。會改變 Pi 執行模式或指定 session 的 launch arguments，T3 Code 會拒絕，因為行程生命週期的這些部分是由 T3 負責的。

:::note 哪些 launch arguments 會被拒絕
T3 Code 是用它自己指定的模式啟動 Pi、並自己管理 session 的，所以 **Launch arguments** 只是附加在這個啟動指令後面的額外參數。和這兩件事衝突的旗標會被擋下來，例如 `--mode`、`--print`、`--session`、`--resume`、`--continue`、`--no-session`、`--fork`。也不能在裡面直接寫一段提示文字。
:::

## 哪些東西會沿用 {#what-carries-over}

T3 Code 會找出 Pi 回報的模型，並提供它們各自支援的 thinking 等級。Thinking 選單會把 Pi 目前設定的等級標成預設，但不會去覆寫它。Thread 使用 Pi 原生的 session 檔案來做接續、rollback，以及同一個 Pi instance 內的 fork。Fork 會在目的 workspace 裡，保留到所選 turn 為止的原生對話。切換 Provider 時使用的是可攜式對話上下文。Extension 的對話框會出現在 T3 Code 的訊息輸入框（composer）裡；composer 的 context 用量表則是跟著 Pi 自己回報的用量走，在回覆串流期間與結束之後都是如此。

Pi 的 skill 會出現在 composer 的 `$` 選單裡。這包括使用者層級的 skill，以及 Pi 為目前 workspace 載入的專案 skill；選擇其中一個時，使用的是 Pi 原生的 skill 展開機制。

Pi 會載入它平常的使用者層級與專案層級 extension。會阻擋流程的 `select`、`confirm`、`input` 和 `editor` 對話框，在 T3 Code 裡都能運作。通知會出現在工作紀錄裡。Pi 在終端機上的裝飾，例如標題、狀態列和 widget，在 T3 Code 裡沒有對應的呈現。

:::plain 整理一下：什麼跟著來，什麼沒有
跟著來的：模型與 thinking 等級、登入、skill（在 `$` 選單）、extension 以及它們會跳出來問你的對話框、通知、對話歷史。

沒有對應的：Pi 在終端機畫面上的裝飾，像是標題、狀態列和 widget。

另外要留意，在同一個 Pi instance 裡 fork 或 rollback 用的是 Pi 自己的對話紀錄；但如果中途換成別的 Provider，帶過去的是可攜式的對話上下文，而不是 Pi 原生的對話。
:::

## 權限模式 {#permission-modes}

T3 Code 透過 Pi 的 blocking tool hook 套用 composer 裡的權限模式：

- **Supervised** 在執行指令、變更檔案和使用 extension 工具之前會先問你。唯讀的工具會直接繼續。
- **Auto-accept edits** 允許 Pi 的 edit 和 write 工具，但執行指令和使用 extension 工具之前會先問你。
- **Full access** 允許工具執行，不會出現 T3 Code 的核准提示。

:::example 三種模式的對照
| 模式                  | 執行指令 | 修改檔案 | Extension 工具 |
| --------------------- | -------- | -------- | -------------- |
| **Supervised**        | 先問你   | 先問你   | 先問你         |
| **Auto-accept edits** | 先問你   | 直接做   | 先問你         |
| **Full access**       | 直接做   | 直接做   | 直接做         |
:::

Pi 不會顯示 **Auto** 這個選項，因為 Pi 沒有提供 AI 核准審查機制。在加入 Pi 支援之前就已經存成 Auto 的 Thread，行為和顯示都會是 Supervised。

變更模式會重新啟動 Pi 的 Provider session，並接續同一個原生對話。這套政策涵蓋的是 Pi 的工具呼叫；它不是作業系統層級的 sandbox，受信任的 Pi extension 在工具呼叫之外執行的程式碼，仍然由 Pi 自己的 extension 信任模型管理。

:::plain 權限模式管不到的地方
權限模式是在 Pi「要呼叫工具」的那一刻攔下來問你，它並沒有把 Pi 關進一個受限的環境裡。所以你裝的 extension 如果在工具呼叫以外自己執行程式碼，T3 Code 的權限模式不會攔到，那部分要靠 Pi 本身對 extension 的信任設定。
:::

T3 Code 的 `delegate_task` 工具會在共用的 subagent UI 裡建立持久的子 Thread。如果使用者安裝了 Pi 的範例 `subagent` extension，T3 Code 也會在那個 UI 裡顯示它的工作進度和結果。Pi 執行這些子工作時不帶 session，所以它們無法當成 T3 Code 的 Thread 來開啟或接續。

## 疑難排解 {#troubleshooting}

- 如果 Pi 無法使用，請確認設定的執行檔在 server 那台機器上可以執行，然後到 Settings 重新整理這個 Provider。
- 如果沒有出現任何模型，請直接開啟 Pi，確認它的驗證和模型設定。
- 如果模型探索無法完成，T3 Code 會以 `Pi default` 模型讓 Pi 維持可用。開一個 Thread，讓互動式的 Pi session 去處理啟動時的提示。
- 如果少了某個專案 extension，請在 Pi 裡核准這個專案，然後開始一個新的 Provider session。
- 如果 `$` 選單裡少了某個專案 skill，請在 Pi 裡核准這個專案，然後重新整理這個 Provider。
- Context 用量表要等 Pi 回報了這個 Thread 的用量之後才會出現。有些模型供應商只在回覆完成時才回報用量，所以用量表可能要等到第一則回覆之後才出現。
