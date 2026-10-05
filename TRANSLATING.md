# 翻譯與補充規範

讀者是一般開發者，可能第一次接觸 T3 Code，也可能日後想參與開發。目標：**越好懂越好，但一定要正確。**

動手前先讀這三頁樣本，語氣、粒度、格式都以它們為準：

- `content/user/permission-modes.md`（使用者文件）
- `content/internals/overview.md`（內部架構）
- `content/guide/first-task.md`（本站自寫）

## 檔案

`docs/<路徑>.md` 的譯文放在 `content/<相同路徑>.md`。開頭：

```
---
title: 權限模式
nav: 權限模式
source: docs/user/permission-modes.md
---
```

- `title` 是頁面標題，取代原文的 `# H1`（譯文裡不要再寫 H1）。
- `nav` 是側邊欄用的短標題，`title` 超過 10 個字左右時才需要。
- 不要寫 `source_hash`，之後統一處理。

## 翻譯

- 台灣用語的繁體中文。語氣平實，像在跟同事說明。不要行銷式用語（「極致」「秘技」「完美」「強大」），不要驚嘆號。
- **忠實**：原文每一句都要有對應，不刪、不併、不加料。數字、指令、路徑、設定鍵、程式碼區塊原樣保留（程式碼區塊裡的註解也不翻）。
- 好懂優先於逐字對應：英文長句可以拆成兩三句，被動改主動，但意思不能變。
- 一個段落寫成一行，不要在段落中間換行。
- 中文與英文、數字之間空一格；使用全形標點。
- 介面上的文字（按鈕、選單、設定路徑）維持英文原樣並保留粗體，例如 **Settings → General**、**Full access**。對新手不直觀的，第一次出現時可以在後面用括號加中文說明。
- 原文裡的 `<name>` 這類角括號佔位符照寫即可，不需要跳脫。

### 名詞

保留英文（不翻）：agent、Provider、Provider instance、Thread、turn、worktree、checkpoint、client、server、environment、composer、session、runtime、adapter、driver、orchestration、orchestrator、command、event、projection、snapshot、schema、RPC、token、commit、pull request（PR）、repository、merge、rebase、diff、stash、relay、settle / snooze / pin（Thread 的狀態操作）、T3 Connect、以及所有產品名與程式識別字。

- Thread、Provider、Worktree 作為產品概念時首字大寫；`composer` 在一頁中第一次出現寫成「訊息輸入框（composer）」。
- settle 第一次出現寫成「settle（結案）」，snooze 寫成「snooze（暫時擱置）」。

固定譯法：

| 英文 | 中文 |
| --- | --- |
| file / folder, directory | 檔案 / 資料夾（技術語境可用「目錄」） |
| settings / default | 設定 / 預設 |
| project | 專案 |
| approve / approval / reject | 核准 / 核准請求 / 拒絕 |
| permission | 權限 |
| terminal | 終端機 |
| branch | 分支 |
| process / thread（作業系統） | 行程 / 執行緒 |
| queue / cache | 佇列 / 快取 |
| attachment / upload | 附件 / 上傳 |
| keyboard shortcut / keybinding | 快捷鍵 |
| sidebar / command palette | 側邊欄 / 指令面板 |
| sign in / account | 登入 / 帳號 |
| notification | 通知 |
| source of truth | 唯一事實來源（source of truth） |
| idempotent | 冪等（idempotent） |
| side effect | 副作用 |
| runbook | runbook（操作手冊） |

## 標題與連結

- 每個 `##`、`###`、`####` 標題後面都加上原文標題的 GitHub 錨點：`## 各 Provider 的差異 {#provider-differences}`。錨點規則：原文標題轉小寫、去掉標點、空白換成 `-`。其他頁面靠這個錨點連過來，不可省略。
- 連結的目標照原文的相對路徑原樣寫（例如 `./install.md#providers`、`../../apps/server/src/x.ts`），只翻連結文字。建置時會自動轉換。

## 本站補充

補充一律放在區塊裡。區塊必須從行首開始，**不能放在清單項目或表格裡面**，也不要巢狀。

```
:::example 標題
實際操作情境、可以照抄的指令或訊息。
:::

:::note 標題
原文沒講、但新手會卡住的地方。
:::

:::plain 標題
把一段較硬的原文用更簡單的方式再講一次，可以用比喻。
:::

:::screenshot kebab-case-name
圖說：這張圖應該呈現什麼畫面。
:::
```

### 粒度

- **使用者文件（user/）**：大約每個主要章節一個，放在新手真的會卡住的地方。原文已經夠白話的段落不要硬加。很短的頁面可以一個都沒有。關鍵的介面畫面可以放截圖佔位，每頁最多兩個。
- **內部架構（internals/）**：比使用者文件少，以 `plain` 為主，偶爾用 `note` 點出實作時該注意的事。
- **維運手冊（operations/）**：更少。只在步驟的目的不明顯、或容易做錯的地方加。
- **orchestration-v2/**：見下方專節。

### 依據

**每一則補充的每一個事實，都必須能在 `docs/` 或程式碼裡找到依據。** 寫之前先去讀。找不到依據就不要寫，寧可少。

- 不要自己發明介面文字、數字、指令、預設值、檔案路徑。
- 不要寫效能、安全性之類無法查證的評價。
- 純粹換句話說或打比方的 `plain` 區塊，依據就是它所解釋的那段原文；比喻不可以帶進原文沒有的事實。
- 通用的背景知識（例如 Git worktree 是什麼）可以寫，但要確定是對的。

### orchestration-v2/ 的規則

這批是「目標架構」的設計規格，描述的不一定等於目前的實作。

- 每一頁正文最前面放這個區塊（原樣照抄）：

  ```
  :::warning 這是目標架構的設計文件
  這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
  :::
  ```

- 只加 `plain`：把文件自己講的概念換個說法，或把新名詞對應回使用者熟悉的詞（依據必須是原文或 `docs/internals/glossary.md` 明講的對應關係）。大約每個主要章節一個。
- 不加 `example`、`screenshot`，也不寫「目前程式碼是這樣做的」這類實作說明。

## 不要動的東西

- 不要修改 `content/guide/`、`content/index.md`、`build.mjs`、`lib/`、`theme/`、`site.config.mjs`。
- 不要執行 `node build.mjs`（多人同時建置會互相覆蓋）。
- 不要修改 `docs/` 或任何程式碼。
