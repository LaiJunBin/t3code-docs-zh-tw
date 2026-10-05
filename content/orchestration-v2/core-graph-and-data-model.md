---
title: 核心圖與資料模型
source: docs/orchestration-v2/core-graph-and-data-model.md
source_hash: ef7dda9c118fa803269f73485e63c5b4c0ed8a62
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

## 概觀 {#overview}

V2 把 orchestration 建模成一張圖，裡面只有少數幾種持久化的實體型別：

```text
Project
  AppThread
    Run
      ExecutionNode tree
    ProviderThread handles
    Context transfers and handoffs
    Checkpoints
```

最核心的區分是：

- `AppThread`：T3 Code 裡使用者看得到的對話。
- `Run`：app thread 上一個會被計數的、使用者看得到的 turn。
- `ExecutionNode`：run 裡面一個單位的 Provider/runtime 工作。
- `ProviderThread`：Provider 原生的對話 handle。
- `ProviderSession`：一個正在執行、或可以恢復（resume）的 Provider 行程/runtime。
- `ContextTransfer`：一筆與 Provider 無關的「關係/來源點」紀錄，fork、切換 Provider、merge-back 和 subagent 都會用到。
- `ContextHandoff`：一份實體化（materialized）的可攜式 context 產物，在原生轉移無法使用或不足時使用。

Provider 專屬的生命週期保留在 Provider ref 和診斷用的原始 Provider log 裡。App 的行為則由 app 自有的 id、V2 原生的 orchestration event 和圖上的關係來驅動。

V2 event 是持久化的，因為它們就是 app 狀態轉換的 log。原始 Provider frame 不是持久化的 app 狀態。它們可以透過選用的關聯 id（例如 `rawEventId`）附掛上去，但正式的持久化資料列是正規化之後的 V2 event。

每一筆已提交的 V2 event 都有一個由 store 指派、單調遞增的 `sequence`。Projection snapshot 和 websocket 串流都用這個 sequence 當作 cursor 的界線：

```text
read snapshot at sequence N
  -> stream committed V2 events where sequence > N
```

這個 sequence 屬於已儲存的 event 信封（envelope），不屬於 Provider event，也不屬於領域 payload。Provider 原生的順序另外透過 Provider ref 和診斷 log 保留。Client 應該把 snapshot 的 `snapshotSequence` 當成具權威性的 cursor，只套用 sequence 比它大的後續 event。

:::plain 對應回你已經知道的詞
- `AppThread` 就是你在 T3 Code 裡看到的那段對話，也就是其他文件說的 Thread。
- `Run` 對應到其他文件說的 turn。術語表把 turn 定義成「一個 V2 run」。
- `ExecutionNode` 是 run 裡面的一項項工作。
- `ProviderThread` 和 `ProviderSession` 是 Provider 那一邊的東西：前者是它自己的對話 handle，後者是它的行程或 runtime。
- `ContextTransfer` 記的是「context 要從哪裡搬到哪裡」這個關係；`ContextHandoff` 是真的需要搬的時候，實際做出來的那份內容。
:::

## 實體摘要 {#entity-summary}

```text
AppThread
  id: ThreadId
  projectId: ProjectId
  title
  providerBinding
  activeProviderThreadId?
  lineage?
  status projection

Run
  id: RunId
  threadId: ThreadId
  ordinal: number
  status
  rootNodeId
  attempts[]
  providerThreadId
  contextHandoffId?
  userMessageId
  checkpoint?

ExecutionNode
  id: NodeId
  threadId: ThreadId
  runId: RunId | null
  parentNodeId: NodeId | null
  rootNodeId: NodeId
  kind
  status
  providerThreadId?
  providerTurnId?
  itemId?
  countsForRun
  checkpointScopeId?

CheckpointScope
  id: CheckpointScopeId
  threadId
  runId?
  nodeId
  parentScopeId?
  kind
  advancesAppRunCount

ProviderSession
  id: ProviderSessionId
  provider
  status
  cwd
  capabilities

ProviderThread
  id: ProviderThreadId
  providerSessionId?
  appThreadId?
  nativeThreadRef?
  nativeConversationHeadRef?
  coveredRunRange?
  contextHandoffIds[]
  forkSource?

ContextTransfer
  id: ContextTransferId
  type
  sourceThreadId
  targetThreadId
  sourcePoint
  basePoint?
  sourceProvider?
  targetProvider?
  status
  resolution?

ContextHandoff
  id: ContextHandoffId
  transferId
  kind
  payload
  status

ProviderTurn
  id: ProviderTurnId
  providerThreadId
  nativeTurnRef?
  nodeId
  runAttemptId?
  status

RuntimeRequest
  id: RuntimeRequestId
  nodeId
  providerRequestRef?
  kind
  status
```

## AppThread {#appthread}

`AppThread` 是穩定的、面向使用者的對話。它擁有訊息、run、checkpoint 和 UI 狀態。它不需要永遠和某一個 Provider 原生的 thread 一對一對應。

```ts
type AppThread = {
  id: ThreadId;
  projectId: ProjectId;
  title: string;
  defaultProvider: ProviderKind;
  modelSelection: ModelSelection;
  runtimeMode: RuntimeMode;
  interactionMode: InteractionMode;
  branch: string | null;
  worktreePath: string | null;
  activeProviderThreadId: ProviderThreadId | null;
  lineage: AppThreadLineage | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
};
```

`activeProviderThreadId` 指向目前在背後支撐這個 app thread 的 Provider 原生對話。Fork、Provider 遷移或復原，依操作的不同，可能會在保留同一個 app thread 的情況下建立新的 Provider thread。

`defaultProvider` 只是目前為後續 run 所選的預設值。歷史上的 run 各自保有自己的 Provider 和 Provider thread 綁定。

`lineage` 刻意設計成輕量的、供瀏覽用的 metadata。運作上要用到的來源點、延遲的原生 fork 解析、可攜式 context handoff、merge-back 的 delta，以及 subagent 結果的轉移，都放在 `ContextTransfer` 資料列裡，因為一個 app thread 隨著時間可能參與不只一次轉移。

```ts
type AppThreadLineage = {
  parentThreadId: ThreadId | null;
  relationshipToParent: "fork" | "subagent" | null;
  rootThreadId: ThreadId;
};
```

:::plain AppThread 與 Provider 的關係
一個 `AppThread` 背後的 Provider 對話是可以換的。使用者看到的一直是同一段對話，但支撐它的 Provider thread 可能因為 fork、換 Provider 或復原而換成新的。`defaultProvider` 只管「之後的 run 預設用誰」，不會回頭改已經跑過的 run。
:::

## Run {#run}

`Run` 是會被計數的、使用者看得到的 turn。它取代了「用 Provider turn id 當作 app 層級生命週期界線」的做法。

```ts
type Run = {
  id: RunId;
  threadId: ThreadId;
  ordinal: number;
  provider: ProviderKind;
  providerThreadId: ProviderThreadId | null;
  userMessageId: MessageId;
  rootNodeId: NodeId | null;
  activeAttemptId: RunAttemptId | null;
  status:
    | "queued"
    | "starting"
    | "running"
    | "waiting"
    | "completed"
    | "interrupted"
    | "failed"
    | "cancelled"
    | "rolled_back";
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  checkpointId: CheckpointId | null;
  contextHandoffId: ContextHandoffId | null;
  sourcePlanRef?: {
    threadId: ThreadId;
    planId: ProposedPlanId;
  };
};
```

只有 `countsForConversation = true` 的 run，才會算進使用者看得到的 turn 計數和 checkpoint 計數。

`providerThreadId` 是這個 run 所使用的 Provider 原生對話。這讓「混用多個 Provider 的 app thread」變得明確：run 1 可能是 Codex，run 2 可能是 Claude，run 3 可能回到原本的 Codex Provider thread。

`contextHandoffId` 指向這個 run 所消耗的一份實體化 handoff 產物。一個 run 也可能透過某個 `ContextTransfer` 的 target/source 欄位，與這個範圍更廣的 transfer 產生關聯。Handoff 是 payload；transfer 是持久化的關係與 policy 紀錄。

## RunAttempt {#runattempt}

`RunAttempt` 代表一個 app run 的一次 Provider 執行嘗試。大多數 run 只有剛好一個 attempt。Steering、重試、Provider 復原，或是切換 Provider 時的復原，都可能產生不只一個 attempt。

```ts
type RunAttempt = {
  id: RunAttemptId;
  runId: RunId;
  attemptOrdinal: number;
  rootNodeId: NodeId;
  provider: ProviderKind;
  providerThreadId: ProviderThreadId;
  providerTurnId: ProviderTurnId | null;
  reason: "initial" | "steering_restart" | "retry" | "provider_recovery";
  status:
    "pending" | "running" | "completed" | "interrupted" | "failed" | "cancelled" | "superseded";
  startedAt: string | null;
  completedAt: string | null;
};
```

有了 run attempt，即使 Provider 無法對作用中的原生 turn 做 steering，app 層級的 steering 仍然可以運作。App 可以中斷作用中的 Provider turn，然後在同一個 `RunId` 底下建立一個替代的 attempt。

只有一個 attempt 會是最終被選定、用於 run 完成和 checkpoint 的 attempt。被取代（superseded）或被中斷的 attempt 會留在執行圖裡，供稽核/除錯使用。

:::plain Run 和 RunAttempt 的差別
`Run` 是使用者眼中的「這一個 turn」。`RunAttempt` 是為了完成這個 turn，實際叫 Provider 跑的某一次。通常只跑一次；但如果中途被中斷後重來、重試或復原，同一個 `Run` 底下就會有好幾個 attempt，最後只有一個算數，其他的留著供查閱。
:::

## ExecutionNode {#executionnode}

`ExecutionNode` 是 runtime 工作的通用單位。它是 Provider event 和 app 行為之間的橋樑。

```ts
type ExecutionNode = {
  id: NodeId;
  threadId: ThreadId;
  runId: RunId | null;
  parentNodeId: NodeId | null;
  rootNodeId: NodeId;
  kind:
    | "root_turn"
    | "assistant_message"
    | "reasoning"
    | "plan"
    | "todo_list"
    | "tool_call"
    | "approval_request"
    | "user_input_request"
    | "subagent"
    | "hook"
    | "system";
  status:
    | "pending"
    | "running"
    | "waiting"
    | "completed"
    | "interrupted"
    | "failed"
    | "cancelled"
    | "rolled_back";
  countsForRun: boolean;
  providerThreadId: ProviderThreadId | null;
  providerTurnId: ProviderTurnId | null;
  nativeItemRef: ProviderRef | null;
  runtimeRequestId: RuntimeRequestId | null;
  checkpointScopeId: CheckpointScopeId | null;
  startedAt: string | null;
  completedAt: string | null;
};
```

Run 的根節點是唯一可以讓這個 run 完成的節點。Subagent 節點、工具節點、核准節點和計畫節點都可以各自獨立完成。

## CheckpointScope {#checkpointscope}

`CheckpointScope` 描述一個可以做 checkpoint 的檔案系統狀態單位。Root run 和子執行節點都可以有 checkpoint scope。

```ts
type CheckpointScope = {
  id: CheckpointScopeId;
  threadId: ThreadId;
  runId: RunId | null;
  nodeId: NodeId;
  parentScopeId: CheckpointScopeId | null;
  providerThreadId: ProviderThreadId | null;
  kind: "root_run" | "subagent" | "tool" | "provider_thread" | "manual";
  ordinalWithinParent: number;
  advancesAppRunCount: boolean;
  cwd: string;
  createdAt: string;
};
```

Root run 的 scope 是 `advancesAppRunCount = true`。子 scope（例如 subagent）是 `advancesAppRunCount = false`，並且巢狀地放在父 run 的 scope 底下。

:::plain 節點與 checkpoint 範圍
一個 run 裡的工作排成一棵樹，只有最上面的根節點完成，這個 run 才算完成；底下的工具、核准、subagent 節點各自做完並不會結束這個 run。Checkpoint 也分層：root run 的 checkpoint 會讓 app 的 run 計數往前一步，底下子層的 checkpoint 則不會。
:::

## ProviderSession {#providersession}

`ProviderSession` 是一個正在執行的 Provider runtime 行程/session，例如一個 Codex app-server 行程，或一個 Claude SDK session。

```ts
type ProviderSession = {
  id: ProviderSessionId;
  provider: ProviderKind;
  status: "starting" | "ready" | "running" | "waiting" | "stopped" | "error";
  cwd: string;
  model: string | null;
  capabilities: ProviderCapabilities;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};
```

如果 Provider 支援，一個 Provider session 可以承載一個或多個 Provider thread。如果某個 Provider 每個行程只支援一個作用中的對話，V2 仍然把它建模成「一個 Provider thread 掛在這個 session 上」。

Session 實體是一份持久化的 metadata，描述一個「正在執行、或可以復原」的 runtime；它不是 runtime handle 本身。記憶體裡的行程/client handle 可能因為 server 重啟、閒置回收機制（idle reaper）把它釋放，或是 Provider 行程當掉而消失。不論是哪一種情況，app 都會把 `ProviderSession`、`ProviderThread` 和原生的 resume ref 保存在持久化狀態裡，然後透過一般的 Provider session manager 路徑重新建立執行中的 runtime。

Provider runtime 的 id 和序號（ordinal）絕對不可以依賴 adapter 行程的記憶體。如果某個值會被持久化，或是必須在復原之後仍然存在，它就要由 orchestrator/correlation/id 服務來配置，或是從持久化的 Provider ref 推導出來。

## ProviderThread {#providerthread}

`ProviderThread` 是 Provider 原生的對話 handle。即使它巢狀地掛在一個 subagent 執行節點底下，它仍然是可定址的。

```ts
type ProviderThread = {
  id: ProviderThreadId;
  provider: ProviderKind;
  providerSessionId: ProviderSessionId | null;
  appThreadId: ThreadId | null;
  ownerNodeId: NodeId | null;
  nativeThreadRef: string | null;
  nativeConversationHeadRef: ProviderRef | null;
  status: "not_loaded" | "idle" | "active" | "archived" | "closed" | "error";
  firstRunOrdinal: number | null;
  lastRunOrdinal: number | null;
  handoffIds: ContextHandoffId[];
  forkedFrom: ProviderThreadForkSource | null;
  createdAt: string;
  updatedAt: string;
};
```

當 Provider thread 在背後支撐一個一等公民的 app thread 時，會設定 `appThreadId`。當 Provider thread 巢狀地掛在某個執行節點（例如 subagent）底下時，會設定 `ownerNodeId`。Provider thread 之後可以被 fork，或是升級（promote）成一等公民的 app thread。

Provider thread 的原生 run 涵蓋範圍可以有缺口。例如：run 1-5 使用 Codex Provider thread A，run 6-8 使用 Claude Provider thread B，然後 run 9 回到 Codex thread A，並附上一份涵蓋 run 6-8 的 handoff 摘要。在這種情況下，Codex thread A 仍然是同一個 Provider thread，但它在 run 9 之前有一個明確的 `ContextHandoff`。

:::plain Session 與 Provider thread
`ProviderSession` 記的是 Provider 的行程或 runtime，`ProviderThread` 記的是 Provider 那邊的一段對話。兩者存下來的都是「紀錄」，不是記憶體裡那個活著的行程本身：行程不見了（server 重啟、被閒置回收、當掉），紀錄和 resume 用的 ref 還在，可以照正常路徑把 runtime 重新建立起來。
:::

## ContextTransfer {#contexttransfer}

`ContextTransfer` 記錄一組來源/目標的關係，以及 context 應該如何在它們之間移動。它是使用者 fork、切換 Provider、merge-back 和 subagent 共用的基本元件。

```ts
type ContextTransfer = {
  id: ContextTransferId;
  type: "fork" | "provider_handoff" | "merge_back" | "subagent_spawn" | "subagent_result";
  sourceThreadId: ThreadId;
  targetThreadId: ThreadId;
  sourcePoint: ContextSourcePoint;
  basePoint: ContextSourcePoint | null;
  sourceProvider: ProviderKind | null;
  targetProvider: ProviderKind | null;
  status:
    "pending" | "resolved_native" | "resolved_portable" | "failed" | "consumed" | "superseded";
  resolution: ContextTransferResolution | null;
  createdBy: "user" | "agent" | "system";
  createdAt: string;
  consumedAt: string | null;
};
```

```ts
type ContextSourcePoint = {
  threadId: ThreadId;
  runId: RunId | null;
  checkpointId: CheckpointId | null;
  turnItemId: TurnItemId | null;
  providerThreadRef: NativeThreadRef | null;
  providerTurnRef: NativeTurnRef | null;
};

type ContextTransferResolution =
  | { strategy: "native_fork"; providerThreadRef: NativeThreadRef }
  | { strategy: "portable_context"; contextHandoffId: ContextHandoffId }
  | { strategy: "delta_context"; contextHandoffId: ContextHandoffId }
  | { strategy: "checkpoint_context"; contextHandoffId: ContextHandoffId };
```

建立一筆 transfer 的成本應該要很低。成本高的 context handoff 是延遲（lazy）實體化的：等到目標 run 開始、而且已經知道選定的 Provider 之後才做。

## ContextHandoff {#contexthandoff}

`ContextHandoff` 是一等公民的產物，在必須橋接可攜式 Provider context 時建立。最常見的情況是在兩個 run 之間更換 Provider，但它也適用於 Provider resume 失敗、必須用 app 的歷史紀錄來為替代的 Provider thread 建立初始內容的情況。

在更廣的 transfer 模型裡，`ContextTransfer` 記錄來源、目標和生命週期。`ContextHandoff` 則是當原生轉移無法滿足這個關係時，由 run 消耗的那份實體化 payload。

```ts
type ContextHandoff = {
  id: ContextHandoffId;
  transferId: ContextTransferId;
  threadId: ThreadId;
  targetRunId: RunId;
  fromProviderThreadIds: ProviderThreadId[];
  toProviderThreadId: ProviderThreadId;
  coveredRunOrdinals: {
    from: number;
    to: number;
  };
  strategy:
    | "delta_since_target_last_seen"
    | "full_thread_summary"
    | "checkpoint_summary"
    | "manual_context";
  status: "pending" | "ready" | "failed" | "superseded";
  summaryMessageId: MessageId | null;
  summaryText: string;
  createdByProvider: ProviderKind | null;
  createdAt: string;
  updatedAt: string;
};
```

Handoff 不只是 prompt 文字。它是圖的一部分，可以被檢視、重新產生、取代（supersede）或稽核。

回到某個 Provider 時，優先採用的策略是 `delta_since_target_last_seen`：恢復先前的 Provider thread，只摘要那個 Provider 不在作用中期間所發生的 run。當 resume 失敗、Provider 設定不相容，或是累積的 handoff 會造成 context 品質不佳時，就使用 `full_thread_summary`。

:::plain Transfer 與 Handoff 的分工
`ContextTransfer` 是一筆很便宜的紀錄，只寫下「從哪裡來、到哪裡去、目前狀態」。真正花成本的 `ContextHandoff`（那份摘要內容）要等到目標 run 要開始、也知道用哪個 Provider 了才製作；如果 Provider 原生的轉移就夠用，就不需要它。
:::

## ProviderTurn {#providerturn}

`ProviderTurn` 是 Provider 原生 turn 的正規化 handle。

```ts
type ProviderTurn = {
  id: ProviderTurnId;
  providerThreadId: ProviderThreadId;
  nodeId: NodeId;
  runAttemptId: RunAttemptId | null;
  nativeTurnRef: string | null;
  ordinal: number;
  status: "pending" | "running" | "completed" | "interrupted" | "failed" | "cancelled";
  startedAt: string | null;
  completedAt: string | null;
};
```

Codex 有強的原生 turn id。能力較弱的 Provider 可能只有序號。兩者都會對應到 `ProviderTurnId`。

## RuntimeRequest {#runtimerequest}

Request 代表由 Provider 發起、需要 app/使用者回應的 callback。

```ts
type RuntimeRequest = {
  id: RuntimeRequestId;
  nodeId: NodeId;
  providerTurnId: ProviderTurnId | null;
  nativeRequestRef: string | null;
  kind:
    "command" | "file-read" | "file-change" | "dynamic_tool_call" | "user_input" | "auth_refresh";
  status: "pending" | "resolved" | "expired" | "cancelled";
  responseCapability:
    | { type: "live"; providerSessionId: ProviderSessionId }
    | { type: "not_resumable"; reason: string };
  createdAt: string;
  resolvedAt: string | null;
};
```

這些權限種類，和 V1 `ProviderRequestKind` 所使用的正式領域值是同一組。Adapter 會把 Provider 原生的 callback 名稱（例如 Codex 的 `item/commandExecution/requestApproval`，以及 Claude 的工具權限名稱）對應到這些 app 層級的值。

Request 在重啟之後可能仍然看得到，但只有在它的 `responseCapability` 是 live 時才可以回應。

:::plain 這兩個實體
`ProviderTurn` 是 Provider 那邊「一個 turn」在 app 這裡的代號，不管 Provider 自己有沒有給 turn id。`RuntimeRequest` 是 Provider 反過來問 app 或使用者的事，例如核准請求。重啟之後這類請求可能還看得到，但不一定還能回應。
:::

## 訊息 {#messages}

訊息屬於對話 projection，不屬於原始的 Provider 圖。可以的話，它們會連回 run 和節點。

```ts
type ConversationMessage = {
  id: MessageId;
  threadId: ThreadId;
  runId: RunId | null;
  nodeId: NodeId | null;
  role: "user" | "assistant" | "system";
  text: string;
  attachments: Attachment[];
  streaming: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Provider 的訊息 chunk 是透過 item/content event 收集起來，再投影（project）成訊息。Projection 預設可以隱藏子層/subagent 的訊息，同時在圖裡保留它們。

## 計畫、問題與 todo list {#plans-questions-and-todo-lists}

V2 把這些視為結構化的 turn item 或執行節點。

```ts
type PlanArtifact = {
  id: PlanId;
  threadId: ThreadId;
  runId: RunId | null;
  nodeId: NodeId;
  kind: "proposed_plan" | "todo_list" | "questions";
  status: "draft" | "active" | "completed" | "superseded";
  markdown?: string;
  steps?: Array<{ id: string; text: string; status: "pending" | "running" | "completed" }>;
  questions?: UserInputQuestion[];
};
```

Codex 的 `turn/plan/updated` 對應到 `todo_list` 產物。Plan mode 最終的計畫 item 對應到 `proposed_plan`。使用者輸入的問題 request 對應到 `questions` 加上一個 `RuntimeRequest`。

## Checkpoint {#checkpoint}

Checkpoint 掛在 checkpoint scope 上。Root run 的 checkpoint 是使用者看得到的對話 checkpoint。子層的 checkpoint 則為 subagent、工具或 Provider thread 記錄巢狀的檔案系統狀態，不會推進父層的 run 計數。

```ts
type Checkpoint = {
  id: CheckpointId;
  threadId: ThreadId;
  scopeId: CheckpointScopeId;
  runId: RunId | null;
  nodeId: NodeId;
  parentCheckpointId: CheckpointId | null;
  ordinalWithinScope: number;
  appRunOrdinal: number | null;
  ref: string;
  status: "ready" | "missing" | "error" | "stale";
  files: CheckpointFileSummary[];
  capturedAt: string;
};
```

子層/subagent 的 Provider turn 可以建立子 checkpoint。除非它是在一個 fork 出來或升級過的 thread 裡、以一等公民 app run 的身分執行，否則不會建立 app run 的 checkpoint。

## 原始 Provider 診斷資料 {#raw-provider-diagnostics}

原始 Provider 診斷資料是只能附加（append-only）的證據，用於除錯、支援和產生 replay fixture。它們應該寫進有上限的輪替 log 檔，而不是被當成正式的、持久化的 SQLite 狀態。

```ts
type RawProviderEvent = {
  id: RawEventId;
  provider: ProviderKind;
  providerSessionId: ProviderSessionId;
  sequence: number;
  direction: "incoming" | "outgoing";
  messageKind: "request" | "response" | "notification" | "error";
  method: string | null;
  jsonRpcId: string | number | null;
  payload: unknown;
  observedAt: string;
};
```

只要有原始 Provider 診斷資料可用，就不應該有任何領域行為依賴於解析歷史上的 UI event。正式環境的行為應該依賴正規化之後的 orchestration event/實體和 Provider ref。原始 Provider frame 是證據和 replay 的輸入，不是一般 app 狀態的唯一事實來源（source of truth）。

正規化之後的 V2 實體應該保留足夠的關聯 metadata，以便解釋行為並為行為做路由：

- Provider 種類。
- Provider session/thread/turn 的 ref。
- Provider item/request 的 ref（有的話）。
- 原生 id 的強度。
- 診斷 log 的位置，或原始 frame 的參照（有用的時候）。

Replay 框架可以拿原始 Provider transcript 當輸入，而不需要正式環境的 SQLite 儲存每一個原始 frame。

:::plain 原始資料的定位
Provider 實際送來送去的原始內容只當作「證據」留在會輪替的 log 檔裡，用來除錯和做 replay 測試。App 平常的行為不靠它，靠的是正規化之後的 event 和實體。
:::

## Projection {#projections}

V2 應該提供各自獨立的 projection：

- Thread shell：快速的側邊欄清單。
- Thread detail：訊息、run、activity、checkpoint、計畫。
- 執行圖：節點與 Provider ref 的除錯/開發者檢視。
- Provider session：執行中的 runtime/行程狀態。
- 待處理 request：可以採取行動的核准請求/使用者輸入。

UI 可以保持簡單，而圖仍然保持精確。

Projection 串流應該使用 app 既有的「snapshot 加 cursor」合約。Thread detail 的訂閱應該回傳一份位於 sequence `N` 的 projection snapshot，然後只串流 `N` 之後的 event。前端不應該收到已經反映在 snapshot 裡的 event。重新連線時可以從一份全新的 snapshot 重設，而不是重播 client 本機的狀態；這份新的 snapshot 和它的 `snapshotSequence` 會成為新的 cursor 界線。

## Turn item projection {#turn-item-projection}

前端不應該自己把 `messages`、`plans`、checkpoint、核准和 activity 合併起來重建顯示順序。V2 提供一份有順序的 `turnItems` projection，用於呈現 thread detail。

`turnItems` 是 projection 紀錄，不是正式的唯一事實來源（source of truth）。正式的圖仍然以正規化的形式存在 run、attempt、節點、request、訊息、計畫和 checkpoint 裡。在需要關聯的地方，Provider 原生的 item ref 直接放在節點和 turn item 上。

Fork 出來的 thread 另外提供一份推導出來的 `visibleTurnItems` projection。`turnItems` 仍然是在那個 app thread 上送出的正式 item。`visibleTurnItems` 則是使用者看得到的、有順序的 read model：它可以透過 fork 的來源點參照繼承自來源的 item，可以包含合成的生命週期標記（例如 "forked from conversation"），然後接著是目標 thread 本身的 item。這樣可以讓儲存保持正規化，同時讓 thread detail 檢視和測試有一個由後端負責的介面可以拿來斷言。

已知的常見工具應該有結構化的 item 變體，讓前端不必解析 Provider 的文字，就能呈現穩定的自訂元件：

```ts
type TurnItem =
  | UserMessage
  | AssistantMessage
  | Reasoning
  | Plan
  | FileChange
  | CommandExecution
  | FileSearch
  | WebSearch
  | ApprovalRequest
  | Checkpoint
  | Compaction
  | Handoff
  | Fork
  | DynamicTool;
```

範例：

```ts
type FileChange = {
  type: "file_change";
  fileName: string;
  additions?: number;
  deletions?: number;
  diffStr?: string;
  oldStr?: string;
  newStr?: string;
};

type CommandExecution = {
  type: "command_execution";
  input: string;
  status: TurnItemStatus;
  output?: string;
  exitCode?: number;
};

type DynamicTool = {
  type: "dynamic_tool";
  toolName: string | null;
  input: unknown;
  output?: unknown;
};
```

Compaction、handoff 和 fork 是 orchestration 的生命週期 item，不是動態工具：

- `compaction`：同一個 item 可以從 `running`（標題類似 "Compacting context..."）轉換成 `completed`（標題類似 "Compacted context"）。
- `handoff`：記錄從一個或多個來源 Provider thread/Provider，到一個目標 Provider thread/Provider 的 context 橋接。
- `fork`：記錄使用者或系統從某個 run、節點或 Provider thread 建立了一個新的 app thread。

UI 可以用決定性的元件呈現已知的變體，並把 `dynamic_tool` 呈現成可展開的 JSON 輸入/輸出。每個 turn item 都保留指回 `runId`、`nodeId`、`providerTurnId` 和 `nativeItemRef` 的 ref，讓除錯檢視可以從顯示串流跳回圖和 Provider log。

:::plain 前端只需要照順序畫
畫面上一則則的內容（訊息、計畫、檔案變更、指令執行、核准請求、checkpoint 等等）的順序由後端排好，放在 `turnItems` 裡，前端不必自己拼。常見的項目有固定的結構可以直接畫成對應的元件，認不得的就當成 `dynamic_tool`，顯示成可展開的 JSON。
:::
