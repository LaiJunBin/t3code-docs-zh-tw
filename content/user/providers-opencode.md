---
title: OpenCode
source: docs/user/providers-opencode.md
source_hash: 9ecee2a0439c221c6ee63e7427ea96b2fb25323a
---

在執行你的 environment 的那台機器上安裝 OpenCode 並完成驗證，然後到 **Settings > Providers** 啟用它。見 [Provider 設定](./install.md#providers)。T3 Code 需要 OpenCode 1.14.19 或更新的版本，連接既有的 OpenCode server 時也一樣。

## OpenCode 2 {#opencode-2}

T3 Code 支援 OpenCode 2.0.18 及更新的版本。它會自己偵測版本，所以同一份 Provider 設定在 OpenCode 1.x 和 2.x 都能用。OpenCode 1.x 會在它的 Provider 設定裡顯示 **Limited support**。

OpenCode 2 是另一個獨立的套件 `@opencode/cli`。要從 1.x 換過去，請自己安裝它，例如 `npm install -g @opencode/cli`。然後重新整理 Provider 狀態。T3 Code 的更新按鈕更新的是你目前裝的那個套件。它絕對不會把 1.x 的安裝換成 2.x。

OpenCode 2 第一次執行時，會把共用的 OpenCode 資料庫轉換成它自己的格式。不要在同一台機器上同時並用 OpenCode 1.x 和 2.x。你在 1.x 開始的 Thread，到了 2.x 可以繼續。

:::note 升到 2.x 要自己動手
看到 **Limited support** 代表你裝的是 1.x，還是可以用，只是 T3 Code 的更新按鈕只會在 1.x 裡面往上更新，不會幫你跳到 2.x。要換到 2.x，就得自己安裝 `@opencode/cli`，裝完再重新整理 Provider 狀態。
:::

Plan 模式使用的是 OpenCode 的 `plan` agent。

## 本機或外部 server {#local-or-external-server}

**Server URL** 留空，T3 Code 就會在本機啟動 OpenCode。Provider 設定裡的密碼，會同時套用在那個 server 和 T3 Code 對它的連線上。沒有設定密碼時，本機 server 會使用它環境裡的 `OPENCODE_SERVER_PASSWORD`。

要使用既有的 OpenCode server，請在 Provider 設定裡填入 **Server URL** 和它的密碼。對外部 server，T3 Code 只使用這個設定好的密碼；它不會把本機的 `OPENCODE_SERVER_PASSWORD` 轉送過去。如果連線或版本檢查失敗，請檢查 URL、憑證和 OpenCode 的版本，然後重新整理 Provider 狀態。

:::plain 兩種模式的密碼從哪裡來
| **Server URL** | 誰啟動 OpenCode | 用哪個密碼 |
| --- | --- | --- |
| 留空 | T3 Code 在本機啟動 | Provider 設定裡的密碼；沒填的話，用環境變數 `OPENCODE_SERVER_PASSWORD` |
| 有填 | 你自己已經跑起來的 server | 只用 Provider 設定裡的密碼，環境變數不會被帶過去 |

所以連外部 server 連不上時，先確認密碼是填在 Provider 設定裡，而不是只設在環境變數。另外，設定頁上這個密碼欄位註明是以明文存在磁碟上的。
:::

連線中斷之後，再送一則訊息，就會重新連回同一個 OpenCode session。

## 核准 {#approvals}

OpenCode 依循共通的[權限模式](./permission-modes.md)。因為 OpenCode 沒有 AI 核准審查機制，**Auto** 的規則和 **Supervised** 相同。在受限的模式下，`.env`、`.env.local` 這類環境檔需要核准，即使一般的檔案讀取不需要；`.env.example` 則是允許的。

**Allow for workspace** 會套用到「使用同一個 workspace 的其他 OpenCode session」裡相符的請求。它的範圍比目前這個 Thread 更大，在共用的外部 server 上尤其如此。只想放行單一請求時，請用 **Allow once**。拒絕某個動作，並不會讓整個 turn 停下來。

:::plain Allow once 和 Allow for workspace 差在哪
**Allow once** 只放行眼前這一個請求，下次同樣的動作還是會再問。**Allow for workspace** 則是「這個 workspace 裡，以後相符的請求都不用再問」，而且不限於你現在這個 Thread，同一個 workspace 的其他 OpenCode session 也會適用。不確定的時候，選 **Allow once** 比較保守。
:::

## 重新整理模型、指令與 skill {#refresh-models-commands-and-skills}

變更 OpenCode 的登入或設定之後，請到該 environment 的 **Settings > Providers** 使用 **Refresh provider status**。在手機上，請用 Thread 設定裡的 **Refresh models**。重新連線也會重新整理目錄；定期的 Provider 健康檢查則不會。

憑證的變更會在重新整理時讀取。OpenCode 原生的設定檔，在本機的 helper 還在執行期間可能會一直留在快取裡。先讓它閒置 30 秒，期間不要重新整理模型、也不要有文字產生的工作，然後再重新整理一次，就會重新載入這些檔案。反覆重新整理反而會讓 helper 一直活著。外部 server 可能需要它自己重新載入或重新啟動，T3 Code 才看得到設定的變更。

:::example 改了 OpenCode 設定，T3 Code 卻沒變
1. 先到 **Settings > Providers** 按一次 **Refresh provider status**。
2. 如果還是舊的，不要連續一直按。放著 30 秒，這段時間不要重新整理、也不要觸發文字產生（例如產生 commit 訊息），然後再按一次。
3. 如果你用的是外部 server（有填 **Server URL**），到那個 server 上讓它重新載入或重新啟動，再回來重新整理。
:::

既有的 Thread 會保留它所選的模型和選項，即使那個模型已經從目錄裡消失。如果 OpenCode 拒絕那個模型，請選一個可用的模型再重試。
