---
title: Codex
source: docs/user/providers-codex.md
source_hash: bdc87902a63b2b4b7a3895efef2d911016d6981e
---

你可以用自己的 ChatGPT 方案，或是既有的 Codex CLI 登入，在 T3 Code 裡寫程式。

:::plain 兩種接法，擇一即可
這一頁的前兩節是兩條不同的路。**Connect with ChatGPT** 是在 T3 Code 裡直接登入 ChatGPT 帳號，Codex 由 T3 Code 幫你裝好，不需要自己把 `codex` 加進 `PATH`。「使用既有的 Codex 登入」則是沿用你已經自己裝好、登入好的 Codex CLI。第一次用的話，照第一種做就可以。
:::

## 用 ChatGPT 連接 {#connect-with-chatgpt}

在初次設定流程中，或是在 **Settings → Providers** 裡連接。如果要連的是遠端機器，請先選好那個 environment。Codex 的安裝由 T3 Code 處理；你只要在 OpenAI 的頁面登入，並同意分享你的 ChatGPT 方案。

共用的用量與點數是在 ChatGPT 那邊管理的，從 T3 Code 裡的 **Manage usage** 可以過去。如果某個請求用到 ChatGPT 分享不支援的功能，那個請求請改用其他 Provider。

重新連接時，在 T3 Code 裡和 OpenAI 的登入頁面上要選同一個帳號。中斷連接會停止執行中的 Thread，但會保留它們的歷史紀錄，之後還可以重新連接。

如果遠端登入無法自動返回，請把最後那個 localhost 頁面的完整 URL 貼到登入面板裡，即使那個頁面沒辦法載入也一樣。

:::note 「頁面打不開」不代表登入失敗
從另一台裝置登入遠端機器時，最後一步會跳到一個 localhost 開頭的網址，瀏覽器很可能顯示無法連線。這時不要關掉分頁，把網址列裡的整串 URL 複製起來，貼回 T3 Code 的登入面板就可以完成登入。
:::

## 使用既有的 Codex 登入 {#use-an-existing-codex-login}

T3 Code 可以使用你已經安裝的 Codex，以及它既有的登入。要登入的話，在 environment 所在的那台機器上執行 `codex login`。安裝方式與自訂設定見 [Provider 設定](./install.md#providers)。

## 使用多個帳號 {#use-multiple-accounts}

在 **Settings → Providers** 新增另一個 ChatGPT 帳號，然後在 Thread 的模型選單裡選擇要用的帳號。相容的帳號可以接續同一個 Thread。透過 T3 Code 連接帳號，不會動到你的 CLI 登入。

### 多個 CLI 登入 {#multiple-cli-logins}

用一個共用的 Codex home 搭配一個 shadow home，就能讓工作帳號和個人帳號接續同樣的 Thread。這些帳號共用 Codex 的 session 和設定，但各自保有自己的登入和可用的模型。

:::plain 共用 home 和 shadow home 是什麼關係
Codex home 是 Codex 存放設定、對話紀錄和登入資料的資料夾。這裡的做法是：兩個帳號都指向同一個主要的 home（所以看得到同樣的對話和設定），第二個帳號另外多一個 shadow home，只用來放它自己的登入。可以想成兩個人共用同一個檔案櫃，但各自帶自己的門禁卡。
:::

第一個帳號留在 `~/.codex`。在 environment 所在的那台機器上，讓第二個帳號登入到一個全新的目錄：

```bash
mkdir -p ~/.codex_personal
CODEX_HOME=~/.codex_personal codex login
```

接著在 **Settings > Providers** 新增第二個 Codex instance：

| Instance       | CODEX_HOME path | Shadow home path    |
| -------------- | --------------- | ------------------- |
| Codex Work     | `~/.codex`      | 留空                |
| Codex Personal | `~/.codex`      | `~/.codex_personal` |

兩個 instance 的 **CODEX_HOME path** 必須相同。共用的狀態會由 T3 Code 在 shadow 目錄裡準備好；不要用「把整個 Codex home 複製過去」的方式來填它。

:::screenshot codex-instance-shadow-home
**Settings → Providers** 裡第二個 Codex instance 的設定欄位，可以看到 **CODEX_HOME path** 填 `~/.codex`、**Shadow home path** 填 `~/.codex_personal`。
:::

Shadow 帳號需要有自己的 `auth.json` 檔案。如果 Codex 用的是作業系統的憑證儲存區，這種設定方式請改成用檔案儲存。見 [OpenAI 的憑證儲存說明](https://learn.chatgpt.com/docs/auth#credential-storage)。

如果你要的是各自獨立的 Codex session 和設定，就用一個完全不同的 **CODEX_HOME path**，不要設 shadow home。這樣的 instance 無法接續另一個 home 的 Thread。

## 在既有的 Thread 裡切換帳號 {#switch-accounts-in-an-existing-thread}

在 Thread 的模型選單裡選另一個帳號。T3 Code 會列出與這個 Thread 共用同一個 **CODEX_HOME path** 的相容 Codex instance。切換帳號不會把對話搬到另一個 Codex home。

如果選單裡找不到那個帳號，請到 Provider 設定裡比對兩邊的 home 路徑。如果兩個 instance 顯示的是同一個、而且不是你預期的帳號或模型，請檢查它們回報的帳號、重新整理 Provider 狀態，並確認第二個 instance 有自己的 shadow 路徑和登入。出現 shadow home 衝突，通常代表那個目錄裡放的是複製過來的 Codex 設定。請改用一個全新的 shadow 目錄，然後重新登入。

## 在 Codex 工作時回答問題 {#answer-questions-while-codex-works}

Codex 可以一邊提問、一邊繼續工作。請在 Thread 的提問面板裡回答。你的回答會變成一則新訊息：如果 turn 還在進行，它會送進這個 turn；如果 Codex 已經做完，就會開始另一個 turn。還沒回答的問題在重新連線之後仍然會在。如果你不想回答，可以從面板把問題關掉。關掉只是結束這個問題，不會送任何東西給 Codex。這項功能需要支援非同步提問（async questions）的 Codex 版本。

## 核准 app 的存取 {#approve-app-access}

Codex 的工具可能會要求存取另一個 app。請在 Thread 裡回應那個指名 app 的請求，網頁、桌面、手機都可以。有些工具可以選擇只允許這一次請求、允許目前這個 session，或是永久允許。指令與檔案的核准請看[權限模式](./permission-modes.md)。

## Codex 說我達到用量上限 {#codex-says-i-hit-a-usage-limit}

Codex 因為用量上限而停下來時，只要 Codex 有回報，Thread 就會指出是哪一個時間區間的額度用完了、什麼時候重置。等重置之後再把訊息送一次。如果用的是 workspace 方案，訊息還會說明是否需要由你的 workspace 擁有者加購點數或調高花費上限，才能早一點繼續。

## 傳送意見回饋給 OpenAI {#send-feedback-to-openai}

在既有的 Codex Thread 裡送出 `/feedback`，後面可以加上說明（非必填），例如 `/feedback The agent stopped before finishing the tests`。這會把對話和 Codex 的記錄檔上傳給 OpenAI。回傳的 thread ID 可以提供給 OpenAI 客服。

:::note 送出前先想一下對話內容
`/feedback` 上傳的是整段對話和 Codex 的記錄檔，不只是你打的那句說明。如果對話裡有不方便外流的程式碼或資料，送出前請先確認。
:::
