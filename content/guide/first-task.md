---
title: 第一次使用：從安裝到送出第一個任務
nav: 第一次使用
---

這一頁帶你從零開始，走到讓 agent 完成第一個任務為止。每一步都附上對應的詳細文件，想深入時再點進去。

開始之前先建立一個觀念：T3 Code 本身不是 AI，它是用來指揮 Claude Code、Codex 這類 agent 的操作介面。所以你需要準備兩樣東西：T3 Code，以及至少一個已經登入的 Provider。

## 1. 安裝 T3 Code {#install}

在你要讓 agent 工作的那台電腦上，打開終端機執行：

```bash
curl -fsSL https://t3.codes/install.sh | sh
```

Windows 請在 PowerShell 執行：

```powershell
irm https://t3.codes/install.ps1 | iex
```

裝好之後會多一個 `t3` 指令，位置在 `~/.local/bin`。如果終端機回報 `command not found`，代表這個目錄還沒加進 `PATH`。安裝程式結束時會提示你要把哪個目錄加進去。

偏好圖形介面的話，也可以改裝桌面版 app，不需要用到終端機。各平台的安裝方式見[安裝 T3 Code](../user/install.md#desktop-app)。

## 2. 準備一個 Provider {#provider}

開始 Thread 之前，需要有一個已安裝、已登入的 Provider。以下以 Claude 和 Codex 為例，擇一即可：

| Provider | 做法                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| Claude   | 安裝 [Claude Code](https://claude.com/product/claude-code)，然後執行 `claude auth login`。 |
| Codex    | 安裝 [Codex CLI](https://developers.openai.com/codex/cli)，然後執行 `codex login`。        |

這一步也可以先跳過。T3 Code 可以先啟動，之後在歡迎精靈或設定頁裡再處理 Provider。其他 Provider 的安裝方式見[Providers 一節](../user/install.md#providers)。

:::note Provider 要裝在哪一台
裝在執行 T3 Code server 的那台機器上。即使你之後改用手機或另一台電腦連線，Provider 的安裝、登入和設定都還是屬於 server 那台機器。
:::

## 3. 啟動 {#start}

```bash
t3
```

這個指令會啟動 server，並在瀏覽器開啟網頁版介面。如果只想啟動 server、不開瀏覽器，改用 `t3 serve`。

## 4. 跟著歡迎精靈設定 {#wizard}

第一次開啟時會出現設定流程，共三步：

1. **連接電腦**：你剛剛啟動 T3 Code 的這台電腦已經連上並選好了，直接繼續即可。
2. **檢查 agent**：T3 Code 會檢查這台電腦上的 Claude Code 和 Codex。如果還沒安裝或還沒登入，點對應的按鈕會開啟一個終端機，裡面已經備好正確的指令。
3. **匯入專案**：T3 Code 會找出 Claude Code 或 Codex 用過的資料夾，讓你勾選要匯入哪些。匯入的專案會帶進最近 30 天內的對話，可以在 T3 Code 裡接續。

第 2、3 步都可以跳過，之後再設定。完整說明見[歡迎精靈](../user/welcome-wizard.md)。

:::screenshot welcome-wizard-agents
歡迎精靈的「檢查 agent」步驟，列出 Claude Code 與 Codex 的安裝及登入狀態。
:::

## 5. 加入專案 {#project}

如果剛才沒有匯入專案，有三種方式可以加入：

- **已經有程式碼在這台電腦上**：按側邊欄的 **Add project**，在資料夾瀏覽器裡選擇專案資料夾。
- **要從 GitHub 等平台抓下來**：按 `Cmd+K`（macOS）或 `Ctrl+K`（Windows、Linux）開啟指令面板，選 **Add Project**，選擇平台或貼上 Git URL，再選擇存放位置。
- **從零開始**：在指令面板選 **New project** 並輸入名稱，T3 Code 會在 `~/.t3/projects` 底下建立一個新的 Git repository。

只是想先試試看的話，也可以不建立專案，直接開一個沒有專案的 Thread。詳見[不使用專案開始](../user/thread-sidebar.md#start-without-a-project)。

:::note 資料夾瀏覽器看到的是哪一台的檔案
是 server 那台機器的檔案，不是你眼前這台裝置的。兩者是同一台電腦時沒有差別；用手機或另一台電腦連線時，要記得你選的是遠端那台機器上的資料夾。
:::

## 6. 送出第一個任務 {#first-task}

開一個新 Thread，在訊息輸入框（composer）裡用平常說話的方式描述任務。送出前有兩個選項值得先看一眼：

**權限模式。** 初始預設是 **Full access**，agent 執行指令、修改檔案都不會先問你。第一次使用、想看清楚 agent 每一步做了什麼的話，可以先改成 **Supervised**。四種模式的差別見[權限模式](../user/permission-modes.md)。

**工作位置。** 選 **New worktree** 的話，這個 Thread 的修改會放在獨立的分支和工作目錄裡，不會動到你專案目錄裡現有的檔案。

:::example 適合當作第一個任務的訊息
從不會改到檔案的任務開始，可以先熟悉操作流程：

```text
請讀過這個專案，告訴我它是做什麼的、主要的進入點在哪個檔案、要怎麼在本機跑起來。
```

接著再試一個範圍小、容易檢查結果的修改：

```text
README 裡的安裝步驟少了設定環境變數那一段。請對照 .env.example 補上，不要改到其他段落。
```

任務寫得越具體，結果越容易檢查：說明要改什麼、範圍到哪裡、不要動什麼。
:::

:::screenshot first-thread-composer
新 Thread 的訊息輸入框，可以看到模型、權限模式與 New worktree 的選項。
:::

## 7. 看結果，需要時倒回去 {#review}

agent 工作時，對話裡會陸續出現它讀了哪些檔案、執行了什麼指令、改了什麼。如果權限模式需要核准，請求會出現在對話裡，你核准或拒絕之後 agent 才會繼續。

結果不滿意時，在網頁版或桌面版可以點某一則已送出訊息下方的 **Edit from here**，把對話倒回那則訊息之前，修改後重新送出。如果 Thread 是在 worktree 裡工作，還可以選擇連檔案一起還原。詳見[編輯先前的訊息](../user/composer.md#edit-an-earlier-prompt)。

## 接下來 {#next}

- [訊息與上下文](../user/composer.md)：附加檔案、引用先前的回覆、在 agent 工作中途追加訊息。
- [使用 Thread](../user/thread-sidebar.md)：同時進行多個任務，以及整理 Thread 列表。
- [版本控制](../user/source-control.md)：連接 GitHub 等帳號、建立 pull request。
- [遠端存取](../user/remote-access.md)：用手機或另一台電腦連回這台機器。
- [名詞對照表](./glossary.md)：遇到看不懂的詞時查這裡。
