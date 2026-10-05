---
title: Orchestrator MCP Server
source: docs/orchestration-v2/orchestrator-mcp-server.md
source_hash: eab33d76f5b0fe7ceb958c47776549cec4f3bb64
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

## 目的 {#purpose}

T3 透過它自己擁有的 MCP endpoint，把 V2 orchestration 開放出來。Provider 的 agent 可以用這個 endpoint 來：

- 在任何受支援的 Provider instance 上，建立一個由 app 擁有的 sub-agent；
- 等待或輪詢 sub-agent 的持久化結果；
- 取消一個進行中的委派任務；以及
- 建立一個或多個一般的頂層 T3 thread；
- 列出專案的 thread，並以增量方式讀取；
- 重新命名 thread、重新產生標題、連結或取消連結 pull request；
- 送出後續訊息，或 steer 後續訊息；以及
- 等待或中斷一般 thread 的 run。

這些是 T3 的 orchestration 操作，不是 Provider 原生的 sub-agent API。委派任務（delegated task）一定會建立一個 T3 的子 thread 和 run。子 thread 只會收到呼叫時提供的任務 prompt，再加上同一次工具呼叫裡選擇性提供的角色指示。上層對話的歷史不會複製到子 thread。

`ThreadManagementService` 是 V2 WebSocket command 和 MCP 共用的 server 應用層邊界。它負責以專案為範圍的查詢、列表、送出模式的選擇、持久化的送出後置條件（postcondition）、等待時的輪詢，以及中斷對象的選擇；`OrchestratorV2` 仍然是較底層的 command／event 處理器。Transport adapter 只負責驗證身分、解析各 transport 專屬的輸入，以及整理回應的形狀。

:::plain 這個 server 是做什麼的
T3 在 server 上開了一組工具給 agent 用，讓 agent 自己也能做「開一個 Thread」「把一件事交給另一個 agent」「看看別的 Thread 進度如何」這類操作。這些操作走的是 T3 自己的 orchestration，所以交辦出去的工作一樣是 T3 的 thread 和 run，而不是某個 Provider 內建的 sub-agent 機制。被交辦的那個子 thread 只看得到交給它的任務說明，看不到上層對話的歷史。
:::

## Transport 與身分驗證 {#transport-and-authentication}

Orchestration 工具共用既有的、需要驗證的 HTTP MCP endpoint：

```text
http://127.0.0.1:<server-port>/mcp
```

Provider 看到的 server key 是 `t3-code`。這個 endpoint 同時註冊了 preview toolkit 和 orchestration toolkit。

`ProviderSessionManager` 開啟新的 V2 Provider session 之前，會向 `McpSessionRegistry` 要一份憑證（credential），範圍限定在：

- 這個 T3 environment；
- 上層的 T3 thread；
- 具體的那個 Provider instance；以及
- 這個 Provider session。

這份憑證授予 `preview` 和 `orchestration` 兩項能力（capability）。憑證超過最長存活時間會過期，閒置也會過期，並且在 Provider session 被釋放時撤銷。原始 token 不會持久化到 orchestration 狀態裡。

MCP HTTP server 會解析 bearer token，並把得到的 `McpInvocationScope` 提供給工具的 handler。Orchestration 的 handler 在讀取或變更狀態之前，還會另外檢查 `orchestration` 能力。

:::plain 憑證綁在哪裡
每開一個 Provider session，T3 就發一份只給它用的憑證，上面記著它屬於哪個 environment、哪個上層 thread、哪個 Provider instance、哪個 session。agent 呼叫工具時帶著這份憑證，server 由此知道「是誰在呼叫」。session 被釋放時憑證就撤銷，放太久或閒置太久也會過期。
:::

## 注入到各 Provider {#provider-injection}

### Codex V2 {#codex-v2}

Codex app-server 透過命令列的 config 覆寫，接收這個遠端 MCP server：

```text
-c mcp_servers.t3-code.url=http://127.0.0.1:<port>/mcp
-c mcp_servers.t3-code.bearer_token_env_var="T3_MCP_BEARER_TOKEN"
```

Provider session 的 token 放在 `T3_MCP_BEARER_TOKEN` 裡。正式環境的 Codex launcher 和可注入的測試用 launcher，使用的是同一個 projection helper。

### Claude Agent SDK V2 {#claude-agent-sdk-v2}

Claude 在它的 query 選項裡接收一個 HTTP MCP server：

```ts
{
  mcpServers: {
    "t3-code": {
      type: "http",
      url: "http://127.0.0.1:<port>/mcp",
      headers: {
        Authorization: "Bearer <provider-session-token>",
      },
    },
  },
  allowedTools: [
    // existing allowed tools
    "mcp__t3-code__*",
  ],
}
```

Adapter 只會記錄 MCP 設定是否存在；它不會把 server 的 header 或 token 寫進 log。

### Cursor Agent SDK V2 {#cursor-agent-sdk-v2}

Cursor 透過 SDK 的 `mcpServers` agent 選項與 send 選項，接收同一個需要驗證的 HTTP MCP endpoint。Adapter 會把 authorization header 傳給 SDK，但投影到協定診斷資料裡的，只有遮蔽過的選項 metadata。

### Grok ACP V2 {#grok-acp-v2}

Grok 透過 ACP 的 `session/new`、`session/load` 和 `session/fork` 的 `mcpServers` 欄位，接收這個需要驗證的 HTTP MCP endpoint。共用的 ACP adapter 負責標準的協定行為；Grok flavor 則加上 xAI 的擴充請求，例如結構化的使用者提問。

ACP 沒有定義原生的 subagent，也沒有定義進行中的 steering。因此 Grok 使用由 orchestrator 擁有的子 thread，並用「取消再重新啟動」來實作 steering。它目前的 driver 也沒有 `session/fork`，所以 app 的 fork 使用可攜的 context transfer。這些是 orchestrator 的政策，不是 Provider 專屬的 MCP 工具。

### ACP Registry V2 {#acp-registry-v2}

`acpRegistry` driver 是同一個共用 ACP adapter 的通用 flavor。每個 Provider instance 指定官方 ACP Registry 裡的一個 agent。Settings 會透過已連線的 server 搜尋 registry，然後先準備好一份相容的發行版本（distribution），再把這個 Provider instance 持久化。二進位發行版本使用一個受管理、有版本的快取；有宣告 checksum 時會加以驗證。鎖定版本的 `npx` 套件透過 `npm` 做全域安裝；`uvx` 套件則使用 `uv tool install`。ACP 會直接啟動安裝後得到的全域指令，所以同一個指令也可以用來在終端機裡做身分驗證。可以用一個本機的執行檔覆寫已安裝的指令，而不改變 registry 宣告的引數或環境變數。

搜尋、準備、Provider 狀態和 session 啟動，共用同一個以 server 為範圍的 catalog service。這讓平台的選擇和 registry 的驗證，在設定階段和 runtime 使用時保持一致。檢視 catalog 絕對不會啟動 ACP 行程、探測模型，或執行身分驗證。受管理的 Provider snapshot 會透過一般的 Provider 重新整理生命週期，建立一個用完即丟的 `session/new`；成功就當作「身分驗證已就緒」的證明，並把 agent 宣告的模型投影到 snapshot 裡。只能在終端機進行的登入，仍然是要在已連線的 server 上手動執行的操作。

Session 載入、session fork、模型、模式和 MCP transport 這些能力，只有在所選的 agent 宣告支援時才會啟用。缺少的功能會依 V2 的政策降級：steering 使用「中斷再重新啟動」，原生的 `session/fork` 無法使用時 fork 改用可攜的 context，subagent 則使用由 orchestrator 擁有的子 thread。Registry 的 agent 不會得到 Provider 專屬的擴充；那些擴充留在 Grok 這類 flavor 裡。

### Pi V2 {#pi-v2}

Pi 的核心沒有 MCP client。當 Provider session 憑證存在時，adapter 會把一個由 T3 擁有的 extension 寫進 server 的快取，並以下列環境變數啟動 `pi --mode rpc --extension <cache>/pi-t3-mcp-extension.ts`：

```text
T3_MCP_URL=http://127.0.0.1:<port>/mcp
T3_MCP_BEARER_TOKEN=<provider-session-token>
```

這個 extension 會連到那個 HTTP endpoint、列出工具，然後用 `pi.registerTool` 把每一個工具註冊在 `mcp__t3-code__` 命名空間底下（`mcp__t3-code__delegate_task`、`mcp__t3-code__t3_thread_launch`，以及其餘的工具）。這層橋接會透過 HTTP 呼叫原本的 MCP 工具名稱。後續的請求會送出 `mcp-protocol-version: 2025-06-18`；沒有這個 header，Effect 的 MCP transport 會回傳 400。Session 的第一個 turn 也會收到共用的 T3 orchestration 指示。

Pi 仍然擁有原生 extension 探索的主導權。T3 不會取代 Pi 的 `subagent` 工具，也不會重做 Pi 的套件與專案信任載入器。持久的委派要走帶命名空間的 T3 MCP `delegate_task` 工具，以及共用的 orchestration 子 thread 生命週期。如果安裝了 Pi 的範例 `subagent` extension，adapter 會觀察它文件上記載的 `details.results` 形狀，並投影出沒有子 thread id 的任務卡片。未知的結果形狀則維持為一般的動態工具輸出。

### Provider 支援情況 {#provider-support}

一個 Provider instance 只要它活著的 `ProviderInstance` 有提供 V2 的 `orchestrationAdapter`，就可以執行子任務——這和 `delegated_task.request` 執行時 orchestrator 所解析的，是同一份註冊。這涵蓋了 Codex、Claude Agent SDK、Cursor Agent SDK、Grok、透過 ACP 的通用 registry agent、OpenCode、OpenCode 2、Pi、Antigravity，以及未來任何會建立 adapter 的 driver。能力探索（capability discovery）仍然會回報其他已註冊的 Provider instance，但在解析不到 adapter 時，會把它們標記為無法用於 orchestration。這樣模型仍然看得到有哪些 Provider 可選，但不會讓一個跑不起來的請求被送出。

:::plain 「注入」是什麼意思
每一種 Provider 接上外部工具的方式都不一樣：有的吃命令列參數，有的吃 SDK 選項，有的走 ACP 的欄位，Pi 則要靠一個 extension 轉接。這一節就是逐一說明 T3 怎麼把同一個 MCP endpoint 和那份 session 憑證交到各家 Provider 手上。不管哪一家，接上的都是同一組工具；Provider 本身缺少的功能（例如原生的 subagent 或 steering），由 orchestrator 的政策補上，而不是另外做一套 Provider 專屬的工具。
:::

## 工具介面 {#tool-surface}

Server 提供十一個 orchestration 工具。

### `orchestrator_capabilities` {#orchestrator_capabilities}

回傳：

- 繼承而來的 Provider instance 和模型；
- 上層的 runtime mode 和 interaction mode；
- 已註冊的 Provider instance 和它們宣告的模型；
- 每個 Provider 能不能執行子任務；以及
- 輪詢、取消、批次建立 thread 的功能旗標。

無法使用的 Provider 會附上模型看得到的限制原因，例如缺少 V2 adapter 支援、處於停用狀態、找不到執行檔，或缺少身分驗證。

### `delegate_task` {#delegate_task}

建立一個由 T3 擁有的子 thread，並立刻把提供的任務 prompt 送出去。

```ts
type DelegateTaskInput = {
  task: string;
  target?: {
    providerInstanceId?: string;
    driverKind?: string;
    model?: string;
  };
  title?: string;
  role?: "implementation" | "research" | "review" | "design" | "test" | "general";
  mode?: "async" | "wait";
  timeoutMs?: number;
  clientRequestId?: string;
  runtimeMode?: "inherit" | "approval-required" | "auto-accept-edits" | "full-access";
  interactionMode?: "inherit" | "plan" | "default";
};
```

Provider、模型、runtime mode 和 interaction mode 省略時，會從上層繼承。只指定 driver 的 target，在上層的 Provider instance 可以執行子任務時會繼承它，否則就選一個該 driver 可用的 instance；明確指定的 `providerInstanceId` 則會被原樣採用，無法使用時就失敗。選了不同的 Provider 卻沒有指定模型時，使用該 Provider 宣告的第一個模型。

每一輪委派的審查（review），都使用一次新的 `delegate_task` 呼叫，並帶上原始的任務說明、先前的發現、回應，以及尚未解決的異議。每一輪用它自己的 `taskId` 來追蹤，並且每一輪使用不同的 `clientRequestId`，同一輪的重試則保持不變。`childThreadId` 是背後的儲存位置，不是讓你透過 `t3_thread_send` 再做下一輪審查的對象。一般的 thread 訊息功能仍然可以用在使用者要求的對話上；它不會重新開啟一個已完成的任務。沒有任務層級的後續 API 可以保留同一個審查者的 session。

委派需要有一個進行中的上層 run，而且這個 run 屬於 MCP 憑證所對應的 Provider session。這個請求會變成 V2 的 command `delegated_task.request`。

`mode: "async"` 會立刻回傳目前的持久化狀態。`mode: "wait"` 會等待任務結果，包含巢狀的工作和完成後的後續處理，或是等到逾時為止。等待逾時不會取消子任務；結果會設定 `waitTimedOut: true`，呼叫端可以用 `task_status` 繼續追蹤。

```ts
type DelegateTaskResult = {
  taskId: string;
  childThreadId: string;
  childRunId: string | null;
  childNodeId: string;
  status: "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled" | "interrupted";
  workState: "working" | "waiting_for_children" | "result_available";
  hasPendingChildRuns: boolean;
  providerInstanceId: string;
  model: string | null;
  summary: string | null;
  resultContextTransferId: string | null;
  latestTerminalRunId: string | null;
  latestTerminalStatus: "completed" | "failed" | "cancelled" | "interrupted" | null;
  latestTerminalSummary: string | null;
  latestTerminalResultContextTransferId: string | null;
  waitTimedOut: boolean;
};
```

### `task_status` {#task_status}

從上層 thread 的持久化 projection 讀取一個委派任務。來自另一個上層 thread 的 task ID 會被拒絕。`childRunId` 指的是最初的那個 run。`workState` 用來區分三種情況：工作進行中、turn 已結束但還在等子任務、結果已經可用。任務在它已知的工作全部結束之前，都維持在非終止狀態。之後它發布的 `summary` 和 result transfer，在後續的追加訊息之間會保持穩定。`hasPendingChildRuns` 回報之後是否還有排隊中或執行中的 turn；`latestTerminal*` 則提供之後執行過的、非 monitor 的結果，而不會取代已發布的任務結果。

### `task_cancel` {#task_cancel}

透過一般的 V2 `run.interrupt` command 中斷目前進行中的任務 run，並解除（dispose）自動送回上層的機制。在 turn 與 turn 之間的原生背景工作，目前沒有可以中斷的 run。對於已終止的任務，它會回傳既有的狀態並解除送回機制，不會中斷之後的子 thread run，即使 `task_status` 回報 `hasPendingChildRuns: true` 也一樣。已發布的任務結果仍然可以取得。它接受一個選擇性的取消原因。要停止之後才啟動的進行中 run，請使用 `t3_thread_interrupt`。

### `create_threads` {#create_threads}

建立一到二十個一般的頂層 T3 thread：

```ts
type CreateThreadsInput = {
  threads: Array<{
    prompt?: string;
    title?: string;
    target?: {
      providerInstanceId?: string;
      driverKind?: string;
      model?: string;
    };
    runtimeMode?: "inherit" | "approval-required" | "auto-accept-edits" | "full-access";
    interactionMode?: "inherit" | "plan" | "default";
  }>;
  clientRequestId?: string;
};
```

每一筆各自獨立解析 Provider、模型和模式。新的 thread 會繼承上層的專案、分支和 worktree 路徑，但沒有 sub-agent 的 lineage。有 prompt 的項目會立刻送出一個 run；沒有 prompt 的項目則維持閒置。

### `t3_thread_launch` {#t3_thread_launch}

透過 app 的 launch service 啟動一個一般的頂層 thread。使用明確的 `workspaceStrategy` 來建立新的 worktree（`worktree` 搭配 `baseRef`）、掛上既有的 checkout（`existing_worktree` 搭配 `worktreePath`），或使用專案根目錄（`root`，也是預設值）。Thread 在 agent 啟動之前就會綁定到那個 workspace。在任務 prompt 裡建立 worktree，並不會更新這個綁定。

任務內容放在 `message` 裡傳入。專案、模型和模式省略時會繼承；workspace 不會。`scratch: true` 會在沒有專案的情況下啟動，用的是 environment 的 Scratch 專案底下一個它自己的資料夾。要做堆疊式 PR（stacked PR）時，把上層分支當作 `baseRef`，並設定 `startFromOrigin: false`。Launch 要求呼叫端是 full-access／default，而且沒有重試用的 key，所以回應失敗或遺失之後，要先檢查既有的 thread，再決定要不要重新 launch。要在共用的 checkout 上批次建立時，仍然使用 `create_threads`。

### `t3_thread_list` {#t3_thread_list}

列出呼叫端 thread 所屬專案裡的持久化 thread shell，最新的排在最前面。呼叫端可以依標題、run 狀態，以及是否包含 app 擁有的 sub-agent thread 來篩選。結果有數量上限，並以 offset 分頁。已刪除的 thread 和其他專案的 thread 絕對不會被揭露。

### `t3_thread_read` {#t3_thread_read}

讀取一個專案範圍內的 thread 的持久化狀態、最近的 run，以及可見的時間軸。預設的 `messages` view 回傳使用者訊息、助理訊息和提議的計畫。`activity` view 還會另外回傳經過摘要的工具、推理（reasoning）、checkpoint、handoff 和 runtime-request 項目。篇幅大的項目文字有長度上限，並會回報是否被截斷。`afterPosition` 和 `nextPosition` 支援增量讀取。

Thread 和訊息的結果都包含必填的 `createdBy` 和 `creationSource` 來源資訊（provenance）。由 MCP 建立的 thread 和 user 角色的訊息使用 `createdBy: "agent"` 和 `creationSource: "mcp"`；Provider 的輸出使用 `creationSource: "provider"`。「誰做的」（actor）和「從哪裡進來」（ingress）是分開記錄的，所以 agent 撰寫的 user 角色訊息，仍然可以和真人撰寫的訊息區分開來。

### `t3_thread_update` {#t3_thread_update}

更新呼叫端 thread 或同專案另一個 thread 的 metadata。具型別的動作有 `rename`、`regenerate_title`、`link_pull_request` 和 `unlink_pull_request`。連結的輸入要提供 repository、編號和 URL；server 會記錄目標 thread 的專案 ID。分支和 workspace 的變更不在這個工具的範圍內。

結果包含 command ID 和持久化的 event sequence，以及更新後的標題、標題重新產生的標記，和連結的 pull request。對同一個動作和同一個 thread 重複使用同一個 `clientRequestId`，會重播同一份 command receipt。Thread 的列表和讀取結果都會顯示連結的 pull request，thread 的詳細資料還會顯示進行中的標題重新產生。

### `t3_thread_send` {#t3_thread_send}

把一則訊息送到呼叫端專案裡的一個一般 thread 或委派 thread：

- `auto`：thread 閒置時啟動它；turn 完全進入進行中狀態時 steer 它；turn 還不能被 steer 時排在它後面；
- `queue`：在進行中的工作之後，建立一個獨立的後續 run；
- `steer`：要求有一個可以 steer 的進行中 Provider turn；以及
- `restart`：要求有一個進行中的 Provider turn，並使用 orchestrator 的「中斷再重新啟動」路徑。

目標的 runtime mode 和 interaction mode 不可以比呼叫端的更寬。穩定的 command ID 和訊息 ID 是由 `clientRequestId` 推導出來的，讓重試可以保持冪等（idempotent）。

### `t3_thread_wait` {#t3_thread_wait}

等待選定的 run 變成 `completed`、`failed`、`cancelled`、`interrupted` 或 `rolled_back`。沒有給 `runId` 時，它會鎖定呼叫當下最新的 run；閒置的 thread 會立刻回傳。逾時的時候會回報最新的持久化狀態，不會取消工作。

### `t3_thread_interrupt` {#t3_thread_interrupt}

透過一般的 V2 `run.interrupt` command 中斷選定的進行中 run。沒有給 `runId` 時，它會選最新的那個可以中斷的 run。已終止的 run 會原樣回傳；沒有進行中 Provider turn 的 thread 則回傳 `no_active_run`。

:::plain 這些工具分成兩組
第一組處理「委派任務」：`delegate_task` 把一件事交給子 thread，`task_status` 查進度，`task_cancel` 取消。委派出去的工作會以 sub-agent 的身分掛在上層 thread 底下。第二組處理一般的頂層 thread：建立（`create_threads`、`t3_thread_launch`）、列出與讀取、改標題或連結 PR、送訊息、等待、中斷。再加上一個 `orchestrator_capabilities`，讓 agent 先查清楚有哪些 Provider 和功能可以用。
:::

## 委派任務的生命週期 {#delegated-task-lifecycle}

MCP server 是進入 V2 的一個 command 入口。它不會直接呼叫 Provider adapter。

```text
provider model
  -> MCP tools/call delegate_task
  -> authenticated OrchestratorMcpService
  -> shared ThreadManagementService
  -> V2 delegated_task.request command
  -> child thread + child run
  -> parent app_owned subagent projection
  -> parent/child execution nodes
  -> consumed subagent_spawn context transfer
  -> normal provider effect and runtime ingestion
  -> child run reaches a terminal state
  -> parent subagent/node/turn item finalized
  -> consumed subagent_result context transfer
  -> wait result or later task_status result
```

子 thread 的 lineage 關係是 `subagent`，並指回上層的節點。上層會得到一個 `app_owned` 的 sub-agent projection 和一個 sub-agent turn item，讓既有的除錯 UI 可以呈現進度。

Provider 的終止 event 會觸發收尾（finalization）。Event stream 會先重播已持久化的 event，再接著跟隨即時的 event，所以 server 重新啟動之後，收尾一樣會執行。既有的 `subagent_result` transfer 讓收尾保持冪等。

失敗的 run 會先揭露它的 Provider 錯誤，才是任何進度文字。成功的結果則使用最後一個工作 turn 裡最新的助理內容。

:::plain 委派任務走的是同一條路
agent 呼叫 `delegate_task`，並不是 MCP server 自己去叫另一個 Provider 做事。它只是把這個請求變成一個 V2 command 送進 orchestrator，後面的流程和一般的 run 一樣：建立子 thread 和子 run、交給 Provider 執行、等它結束、再把結果收尾並記回上層。因為收尾是跟著已持久化的 event 走的，所以即使 server 中途重啟，也會在重啟後補做，而且不會做兩次。
:::

## 政策與冪等性 {#policy-and-idempotency}

- 子任務的 runtime mode 可以和上層的相同，或變得更窄。它不可以提升權限。
- 子任務的 interaction mode 可以維持相同，或從 `default` 收窄為 `plan`。它不可以從 `plan` 提升為 `default`。
- 一般的 thread 管理僅限於呼叫端 thread 所屬的專案。Send 還會另外套用和建立子任務時相同的 runtime 與 interaction 權限上限。
- Provider instance 必須是已啟用、已安裝、可用、已通過身分驗證，並且有 V2 adapter 支撐。
- 當 Provider 有公布模型清單時，所要求的模型必須是所選 Provider 宣告過的。
- `clientRequestId` 會在這個 Provider session 的範圍內，推導出穩定的 command、thread 和訊息 ID。重試同一個呼叫，會回傳同一份持久化的工作。
- 沒有帶 `clientRequestId` 的呼叫會得到一個產生出來的 request key，並建立新的工作。

預期中的拒絕會使用具型別的 `OrchestratorMcpFailure` 結果：

```text
capability_denied
parent_not_active
provider_unavailable
model_unavailable
runtime_mode_escalation_denied
interaction_mode_escalation_denied
task_not_found
task_not_cancellable
thread_not_found
run_not_found
thread_not_sendable
thread_not_interruptible
invalid_request
orchestration_error
```

:::plain 兩條主要的規矩
第一，權限只能一樣或更小：agent 開出來的子任務、或它送訊息過去的 thread，權限模式（runtime mode）和 interaction mode 都不能比它自己的寬。第二，重試要安全：呼叫時帶同一個 `clientRequestId`，得到的就是同一份工作，不會重複建立；沒帶的話，每次呼叫都算新的工作。
:::

## 程式碼的歸屬 {#code-ownership}

- 共用的 schema：`packages/contracts/src/orchestratorMcp.ts` 和 `packages/contracts/src/threadMetadataMcp.ts`
- MCP service：`apps/server/src/mcp/OrchestratorMcpService.ts`，以及職責集中的 `apps/server/src/mcp/ThreadMetadataMcpService.ts`
- 工具定義與 handler：`apps/server/src/mcp/toolkits/orchestrator/`
- HTTP 註冊與身分驗證：`apps/server/src/mcp/McpHttpServer.ts`
- 憑證生命週期：`apps/server/src/mcp/McpSessionRegistry.ts`
- 注入到 Provider：`apps/server/src/orchestration-v2/ProviderSessionManager.ts` 和各個 V2 adapter
- 持久化的委派任務 command 與收尾：`apps/server/src/orchestration-v2/Orchestrator.ts`

## 驗證 {#verification}

整合測試使用真正的 MCP toolkit 註冊、V2 orchestrator、SQL 持久化、event 擷取（ingestion）、projection 和 checkpoint。只有外部的 Provider adapter 換成可決定的（deterministic）測試實作。

涵蓋範圍包含：

- 能力探索；
- 跨 Provider 的委派任務完成；
- 只有 prompt 的子任務 context；
- 上層與子 thread 的 lineage projection；
- spawn 與 result 的 context transfer；
- 非同步的狀態輪詢；
- 取消；
- 批次建立一般 thread；
- 以專案為範圍的 thread 列表與時間軸讀取；
- 一般 thread 的送出、等待、steering 與中斷；
- 繼承，以及個別 thread 的 Provider 覆寫；以及
- 冪等的重試。

Provider adapter 的測試另外驗證 Codex、Claude、Cursor、Grok 和 ACP Registry 的行為與 MCP 注入。Provider-session manager 的測試則驗證：憑證在 adapter 開啟之前就已存在，並在 adapter 關閉時被撤銷。
