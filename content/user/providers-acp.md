---
title: ACP Registry
source: docs/user/providers-acp.md
source_hash: adf4e17af631221f583bceaba153940414ddb7aa
---

T3 Code 可以執行官方 [ACP Registry](https://agentclientprotocol.com/get-started/registry) 裡的 coding agent。Registry 的 agent 帶著自己的模型、工具和登入方式，T3 Code 則提供專案、Thread、checkpoint 和任務委派。

:::plain 這一頁在講什麼
除了 Codex、Claude 這些內建的 Provider 之外，T3 Code 還能從一份公開的 agent 目錄（ACP Registry）裡挑 agent 來用。這些 agent 都是用同一套通用的方式接進來的，所以功能的完整度要看各個 agent 自己支援多少，這一頁說明的是這套通用整合的行為。
:::

Google Antigravity 可以透過它官方的 `antigravity-acp` Registry 項目來使用。新增方式和其他 Registry agent 一樣；它不需要 T3 Code 裡 Antigravity 專用的 Provider。

T3 Code 優先使用目前的 ACP v2 preview 協定；agent 有支援的話，就會用上它更豐富的訊息、用量、計畫、設定、壓縮和 agent 終端機更新。對於還沒遷移的 Registry agent，它也會協商使用 ACP v1，所以像 Pi 這樣的 agent 仍然可以透過同一套通用整合運作。

## 新增 agent {#add-an-agent}

1. 開啟 **Settings → Providers**。
2. 選 **Add provider**，然後搜尋 ACP Registry。
3. 搜尋要用的 agent，在它的結果上選 **Add**。
4. 確認名稱和 instance ID，然後完成該 agent 的登入步驟。

搜尋結果只會列出能在目前連線的 server 上執行的 agent。Registry 的 agent 是第三方程式碼；新增之前，請先看過該 agent 的原始碼和授權。

:::screenshot acp-registry-add-provider
**Add provider** 對話框裡搜尋 ACP Registry 的畫面，搜尋結果列出可新增的 agent，每一筆旁邊有 **Add** 按鈕。
:::

## Agent 在哪裡執行 {#where-agents-run}

Registry 的 agent 一律在架設你 T3 Code server 的那台機器上執行。即使你是透過 `app.t3.codes`、T3 Connect 或 relay 連線，也是如此。

Agent 會安裝在 T3 home 裡的 `tools/<agent-id>/<version>/` 底下。Registry 項目有提供 SHA-256 時，T3 Code 會加以驗證；沒有 checksum 的項目，則仍有 Registry 的 HTTPS 發佈保證。Registry 的 `npx` 和 `uvx` 套件，會使用 T3 自己的 npm prefix 和 Python 工具目錄，版本就是 Registry 所公布的那個確切版本。它們的指令在新開的 server 終端機裡就能使用，可以用來登入或直接操作。移除某個 agent 的最後一個 Provider instance 時，會移除由 T3 管理的二進位檔，但保留套件安裝。要使用既有的本機執行檔，請明確設定 **Executable override**。

:::plain 白話版
新增一個 Registry agent，等於讓 T3 Code 在 server 那台機器上幫你下載並安裝它，而且裝在 T3 Code 自己的資料夾裡，不會和你自己另外裝的版本混在一起。裝好之後，在 T3 Code 裡新開一個終端機就能直接用它的指令。如果你想用自己已經裝好的那一份，就要自己在 **Executable override** 指定路徑。
:::

## 登入 {#signing-in}

在網頁版或桌面版的 **Settings → Providers** 開啟該 agent 的帳號區塊。選 **Sign in**，如果 agent 提供多種方式，就選其中一種。對於已安裝、已設定的 Provider，手機上也可以用 **Settings → Provider accounts**。

瀏覽器登入會顯示 agent 的 URL，並等你開啟或複製它之後，才告訴 agent 繼續。頁面是在你的裝置上開啟的，agent 則是在 environment 上執行。終端機式的登入方式，會在該 environment 上的 app 內終端機裡執行。在手機上，請透過終端機回應欄位送出回覆。終端機登入之後 T3 Code 會重新連線，並等 agent 確認已登入，才回報成功。登入逾時的話可以取消或重試。

瀏覽器和終端機登入的憑證，都留在 agent 自己的儲存區裡。透過環境變數使用 API key 的 agent，還是從 instance 的環境設定裡取得那些 key。已設定的環境或 agent home，會同時套用在登入和對話上。

如果 agent 有宣告支援登出，就選 **Sign out**。變更共用的 agent 登入，會停止該 environment 上同一個 agent 的各個 instance 執行中的 Thread。Thread 歷史和 workspace 的檔案會保留。ACP 並沒有規範帳號隔離，所以多新增一個 instance 不保證就是另一個帳號；agent 有支援的話，請用它自己的設定來隔離帳號。

:::note 多加一個 instance 不等於多一個帳號
內建的 Codex、Claude 可以用不同的 instance 區分帳號，但 Registry agent 不一定。同一個 agent 的幾個 instance 可能共用同一份登入，所以其中一個登出或換帳號時，其他 instance 執行中的 Thread 也會被停掉。要不要、能不能分帳號，得看那個 agent 自己提供什麼設定。
:::

如果 agent 無法在遠端完成它所宣告的登入流程，它的 CLI 在 server 上仍然可以使用。例如 Codex 支援 `codex login --device-auth`，Grok Build 支援 `grok login --device-auth`。

## 模型與選項 {#models-and-options}

模型選單列出的是 agent 回報的模型。如果 agent 沒有回報任何模型，或是隱藏了一部分，請在 instance 設定的 **Custom models** 底下加入你自己的模型 ID。

Agent 提供的其他設定，例如 reasoning effort 或核准模式，會像內建 Provider 一樣，出現在訊息輸入框（composer）的模型選項選單裡。有自己的 plan 和 build 模式的 agent，會跟著 T3 Code 的 Plan／Build 切換。Agent 執行期間如果模型和選項有變動，選單會直接更新，不必等下一次 Provider 探測。

## 指令與 skill {#commands-and-skills}

Session 執行期間，agent 提供的斜線指令會出現在 `/` 選單的 **Provider** 底下。Agent 以 `$` 開頭命名的指令，則會出現在 T3 Code 的 `$` skill 選單裡。

## 原生 session {#native-sessions}

當 agent 宣告支援 ACP 的 session 列表與匯入時，展開它的 Provider 卡片、選一個專案，然後選 **List sessions**。匯入其中一個，會建立一個以該原生 session 為後盾、具確定性（deterministic）的 T3 Thread。再次匯入同一個 agent session 時，會回到既有的那個 Thread，就算是由另一個 client 執行匯入也一樣。

:::plain 「具確定性」的實際效果
同一個原生 session 不管匯入幾次、從哪一台裝置匯入，得到的都是同一個 T3 Thread，不會越匯越多份。所以不確定之前有沒有匯入過的時候，再按一次也沒關係。
:::

Thread 會把原生 session 的標題和最後更新時間保存為 Provider metadata，但不會蓋掉你在 T3 Code 裡設定的標題。有回報 ACP context 用量的 agent，會驅動 composer 的 context 用量表和累計成本 metadata。文字資源和連結會呈現為助理輸出；T3 Code 還無法呈現的二進位資源、圖片和音訊，會以明確的佔位符顯示，而不是直接消失。

## 權限與終端機 {#permissions-and-terminals}

Registry 的 agent 自己讀檔、編輯和執行指令，遵循的是它們自己的 sandbox 和核准規則。它們一開始使用自己的預設模式，模型選項選單裡的模式選擇器可以切換。Agent 被限制到什麼程度，取決於那個模式和 agent 自己的設定，所以在意這件事的時候，請使用它的 sandbox 和權限控制。

當 Registry agent 要求核准時，T3 Code 會依照 Thread 的[權限模式](./permission-modes.md)來回覆：**Supervised** 會把請求顯示在對話裡，**Auto-accept edits** 會核准編輯、其餘的顯示出來，**Auto** 和 **Full access** 則自動核准。檔案的讀取和搜尋永遠不會等待核准。

:::example agent 送來核准請求時，T3 Code 怎麼回
| Thread 的權限模式     | 編輯類的請求     | 其他請求         |
| --------------------- | ---------------- | ---------------- |
| **Supervised**        | 顯示在對話裡問你 | 顯示在對話裡問你 |
| **Auto-accept edits** | 自動核准         | 顯示在對話裡問你 |
| **Auto**              | 自動核准         | 自動核准         |
| **Full access**       | 自動核准         | 自動核准         |

這張表只管「agent 有來問」的情況。agent 要不要來問、哪些動作會被它自己的 sandbox 擋下，是由 agent 自己的模式決定的，T3 Code 的權限模式改不了那一層。
:::

Devin 透過 T3 Code 的終端機執行它的指令，那些指令會依循 Thread 的權限模式。至於其他 agent，T3 Code 會顯示 agent 回報的指令、輸出和結束狀態，但不會執行或停止它們的終端機。

Registry 的 agent 可以排程工作，也可以使用 T3 的 MCP 工具。子任務的呈現方式取決於 agent 提供了什麼：ACP 沒有可攜的原生 subagent 血緣（lineage）規範，所以比較豐富的委派檢視仍然是各 agent 各自的。

## Checkpoint {#checkpoints}

Checkpoint rollback 會照常還原你的檔案。但 ACP agent 無法倒回它們自己的對話，所以 rollback 之後的下一個 turn，會開始一個全新的 agent session，它不再記得 checkpoint 之前的對話。

:::plain rollback 之後 agent 會「失憶」
檔案會回到 checkpoint 當時的樣子，T3 Code 裡的對話紀錄你也還看得到，但 agent 那一邊是從一個全新的 session 開始，之前談過的需求和背景它都不記得。所以 rollback 之後的第一則訊息，要把必要的背景重新交代一次。
:::

Registry 的 instance 不會用在 T3 這個 app 自己負責的文字產生上，例如 Thread 標題、commit 訊息、分支名稱或 pull request 說明。這些動作請另外設定一個能做文字產生的 Provider。

## 進階設定 {#advanced-configuration}

- **Executable override** 會執行既有的本機執行檔，而不是受管理的發佈版本，同時保留 Registry 所宣告的參數和環境。
- **Authentication method** 在 agent 宣告了不只一種方式時，用來指定其中一種。
- **Custom models** 用來加入 agent 沒有回報的模型 ID。
