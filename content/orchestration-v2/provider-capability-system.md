---
title: Provider 能力系統
source: docs/orchestration-v2/provider-capability-system.md
source_hash: dc544b1af1061032917219bcc960b644bf3ffc8b
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

V2 絕對不可以假設每個 Provider 都做得到 Codex 能做的事。Provider 的行為應該透過能力（capability）和 policy 來表達，而不是用散落在 orchestration 各處的「依 Provider 名稱判斷」的條件式。

:::plain 一句話版本
不要寫「如果是某某 Provider 就這樣做」。改成讓每個 Provider 自己宣告「我會什麼、不會什麼」，orchestration 只看這份宣告，並且事先定好「不會的時候怎麼辦」。
:::

## 能力的形狀 {#capability-shape}

```ts
type ProviderCapabilities = {
  sessions: SessionCapabilities;
  threads: ThreadCapabilities;
  turns: TurnCapabilities;
  streaming: StreamingCapabilities;
  tools: ToolCapabilities;
  approvals: ApprovalCapabilities;
  planning: PlanningCapabilities;
  subagents: SubagentCapabilities;
  context: ContextCapabilities;
  checkpointing: CheckpointCapabilities;
  identity: IdentityCapabilities;
};
```

能力應該要有版本，並由每個 adapter 在 session 開始時送出。

## Session 能力 {#session-capabilities}

```ts
type SessionCapabilities = {
  supportsMultipleProviderThreadsPerSession: boolean;
  supportsModelSwitchInSession: boolean;
  supportsProviderSwitchingViaHandoff: boolean;
  supportsRuntimeModeSwitchInSession: boolean;
  pendingRequestsSurviveRestart: boolean;
};
```

Policy 範例：

- 如果不支援切換模型，就啟動一個新的 Provider session。
- 如果待處理的 request 在重啟之後不會留存，就把舊的 request 標記為 `not_resumable`。

恢復（resume）Provider thread 並不是一項能力。它是 adapter 必須具備的基本操作。Adapter 必須能夠從已儲存的 Provider cursor/session/thread handle 啟動，否則就要回傳一個 runtime 的 resume 失敗。

## Thread 能力 {#thread-capabilities}

```ts
type ThreadCapabilities = {
  canCreateEmptyThread: boolean;
  canReadThreadSnapshot: boolean;
  canRollbackThread: boolean;
  canForkThread: boolean;
  canForkFromTurn: boolean;
  canForkFromSubagentThread: boolean;
  exposesNativeThreadId: boolean;
};
```

Codex 可以提供強的 thread id 和 rollback snapshot。Claude 可能透過它自己的 model/session 基本操作來支援原生 fork。其他 Provider 可能只支援由 app 合成的 fork。

## Turn 能力 {#turn-capabilities}

```ts
type TurnCapabilities = {
  exposesNativeTurnId: boolean;
  emitsTurnStarted: boolean;
  emitsTurnCompleted: boolean;
  supportsInterrupt: boolean;
  supportsActiveSteering: boolean;
  supportsSteeringByInterruptRestart: boolean;
  supportsQueuedMessages: boolean;
  terminalStatusQuality: "strong" | "weak" | "none";
};
```

如果 `terminalStatusQuality` 是 weak，V2 應該使用 adapter 的 policy 來推斷終止狀態，但仍然要據此標記關聯強度。

`supportsActiveSteering` 表示 Provider 可以直接修改一個進行中的 turn。`supportsSteeringByInterruptRestart` 表示 V2 可以用「中斷作用中的 turn，再啟動一個替代的 attempt」的方式，實作 app 層級的 steering。大多數 Provider 只要支援中斷和一般的後續 turn，就應該支援後者。

:::plain 兩種 steering
Steering 指的是在 agent 還在做事的時候調整它的方向。原文區分兩種做法：一種是 Provider 本身就能直接改動進行中的 turn；另一種是 Provider 做不到，於是由 V2 先中斷目前的 turn，再開一個替代的 attempt 接著做。
:::

## 串流能力 {#streaming-capabilities}

```ts
type StreamingCapabilities = {
  streamsAssistantText: boolean;
  streamsReasoning: boolean;
  streamsToolOutput: boolean;
  streamsPlanText: boolean;
  emitsMessageCompleted: boolean;
};
```

如果 Provider 不會送出訊息完成的 event，normalizer 就在 root run 終止時關閉 assistant 訊息。

## 工具能力 {#tool-capabilities}

```ts
type ToolCapabilities = {
  exposesToolItemIds: boolean;
  emitsToolStarted: boolean;
  emitsToolCompleted: boolean;
  emitsToolOutput: boolean;
  supportsMcpTools: boolean;
  supportsDynamicToolCallbacks: boolean;
};
```

能力較弱的 Provider 可能只產生文字形式的工具摘要。Adapter 仍然可以依有範圍的序號（scoped ordinal），建立有順序的 `turnItems` 和執行節點（execution node）。

## 核准能力 {#approval-capabilities}

```ts
type ApprovalCapabilities = {
  supportsCommandApproval: boolean;
  supportsFileReadApproval: boolean;
  supportsFileChangeApproval: boolean;
  supportsApplyPatchApproval: boolean;
  approvalsHaveNativeRequestIds: boolean;
  approvalCallbacksAreLiveOnly: boolean;
  approvalsCanOriginateFromSubagents: boolean;
};
```

只要待處理的核准請求是可以回應的，UI 就應該顯示它，不論它來自哪個執行節點，包括 subagent。

## 計畫能力 {#planning-capabilities}

```ts
type PlanningCapabilities = {
  emitsPlanUpdated: boolean;
  emitsTodoList: boolean;
  emitsProposedPlan: boolean;
  supportsStructuredQuestions: boolean;
  planDeltasHaveItemIds: boolean;
};
```

對應的 policy：

- `emitsTodoList`：更新 run 的即時進度。
- `emitsProposedPlan`：建立可接受/可實作的計畫產物。
- `supportsStructuredQuestions`：建立可回應的使用者輸入 request。

如果某個 Provider 只送出純文字的 assistant 訊息，app 就不應該假裝它有結構化的計畫。

## Subagent 能力 {#subagent-capabilities}

```ts
type SubagentCapabilities = {
  supportsSubagents: boolean;
  exposesSubagentThreadIds: boolean;
  emitsSubagentLifecycle: boolean;
  canWaitForSubagents: boolean;
  canCloseSubagents: boolean;
  canForkSubagentThread: boolean;
};
```

當 `exposesSubagentThreadIds` 為 true 時，subagent 的 Provider thread 會成為可定址的 `ProviderThread` 紀錄。為 false 時，只要 Provider 提供了足夠的生命週期資訊，subagent 仍然可以顯示成巢狀的執行節點。

## Context handoff 能力 {#context-handoff-capabilities}

Context handoff 掌管 Provider 的切換，以及 Provider thread 的重建。

```ts
type ContextCapabilities = {
  acceptsSystemContext: boolean;
  acceptsDeveloperContext: boolean;
  acceptsSyntheticUserContext: boolean;
  canGenerateSummaries: boolean;
  canConsumeHandoffSummaries: boolean;
  supportsDeltaHandoff: boolean;
  supportsFullThreadHandoff: boolean;
  maxRecommendedHandoffChars: number | null;
};
```

Policy 範例：

- 如果有 `supportsDeltaHandoff`，就回到先前的 Provider thread，並只附上「不在這個 Provider 上執行的那些 run」的摘要。
- 如果不支援 delta handoff，或它的品質不佳，就建立新的 Provider thread，並附上整個 thread 的完整摘要。
- 如果 Provider 無法接受明確的 context，切換 Provider 就應該要求使用合成的使用者 context，否則標記為不支援。
- 如果沒有任何 Provider 能產生摘要，就使用 app 設定的摘要用 Provider，或是本機的 summarizer 能力。

:::plain 換 Provider 時要帶什麼過去
切換 Provider 時，要交給接手的 Provider 一份摘要。原文給的規則是：回到先前用過的 Provider thread 時，能只補「它不在場時發生的那幾個 run」就只補那一段（delta）；做不到或品質不好，就開一個新的 Provider thread，給整段對話的摘要。
:::

## Checkpoint 能力 {#checkpoint-capabilities}

Checkpoint 主要由 app 負責，但 Provider 對話的 rollback 則取決於 Provider。

```ts
type CheckpointCapabilities = {
  appCanCheckpointFilesystem: boolean;
  supportsNestedCheckpointScopes: boolean;
  providerCanRollbackConversation: boolean;
  providerRollbackReturnsSnapshot: boolean;
  providerCanReadConversationSnapshot: boolean;
};
```

如果不支援 Provider rollback，檔案系統的 rollback 仍然可以進行，但 Provider 的對話狀態必須重新啟動，或標記為已分歧（divergent）。巢狀的 checkpoint scope 由 app 負責；Provider 只影響一件事：它們的巢狀 Provider 對話能不能 rollback，以對上還原後的檔案系統狀態。

## 身分識別能力 {#identity-capabilities}

```ts
type IdentityCapabilities = {
  nativeThreadIds: "strong" | "weak" | "none";
  nativeTurnIds: "strong" | "weak" | "none";
  nativeItemIds: "strong" | "weak" | "none";
  nativeRequestIds: "strong" | "weak" | "none";
};
```

這決定了 normalizer 如何對 event 做關聯：

- `strong`：把原生 id 當成有範圍的 Provider ref 來使用。
- `weak`：使用原生 id 加上序號/fingerprint。
- `none`：依有範圍的序號來配置。

## 降級 policy {#degradation-policies}

每項功能都應該宣告缺少能力時會發生什麼事。

範例：

```text
interrupt unsupported
  -> stop session if allowed, otherwise mark unsupported

active steering unsupported
  -> interrupt active turn and restart the run as a steering replacement attempt

fork unsupported
  -> synthetic fork from app projection if policy allows

rollback unsupported
  -> restore filesystem checkpoint, restart provider context, mark provider state divergent

nested checkpoint unsupported
  -> capture only root-run checkpoint and record child filesystem activity as uncheckpointed

provider switch return unsupported
  -> create fresh provider thread with full app-thread summary

structured approvals unsupported
  -> provider runs under configured sandbox policy; no approval UI

plan_updated unsupported
  -> no live todo UI; rely on assistant messages
```

UI 不應該把「不支援的行為」藏在 Provider 專屬的錯誤後面。它應該收到具型別的能力結果。

:::plain 降級是什麼意思
某個 Provider 做不到某件事時，不是讓功能直接壞掉，而是事先講好退而求其次的做法。上面每一組都是「缺少某項能力 -> 改成怎麼做」。而且 UI 拿到的應該是「這項能力不支援」這種明確的結果，而不是某個 Provider 自己的錯誤訊息。
:::

## Adapter 合約 {#adapter-contract}

每個 Provider adapter 應該提供：

```ts
type ProviderAdapter = {
  getCapabilities(): ProviderCapabilities;
  startSession(input): ProviderSession;
  ensureProviderThread(input): ProviderThread;
  sendRun(input): ProviderTurnStartResult;
  steerRun?(input): void;
  interrupt(input): void;
  respondToRequest(input): void;
  readThreadSnapshot?(input): ProviderThreadSnapshot;
  rollbackThread?(input): ProviderThreadSnapshot | void;
  forkThread?(input): ProviderThread;
  streamEvents(): Stream<ProviderAdapterEvent>;
};
```

選用的方法由能力把關。Orchestration 層在呼叫選用的方法之前，應該先檢查能力，或是透過 policy wrapper 來呼叫。

原始 Provider frame 應該由 Provider 的 transport/runtime 記錄成有上限的診斷資料。Adapter 的串流應該提供正規化之後的 Provider event，讓 V2 的 normalizer 可以把它們轉成 app 的 orchestration event。

## 由能力驅動的 UI {#capability-driven-ui}

UI 應該收到已經參考過能力的操作提示（affordance）：

- 依 fork 的來源顯示或隱藏 fork 操作。
- 把中斷顯示為可用、具破壞性的替代做法，或無法使用。
- 把核准請求顯示為可回應或已過期。
- 只有在存在結構化的計畫產物時，才顯示計畫/todo 面板。
- 只有在 app checkpoint 存在時才顯示 rollback，並標註 Provider 是否支援 rollback。

這樣一來，不論是 Codex、Claude、Cursor、OpenCode 還是未來的 Provider，產品的行為都能保持可預期。
