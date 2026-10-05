---
title: 名詞對照表
---

T3 Code 的文件保留了不少英文名詞。這一頁用最簡單的方式解釋每個詞，其他頁面裡底下有虛線的詞都會連到這裡。

想看更精確、給開發者用的定義，請讀[內部架構的術語表](../internals/glossary.md)。

## 最常遇到的詞

### Agent {#agent}

會自己讀程式碼、改檔案、執行指令來完成任務的 AI 程式，例如 Claude Code 或 Codex。

你用文字交代任務，agent 自己決定要看哪些檔案、要改什麼、要跑什麼指令。T3 Code 本身不是 agent，它是讓你同時指揮多個 agent 的操作介面。

### Provider {#provider}

T3 Code 所控制的 agent 執行程式，例如 Codex、Claude Code、Cursor、OpenCode。

每個 Provider 都要另外安裝，並用它自己的帳號登入。T3 Code 不會幫你付費或提供模型，它用的是你在那台機器上已經登入好的 Provider。安裝方式見[安裝 T3 Code 的 Providers 一節](../user/install.md#providers)。

### Provider instance（Provider 實例）{#provider-instance}

一份設定好的 Provider，有自己的設定與帳號。

同一種 Provider 可以建立多個 instance，例如一個用公司帳號的 Claude、一個用個人帳號的 Claude。

### Thread {#thread}

一段與 agent 的對話，加上它在這段對話裡做過的所有工作紀錄。

可以把一個 Thread 想成「一件任務」。每件獨立的任務開一個新 Thread，多個 Thread 可以同時進行。Thread 會保存在 server 上，就算 Provider 的程式結束了，Thread 也還在。操作方式見[使用 Thread](../user/thread-sidebar.md)。

### Turn {#turn}

你送出一則訊息，到 agent 做完並回覆為止，這一來一回稱為一個 turn。

一個 Thread 由很多個 turn 組成。

### Composer（訊息輸入框）{#composer}

畫面下方用來輸入訊息、附加檔案、選擇模型與權限模式的輸入區。

詳見[訊息與上下文](../user/composer.md)。

### 權限模式 / Permission mode {#permission-mode}

決定 agent 執行指令或修改檔案之前，要不要先問過你的設定。

共有四種：Supervised、Auto-accept edits、Auto、Full access。詳見[權限模式](../user/permission-modes.md)。

## 操作 Thread 時會看到的詞

### Queue / Steer {#queue-steer}

agent 還在工作時追加訊息的兩種送法：Queue 是排隊等這個 turn 做完再送，Steer 是立刻送進正在執行的 turn。

詳見[在 agent 工作時送出訊息](../user/composer.md#send-while-the-agent-is-working)。

### Pin {#pin}

把一個 Thread 固定在列表上方，排在進行中的工作之前。

### Settle（結案）{#settle}

把已經完成的 Thread 移出進行中的列表，但不刪除對話。

可以手動 settle，environment 也會依設定自動 settle，預設是閒置三天或 pull request 已經 merge 的 Thread。詳見[把完成的工作結案](../user/thread-sidebar.md#settle-finished-work)。

### Snooze（暫時擱置）{#snooze}

把一個 Thread 先收起來，到你指定的時間再回來處理。

想提早拿回來時選 **Wake thread**。詳見[暫時擱置](../user/thread-sidebar.md#snooze-until-later)。

### Skill {#skill}

可以附加到訊息裡、讓 agent 取得額外上下文的項目，由你選的 environment 和 Provider 提供。

在訊息輸入框輸入 `---
title: 名詞對照表
---

T3 Code 的文件保留了不少英文名詞。這一頁用最簡單的方式解釋每個詞，其他頁面裡底下有虛線的詞都會連到這裡。

想看更精確、給開發者用的定義，請讀[內部架構的術語表](../internals/glossary.md)。

## 最常遇到的詞

### Agent {#agent}

會自己讀程式碼、改檔案、執行指令來完成任務的 AI 程式，例如 Claude Code 或 Codex。

你用文字交代任務，agent 自己決定要看哪些檔案、要改什麼、要跑什麼指令。T3 Code 本身不是 agent，它是讓你同時指揮多個 agent 的操作介面。

### Provider {#provider}

T3 Code 所控制的 agent 執行程式，例如 Codex、Claude Code、Cursor、OpenCode。

每個 Provider 都要另外安裝，並用它自己的帳號登入。T3 Code 不會幫你付費或提供模型，它用的是你在那台機器上已經登入好的 Provider。安裝方式見[安裝 T3 Code 的 Providers 一節](../user/install.md#providers)。

### Provider instance（Provider 實例）{#provider-instance}

一份設定好的 Provider，有自己的設定與帳號。

同一種 Provider 可以建立多個 instance，例如一個用公司帳號的 Claude、一個用個人帳號的 Claude。

### Thread {#thread}

一段與 agent 的對話，加上它在這段對話裡做過的所有工作紀錄。

可以把一個 Thread 想成「一件任務」。每件獨立的任務開一個新 Thread，多個 Thread 可以同時進行。Thread 會保存在 server 上，就算 Provider 的程式結束了，Thread 也還在。操作方式見[使用 Thread](../user/thread-sidebar.md)。

### Turn {#turn}

你送出一則訊息，到 agent 做完並回覆為止，這一來一回稱為一個 turn。

一個 Thread 由很多個 turn 組成。

### Composer（訊息輸入框）{#composer}

畫面下方用來輸入訊息、附加檔案、選擇模型與權限模式的輸入區。

詳見[訊息與上下文](../user/composer.md)。

### 權限模式 / Permission mode {#permission-mode}

決定 agent 執行指令或修改檔案之前，要不要先問過你的設定。

共有四種：Supervised、Auto-accept edits、Auto、Full access。詳見[權限模式](../user/permission-modes.md)。

 就能加入。詳見[指令與 skill](../user/composer.md#commands-and-skills)。

### Subagent {#subagent}

agent 把一部分工作委派出去時所啟動的另一個 agent。

由 agent 啟動的 subagent Thread 不能直接收訊息，要傳訊息請傳給上層的 Thread。

### mod 鍵 {#mod}

快捷鍵寫法裡的 `mod`，在 macOS 代表 Command，在其他系統代表 Control。

例如 `mod+k` 在 macOS 是 `Cmd+K`，在 Windows 和 Linux 是 `Ctrl+K`。詳見[快捷鍵](../user/keybindings.md)。

## 機器與連線

### Server {#server}

實際執行 agent、終端機、Git 操作的 T3 Code 後端程式。

在終端機執行 `t3` 或 `t3 serve` 就會啟動它；桌面版 app 則內建了一個 server。agent 讀寫的是 server 那台機器上的檔案。

### Environment（環境）{#environment}

一個執行中的 server，加上它所在的那台機器，以及那台機器上的登入憑證、檔案與狀態。

你可以同時連到多個 environment，例如自己的筆電和一台遠端開發機。專案、Provider 的安裝與登入，都屬於各自的 environment，不會互相共用。

### Client（用戶端）{#client}

連到 environment 的操作介面，有網頁、桌面 app、手機 app 三種。

Client 只負責顯示和操作，真正的工作都在 environment 那台機器上進行。所以用手機連回家裡的電腦時，agent 改的是家裡電腦上的檔案。

### T3 Connect {#t3-connect}

讓你的其他裝置能連到某個 environment 的官方連線服務，不需要自己設定路由器轉送。

在主機上登入並啟用後，其他裝置登入同一個帳號就能看到這個 environment。詳見[遠端存取](../user/remote-access.md)。

### 配對連結 / Pairing link {#pairing-link}

讓另一台裝置直接連到某個 environment 的連結，也可以顯示成 QR code 讓手機掃描。

適合另一台裝置本來就連得到主機網路位址的情況。詳見[透過區域網路或私人網路配對](../user/remote-access.md#pair-over-a-lan-or-private-network)。

### 背景服務 {#background-service}

讓 server 在背景持續執行的安裝方式，不需要一直開著終端機。

在 macOS 和 Linux 用 `t3 service install` 安裝。詳見[在背景執行](../user/background-service.md)。

### MCP {#mcp}

Model Context Protocol，讓 agent 連接外部工具與資料來源的協定。

文件裡提到的「MCP server」就是透過這個協定提供工具給 agent 的程式。

## 專案與 Git

### Project（專案）{#project}

在某個 environment 上、以一個資料夾為根目錄的工作區紀錄。

通常一個 Git repository 就是一個 project。

### Worktree {#worktree}

Git 的功能：同一個 repository 另外開一份獨立的工作目錄和分支。

在 T3 Code 裡，Thread 可以選擇在自己的 worktree 裡工作，而不是直接動專案的主要目錄。這樣多個 Thread 同時改程式碼也不會互相干擾，你自己手邊正在改的檔案也不會被動到。

### Checkpoint {#checkpoint}

T3 Code 幫工作目錄存下來的狀態快照，用來顯示每個 turn 改了什麼，以及還原檔案。

Checkpoint 存在隱藏的 Git ref 裡，不會在你的分支上多出 commit。
