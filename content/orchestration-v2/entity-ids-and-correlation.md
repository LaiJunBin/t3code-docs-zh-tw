---
title: 實體 ID 與關聯
source: docs/orchestration-v2/entity-ids-and-correlation.md
source_hash: ce65526cc76b552204c424a6b420bd9f561446cc
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

## 原則 {#principle}

Provider id 是證據。App id 才是身分。

每個持久化的實體都使用 app 自有的 id 作為主鍵。Provider 原生的 id 以選用的 ref（參照）形式儲存，只用於關聯（correlation）、除錯、replay 和 command 路由。

:::plain 換句話說
T3 Code 裡的每樣東西，都用 T3 Code 自己發的編號來認。Provider 給的編號只是附在旁邊的對照資料，用來查「這個東西在 Provider 那邊叫什麼」，不會拿來當成這樣東西本身的身分。
:::

## ID 家族 {#id-families}

```text
ThreadId              app-visible conversation thread
RunId                 counted app turn
NodeId                execution graph node
ProviderSessionId     live/resumable provider runtime session
ProviderThreadId      app handle for provider-native conversation
ProviderTurnId        app handle for provider-native turn
RuntimeRequestId      app handle for provider callback/request
RawEventId            optional raw provider diagnostic frame id
CheckpointId          app checkpoint id
PlanId                app plan/todo/question artifact id
```

Provider id 絕對不會取代這些 id。

## Provider ref {#provider-refs}

Provider ref 是附在 runtime 實體和 event 上的 metadata。

```ts
type ProviderRefs = {
  provider: ProviderKind;
  nativeSessionRef?: string;
  nativeThreadRef?: string;
  nativeTurnRef?: string;
  nativeItemRef?: string;
  nativeRequestRef?: string;
  rawEventId?: RawEventId;
  method?: string;
};
```

Codex 可以填入其中大部分的欄位。其他 Provider 可能只填入一部分。

## 關聯的範圍 {#correlation-scope}

關聯永遠是有範圍（scope）的。絕對不要在沒有 Provider/session/thread 範圍的情況下，對原生 id 做全域比對。

建議使用的比對鍵：

```text
ProviderThread:
  provider + providerSessionId + nativeThreadRef

ProviderTurn:
  providerThreadId + nativeTurnRef
  or providerThreadId + turnOrdinal

Node / TurnItem:
  providerTurnId + nativeItemRef
  or providerTurnId + itemOrdinal

RuntimeRequest:
  providerSessionId + nativeRequestRef
  or providerTurnId + requestOrdinal
```

如果某個 Provider 會重複使用 id，Provider adapter 必須把範圍放寬，直到對應關係不再有歧義為止。

:::plain 為什麼要加範圍
原生 id 單獨拿出來比對並不可靠，所以比對時一定要連同「是哪個 Provider、哪個 session、哪個 thread」一起比。上面的比對鍵每一組都是「範圍 + 原生 ref」；沒有原生 ref 時，就改用「範圍 + 序號（ordinal）」。
:::

## 對應關係的儲存 {#mapping-store}

V2 需要一張持久化的關聯資料表，或是等效的、以 event sourcing 方式保存的 binding 串流。

```ts
type IdentityBinding = {
  id: IdentityBindingId;
  appEntityKind: "provider_thread" | "provider_turn" | "node" | "item" | "request" | "message";
  appEntityId: string;
  provider: ProviderKind;
  providerSessionId: ProviderSessionId;
  nativeKind: string | null;
  nativeRef: string | null;
  scope: {
    threadId: ThreadId | null;
    runId: RunId | null;
    parentNodeId: NodeId | null;
    providerThreadId: ProviderThreadId | null;
    providerTurnId: ProviderTurnId | null;
  };
  correlation: "native_exact" | "native_scoped" | "ordinal" | "fingerprint" | "synthetic";
  firstRawEventId?: RawEventId;
  lastRawEventId?: RawEventId;
  createdAt: string;
  updatedAt: string;
};
```

這並不是要做成一個龐大的身分識別子系統。它只是一個最小的持久化位置，用來記錄「這個原生的東西對應到這個 app 的東西」。原始 event 的參照是選用的診斷指標；binding 本身絕對不可以要求正式環境的 SQLite 永久保留原始 Provider frame。

## ID 配置規則 {#id-allocation-rules}

1. 如果 Provider 提供了穩定的原生 id，就重複使用既有的 binding，或是配置一個新的 app id 並綁定它。
2. 如果 Provider 沒有提供穩定的 id，就依有範圍的序號（scoped ordinal）來配置。
3. 如果序號還不夠用，就在範圍內再加上 fingerprint。
4. 一旦配置完成，絕對不要更改該實體的 app id。
5. 絕對不要用 id 的字串比對來推斷父層/根層是否已完成。

## 有範圍的序號 {#scoped-ordinals}

能力較弱的 Provider 需要決定性（deterministic）的序號。

```text
runOrdinalWithinThread
providerTurnOrdinalWithinProviderThread
nodeOrdinalWithinParent
itemOrdinalWithinProviderTurn
requestOrdinalWithinProviderTurn
messageOrdinalWithinNode
```

序號是 normalizer 在處理 Provider frame 時指派的。對於同一份 Provider transcript，序號在 replay 時必須是決定性的。

## Fingerprint {#fingerprints}

Fingerprint 只是退而求其次的關聯工具。它們應該包含範圍和穩定的結構，而不是大段會變動的文字。

範例：

```text
ProviderTurn fingerprint:
  providerThreadId + runId + providerTurnOrdinalWithinProviderThread

Node / TurnItem fingerprint:
  providerTurnId + itemKind + itemOrdinalWithinProviderTurn + toolName?

RuntimeRequest fingerprint:
  providerTurnId + requestKind + nativeItemRef? + requestOrdinalWithinProviderTurn
```

不要把完整的 assistant 文字當成主要的 fingerprint。文字會變動、可能分成多個 chunk 串流進來，也可能重複。

:::plain 三層退路
配置 id 時有先後順序：Provider 有給穩定的 id 就用它來綁定；沒有就用「在這個範圍裡的第幾個」這種序號；序號還分不清楚，才加上 fingerprint。不管走哪一條，app id 一旦發出去就不再更改。
:::

## Runtime event {#runtime-events}

正規化之後的 runtime event 應該同時帶有 app id 和 Provider ref。

```ts
type RuntimeEvent = {
  id: RuntimeEventId;
  type: RuntimeEventType;
  threadId: ThreadId;
  runId: RunId | null;
  nodeId: NodeId | null;
  parentNodeId: NodeId | null;
  providerSessionId: ProviderSessionId | null;
  providerThreadId: ProviderThreadId | null;
  providerTurnId: ProviderTurnId | null;
  nativeItemRef: string | null;
  requestId: RuntimeRequestId | null;
  providerRefs: ProviderRefs;
  payload: unknown;
  createdAt: string;
};
```

下游系統應該使用 app id。Provider ref 保留下來是為了檢視和 adapter 路由。

## Command 路由 {#command-routing}

UI 和 orchestration 的 command 都以 app id 為對象。

```text
approval.respond(RuntimeRequestId)
interrupt.run(RunId)
interrupt.node(NodeId)
fork.fromNode(NodeId)
rollback.toRun(ThreadId, runOrdinal)
```

Provider command 層在邊界上把 app id 解析成 Provider ref。如果 Provider ref 不存在或已經不再有效（live），command 就會失敗，並帶有一個具型別的能力/狀態錯誤。

範例：

```text
RuntimeRequestId -> nativeRequestRef + providerSessionId
RunId -> root NodeId -> ProviderTurnId -> nativeTurnRef
NodeId -> ProviderThreadId -> nativeThreadRef
```

:::plain 指令怎麼找到 Provider 那一邊的對象
UI 送出的指令只會講 app 這邊的 id，例如「回應這個 RuntimeRequestId」或「中斷這個 RunId」。到了最靠近 Provider 的那一層，才把它換成 Provider 認得的 ref。換不出來（ref 不存在，或已經失效）時，指令會以一個明確型別的錯誤失敗。
:::

## 重啟之後的待處理 request {#pending-requests-after-restart}

待處理 request 的紀錄可能在重啟之後還留著，但 Provider 的 callback 狀態通常不會。

V2 應該區分「歷史上看起來還在等待的 request」和「真的可以回應的 request」：

```ts
type ResponseCapability =
  | { type: "live"; providerSessionId: ProviderSessionId }
  | { type: "not_resumable"; reason: string };
```

UI 可以顯示某個 request 已經過期，使用者必須重新啟動或重新執行這個 turn。

## Subagent 的關聯 {#subagent-correlation}

Subagent 是透過父子關係的執行節點（execution node）來表示的。

以 Codex 來說：

```text
collabAgentToolCall item
  -> ExecutionNode(kind="subagent" or "tool_call")
receiverThreadIds[]
  -> ProviderThread records
child turn/started and turn/completed
  -> child ProviderTurn and child ExecutionNode
```

子層的 Provider turn 保有它自己的 Provider ref。它是透過 `parentNodeId` 連結到父層，而不是把它的 turn id 換成父層的 turn id。

對於能力較弱的 Provider，adapter 可以在目前作用中的父節點底下，依序號建立子節點。

## Replay 的決定性 {#replay-determinism}

給定相同的 Provider transcript 和相同的 app 初始狀態，正規化必須產生相同的 id。

需求：

- Identity binding 要以 event 或持久化資料列的形式保存下來。
- 只要 binding 在下游 projection 之前就已經持久化，產生出來的 id 可以是隨機的。
- Fixture replay 可以使用決定性的 id 產生方式，讓斷言比較好寫。
- 重新處理同一個 Provider frame 時，應該找到既有的 binding，而不是再配置出另一個實體。

:::plain 這一節的要求
同樣的 Provider 輸出再跑一次，得到的 id 必須和上一次一樣。做法是把「原生的東西對應到哪個 app id」這個 binding 存下來：第二次處理同一個 frame 時，是查到舊的 binding，而不是再發一個新的 id。
:::
