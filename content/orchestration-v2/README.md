---
title: Orchestration V2 設計文件
nav: 總覽
source: docs/orchestration-v2/README.md
source_hash: 102637f4e9ab7d436306cecc3db8890871826dc6
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

這一組文件描述下一代 orchestration 模型的目標架構。它不是針對目前實作的修補計畫，而且刻意不考慮遷移與向後相容。這些問題應該等目標模型本身前後一致之後再處理。

V2 是重寫 orchestrator，不是重寫整個 app 的領域平台。既有的非 orchestration 領域、持久化與 migration 基礎設施、websocket/RPC 基礎設施，以及 projection 串流的語意都應該保留，除非 V2 暴露出某個具體的、orchestration 專屬的缺口。

V2 的設計依據，是在 Codex app-server probe（探測）中觀察到的真實 Provider 行為，但它並不是 Codex 專屬的。Codex 被當成我們目前擁有的最完整的協定；能力較弱的 Provider 則透過 app 自有的 id 和明確的能力旗標（capability flag），轉接到同一個模型裡。

## 文件列表 {#documents}

- [核心圖與資料模型](./core-graph-and-data-model.md)
- [實體 ID 與關聯](./entity-ids-and-correlation.md)
- [功能生命週期](./feature-lifecycles.md)
- [Thread 譜系與 context transfer](./thread-lineage-and-context-transfer.md)
- [切換 Provider 與 context handoff](./provider-switching-and-context.md)
- [Orchestrator MCP Server](./orchestrator-mcp-server.md)
- [Provider 能力系統](./provider-capability-system.md)
- [測試策略](./testing-strategy.md)

## 主要目標 {#primary-goals}

- 忠實保留 Provider 原生的生命週期，但不讓 Provider 的 id 滲進 app 的身分識別。
- 把根 turn、subagent、工具、核准、計畫和 checkpoint 建模成同一張執行圖（execution graph）。
- 讓「root run 完成」成為唯一能讓使用者可見的 turn 結束的 event。
- 支援從一般 thread 以及已完成的 subagent/Provider thread 進行 fork。
- 支援在兩個 run 之間更換 Provider，並把它當成一等公民的 context handoff（上下文交接）。
- 透過共用的 thread 譜系（lineage）與 context transfer（上下文轉移）基本元件，來建模 fork、Provider handoff、merge-back 和 subagent。
- 透過由 app 自己決定性地配置 id，來支援 id 很弱或根本沒有 id 的 Provider。
- 讓功能的行為由能力（capability）驅動，而不是由 Provider 的名稱驅動。

## 關鍵不變條件 {#key-invariants}

1. App id 是主要的。Provider id 只是 ref（參照）。
2. Provider event 絕對不會被改寫成看起來像另一個 Provider event。
3. 子執行的完成絕對不會關閉父 run。
4. Checkpoint 掛在可以做 checkpoint 的執行範圍（scope）上。Root run 的 checkpoint 會推進 app 的 run 歷史；子層/subagent 的 checkpoint 是巢狀的，不會推進父層的 run 計數。
5. Rollback 以 app 的 run 計數來表達，並且與 Provider 的對話狀態進行對帳。
6. 每個 command 都以 app id 為對象；adapter 在邊界上把它們轉換成 Provider ref。
7. Provider 缺少某項能力時，要明確表示出來，並由 policy 處理。
8. 切換 Provider 會建立明確的 context handoff 產物；它們不是藏起來的 prompt 小技巧。
9. Fork 先記錄 app 層級的譜系。Provider 原生 fork 和可攜式 context handoff 都是延遲（lazy）的解析策略，在 run 開始時才選定。
10. 測試應該優先採用以 replay 為基礎的整合測試覆蓋，而不是用 mock 的單元測試。在 orchestration 測試裡，唯一正常會被替換掉的東西是 Provider runtime 的 transport。

:::plain 這十條在講什麼
核心想法是「T3 Code 自己的 id 才算數」。Provider 給的 id 只拿來對照，不拿來當身分。在這個前提下：一個使用者看得到的 turn，只有在它最上層的那個 run 結束時才算結束，底下的子工作先做完不算；換 Provider、fork 這些動作都要留下明確的紀錄；某個 Provider 做不到的事要明講，然後交給 policy 決定怎麼辦。
:::

## 概念分層 {#conceptual-layers}

```text
Native provider protocol
  -> Rotating raw provider diagnostics
  -> Provider adapter / normalizer
  -> V2 orchestration event store using existing persistence patterns
  -> Runtime execution graph
  -> Conversation projection
  -> UI / API views
```

原始 Provider 診斷資料（raw provider diagnostics）儲存的是 Provider 實際送出或收到的內容，用於除錯和擷取 replay 素材。持久化的 app 狀態則是正規化之後的 orchestration 狀態：event/實體、關聯用的 ref、projection，以及 command receipt。Runtime 圖儲存的是 Provider 行為所代表的意義。對話 projection 儲存的是使用者看到的東西。

V2 應該與既有的 orchestration command/event/projection 基礎設施模式整合，而不是另外建立一套不相干的 event 系統。V2 專屬的工作是圖模型、Provider 生命週期語意、adapter 合約、normalizer、policy 和 projection。

V2 擁有自己的 event schema。V1 的 command 與 event union 已經不存在；V1 的資料列只作為舊版匯入器（`apps/server/src/orchestration-v2/legacy/`）的輸入而保留下來，而專案 event 則維持它們自己的應用程式 event 形狀。

:::plain 四種資料各自的角色
原文把資料分成四種：原始診斷資料記的是「Provider 實際講了什麼」，只用來除錯和 replay；正規化的 orchestration 狀態才是 app 持久保存的狀態；runtime 圖記的是「那些行為代表什麼意思」；對話 projection 記的是「使用者看到什麼」。
:::

## 最小心智模型 {#minimal-mental-model}

```text
AppThread
  Run 1
    root ExecutionNode
      tool ExecutionNode
      approval ExecutionNode
      subagent ExecutionNode
        ProviderThread
          child root ExecutionNode
  Run 2
    root ExecutionNode
```

App thread 是使用者看得到的對話。Run 是會被計數的、使用者看得到的 turn。執行節點（execution node）是 run 內部工作所構成的樹。Provider thread 是 Provider 原生的對話 handle，可以掛在 app thread 上，也可以掛在巢狀的執行節點上。

切換 Provider 不會建立新的 app thread。它會建立或重新啟用 Provider thread，並把 context handoff 摘要附加到下一個 run 上。

Fork 則確實會建立新的 app thread，但不應該在 fork 的當下就強迫選定 Provider。Fork 記錄的是 thread 譜系和一個待解析的來源點（source point）。Fork 上的第一個 run 才去解析這個來源點：可以的話使用 Provider 原生 fork，必要時使用可攜式的 context transfer。

:::plain 對應回你已經知道的詞
- **AppThread**：就是你在 T3 Code 裡看到的那段對話，也就是其他文件說的 Thread。
- **Run**：其他文件說的 turn（你送出訊息到 agent 做完的一來一回）。術語表把 turn 定義成「一個 V2 run」。
- **ExecutionNode**：一個 run 裡面的各項工作，例如工具呼叫、核准請求、subagent，排成一棵樹。
- **ProviderThread**：Provider 那一邊自己的對話 handle。它和 AppThread 是分開的兩個東西。
:::

## 由 probe 得出的需求 {#probe-derived-requirements}

Codex app-server 的 probe 顯示了幾項協定上的現實狀況，V2 模型必須保留它們：

- `thread/status/changed` 可能在完成之前或前後變成 idle，但 `turn/completed` 才是具權威性的 turn 終止 event。
- `turn/interrupt` 會先以一個 request 的形式完成；被中斷的終止狀態稍後才透過 `turn/completed` 抵達。
- 核准請求是由 Provider 發起的 JSON-RPC request，範圍限定在 Provider thread、turn 和 item。
- `thread/rollback` 會回傳 rollback 之後具權威性的 Provider thread snapshot。
- Subagent 子層的 `turn/completed` event 可能在父層/根 turn 完成之前發生。
- 子層的 Provider turn 是真正的 Provider turn，絕對不可以被重新對應到父層的 Provider turn id 上。

正是因為這些觀察，V2 才把 app run、Provider turn 和執行節點分開。

## 既有平台的界線 {#existing-platform-boundaries}

只要既有的 app 基礎設施不是這一類 orchestration bug 的來源，V2 就應該重複使用它：

- Command dispatch 應該保留既有的序列化/冪等（idempotent）command 處理方式，以及 command receipt 模式。
- Projection 串流應該保留目前 API 使用的「snapshot 加 cursor」語意。
- 持久化應該保留既有的 SQLite/migration/repository 基礎設施，以及 projection 串流語意。
- 原始 Provider frame 應該繼續當作診斷用的 log 資料，透過輪替（rotating）的 log 來限制保留量。
- Replay 測試應該只替換 Provider 的 transport/行程邊界。

V2 可以新增 V2 原生的 orchestration event、projection 資料表、command policy 和 Provider 執行服務。它不應該新增持久化的原始 Provider event 資料庫，也不應該新增另一套通用的 event bus，除非既有的基礎設施無法滿足某項有文件記載的 V2 需求。

V2 的 command dispatch 會針對被接受的 command，回傳最後一筆已提交的已儲存 event 的 sequence。重複的 command id 必須回傳同一個由 receipt 支撐的結果，而不重新執行 Provider 的副作用。這是前端用來取得重新連線/復原 cursor 的 API 層級界線。

:::plain 重點
V2 換掉的是 orchestrator 這一塊，其他底層（command 的處理方式、snapshot 加 cursor 的串流、SQLite 與 migration）都沿用。同一個 command id 送兩次，要拿到同一個結果，而且 Provider 那邊的動作不會被做第二次。
:::

## 追蹤中的後續項目：持久化的 effect outbox {#tracked-follow-up-durable-effect-outbox}

目前的 app pipeline 使用領域 event 加上 reactor 來觸發 Provider 的副作用：

```text
command
  -> domain event(s)
  -> projection
  -> reactor observes event
  -> provider side effect
  -> provider output ingestion
  -> domain event(s)
```

這樣做是成立的，但可能變得難以追蹤，因為 Provider 的副作用隱含在一個即時的訂閱裡。如果 V2 需要更強的重啟/復原/可除錯能力，就為 orchestration 的副作用引入一個持久化的 effect outbox：

```text
command
  -> transaction:
       append domain event(s)
       append provider effect request(s)
  -> projection
  -> stream to UI

effect worker
  -> claim effect request
  -> call provider
  -> ingest provider output
  -> append domain event(s)
  -> mark effect request completed/failed
```

Effect request 的範例：

```ts
type ProviderEffectRequest = {
  id: ProviderEffectRequestId;
  kind:
    | "provider.turn.start"
    | "provider.turn.interrupt"
    | "provider.runtime-request.respond"
    | "provider.thread.rollback"
    | "provider.thread.fork";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  threadId: ThreadId;
  runId: RunId | null;
  nodeId: NodeId | null;
  provider: ProviderKind;
  payload: unknown;
  causationEventId: EventId;
  commandId: CommandId | null;
  attempts: number;
  lastError: string | null;
};
```

這應該被視為一項基礎設施上的改進，而不是 V2 第一個切片（slice）的先決條件。V2 的第一版實作可以使用既有的 reactor 模式，但應該把 Provider 副作用的界線維持得夠清楚，讓日後改用 outbox 時，不需要重新設計圖或 Provider adapter。

:::plain 兩種做法差在哪
第一種做法是：event 寫進去之後，有一個 reactor 在旁邊看著 event，看到了才去呼叫 Provider。「要呼叫 Provider」這件事沒有另外記下來。第二種做法是：在寫入 event 的同一個 transaction 裡，同時寫下一筆「要請 Provider 做這件事」的請求，再由 effect worker 領走去執行，並標記完成或失敗。原文認為後者比較容易追蹤和復原，但把它列為後續改進，不是第一步就必須做的事。
:::
