---
title: 功能生命週期
source: docs/orchestration-v2/feature-lifecycles.md
source_hash: 164455b4e22f54b53ed3b60114075dfc36275f13
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

這份文件說明使用者會直接用到的核心功能，在 V2 裡應該怎麼運作。這些流程描述的是目標行為，不是目前實作的限制。

:::plain 先對一下名詞
這一頁會一直出現幾個實體名稱。依照這組設計文件自己的定義：app thread（`AppThread`）是使用者看得到的那段對話；run（`Run`）是「算數的、使用者看得到的一個 turn」，也就是你平常說的一個 turn；execution node（`ExecutionNode`）是一個 run 裡面的一個個工作單位，排成一棵樹；Provider thread（`ProviderThread`）是 Provider 那一邊原生的對話代號；Provider session（`ProviderSession`）是一個活著的、或可以恢復的 Provider 行程或 runtime。
:::

## 建立 Thread {#creating-threads}

建立 app thread 和開始 Provider 的工作，是分開的兩件事。

```text
thread.create
  -> AppThread created
  -> no provider session required yet
  -> no provider thread required yet unless eager provider creation is enabled
```

Provider thread 可以延後到需要時才建立：

```text
first run starts
  -> ensure ProviderSession
  -> ensure ProviderThread
  -> send provider turn
```

如果 Provider 支援建立空的 thread，V2 可以提早建立 Provider thread。如果不支援，Provider thread 會在第一個 run 開始時才建立。

## 開始一個 run {#starting-a-run}

使用者送出訊息時：

```text
thread.message.send
  -> ConversationMessage(role=user)
  -> Run(status=queued, ordinal=N)
  -> root ExecutionNode(kind=root_turn, countsForRun=true)
  -> enqueue provider command
```

Provider 開始執行時：

```text
provider turn accepted/started
  -> ProviderTurn allocated or correlated
  -> root node status=running
  -> run status=running
```

根節點的 Provider turn 完成時：

```text
root provider turn/completed
  -> finalize assistant streams
  -> finalize plans/todos/questions
  -> root node terminal
  -> capture checkpoint if applicable
  -> run terminal
```

只有根節點（root node）可以讓 run 完成。

:::plain 一個 run 從頭到尾
送出訊息之後，系統先記下三樣東西：這則使用者訊息、一個排隊中的 run、以及這個 run 的根節點，然後才把工作交給 Provider。Provider 真的開始跑，run 才變成執行中。Provider 的根 turn 結束之後，還要先把助理的輸出、計畫、待辦、提問都收尾，必要時擷取 checkpoint，最後 run 才算結束。run 裡面其他的子節點結束，都不會讓 run 結束。
:::

## Steer 與排隊訊息 {#steering-and-queueing-messages}

V2 應該支援三類後續輸入：

```text
steer active run in place
steer active run by restart
queue next run
```

Steer 是 app 層級的一種意圖：想要改變進行中的 run 所依循的指示。Provider 原生的 steering 只是其中一種實作策略。

如果 Provider 支援對進行中的 run 做 steering，app 就送一個 steer command 給 Provider，並讓同一個 run 繼續進行。

如果 Provider 不支援對進行中的 run 做 steering，app 會中斷進行中的 Provider turn、把被中斷的那次嘗試（attempt）收尾，然後為同一個 app 層級的 steering 意圖啟動一個替代的 Provider turn。這可以用以下兩種方式之一來表示：

- 沿用同一個 `RunId`，加上一個新的根嘗試節點（root attempt node）：適用於 UI 應該把 steering 視為「修改進行中的 run」的情況；或者
- 建立一個新的 `RunId`，用 `supersedesRunId` 連結起來：適用於「把被中斷的那次嘗試保留為一個算數的 turn」很重要的情況。

建議的預設做法是沿用同一個 `RunId` 並加上新的根嘗試節點，直到第一次嘗試已經產生了對使用者有意義的最終助理回覆或 checkpoint 為止。

排隊（queueing）則是在進行中的 run 之後建立一個新的 run。

建議的 command 形狀：

```ts
type MessageDispatchMode =
  | { type: "steer_active"; targetRunId: RunId }
  | { type: "restart_active"; targetRunId: RunId }
  | { type: "queue_after_active" }
  | { type: "start_immediately" };
```

政策：

- 如果 Provider 支援對進行中的 run 做 steering，就把 steer 送給 Provider，並把訊息附加到進行中的 run 上。
- 如果不支援，就中斷進行中的 Provider turn，並把 steering 訊息一併帶入，重新啟動進行中的 run。
- 如果使用者明確要求開一個新的 turn，即使可以 steering 也改為排隊。
- 如果沒有進行中的 run，就立刻開始。

這個模型之所以能支援這些做法，是因為 `Run` 和 `ProviderTurn` 是分開的。如果第一次嘗試為了 steering 而被中斷，一個 app run 就可能有多次 Provider turn 的嘗試。

```ts
type RunAttempt = {
  id: RunAttemptId;
  runId: RunId;
  attemptOrdinal: number;
  rootNodeId: NodeId;
  providerThreadId: ProviderThreadId;
  providerTurnId: ProviderTurnId | null;
  reason: "initial" | "steering_restart" | "retry" | "provider_recovery";
  status: "running" | "completed" | "interrupted" | "failed" | "cancelled";
};
```

只有被選定的／最後的那次嘗試會讓 run 完成，並建立這個 run 的 checkpoint。先前因為 steering 而被中斷的嘗試會留在執行圖（execution graph）裡，供稽核與除錯使用。

:::plain Steer 和排隊差在哪裡
agent 還在工作時你又送了一則訊息，有兩種意思。Steer 是「改一下現在這件事的方向」，訊息算在目前這個 run 上。排隊是「這件做完再做下一件」，會另外開一個新的 run。Provider 如果本身不能中途改方向，app 就先中斷它、再帶著新訊息重跑一次；對使用者來說仍然是同一個 run，只是底下多了一次嘗試（`RunAttempt`）。
:::

## 後續的 turn {#follow-up-turns}

一個 run 完成之後，一般的後續訊息會建立一個新的 run。

```text
previous Run completed
user sends follow-up
  -> new Run ordinal=N+1
  -> new root node
  -> same AppThread
  -> same ProviderThread if resumable
```

如果先前的 Provider thread 因為 runtime 錯誤、缺少原生狀態，或 Provider 設定不相容而無法恢復，這個 Provider thread 會被標記為無法使用，app 再用重建出來的 context 建立一個替代的 Provider thread。

這條替代路徑是錯誤復原流程，不是依 Provider 能力而分出來的分支。

## 在 run 之間更換 Provider {#changing-providers-between-runs}

更換 Provider 是一等公民的 context handoff。它不會 fork app thread，也不會改寫先前的 Provider 歷史。

```text
user selects a different provider for next run
  -> create Run with target provider
  -> resolve or create target ProviderThread
  -> create ContextHandoff if target provider thread lacks current app context
  -> inject handoff summary into provider context
  -> send user message as the new root turn
```

範例：

```text
runs 1-5: Codex provider thread C1
switch to Claude
  -> summarize runs 1-5 for Claude
  -> create Claude provider thread L1
runs 6-8: Claude provider thread L1
switch back to Codex
  -> resume Codex provider thread C1 if possible
  -> summarize runs 6-8 for Codex
  -> send run 9 to C1 with the delta handoff
```

回到某個 Provider 時，預設政策是恢復先前的 Provider thread，並且只補上「離開這個 Provider 期間」的差異（delta）。這樣可以保留該 Provider 對自己先前工作的原生連續性，同時讓它知道別處發生了什麼。

備援政策：遇到以下情況時，建立一個全新的 Provider thread，並附上整個 app thread 的摘要：

- 先前的 Provider thread 無法恢復，
- 這個 Provider 的 context 很可能已經太舊，或被反覆的 handoff 弄亂了，
- 模型／runtime 設定的變更彼此不相容，
- 使用者明確要求一個乾淨的 Provider context。

這個備援做法在圖裡應該明確呈現：

```text
new ProviderThread
  forked/reconstructed from AppThread summary
  ContextHandoff(strategy=full_thread_summary)
```

更換 Provider 時，絕對不應該在沒有記錄 handoff 的情況下，把隱藏的摘要串接到任意的 prompt 裡。Handoff 的文字是 run 輸入合約的一部分，必須可以稽核。

:::plain 換 Provider 時發生什麼事
對話（app thread）還是同一段，換掉的只是背後接手的 Provider。新的 Provider 沒看過先前的內容，所以 app 會做一份摘要交接給它，這份交接就是 `ContextHandoff`。之後如果換回原本的 Provider，預設是接回它原本那條 Provider thread，只補上它不在場那幾個 run 的摘要。重點是每一次交接都要留下紀錄，不可以偷偷塞進 prompt。
:::

## Fork Thread {#forking-threads}

Fork 是從某個來源點建立一個新的 app thread。它不應該要求先選 Provider，也不應該急著建立 Provider 的 runtime 狀態。

```text
thread.fork
  -> create target AppThread
  -> record AppThread lineage
  -> create ContextTransfer(type=fork, status=pending)
  -> no ProviderSession required
  -> no ProviderThread required
  -> no portable context handoff required
```

Fork 上的第一個 run 會解析這個待處理的 transfer：

```text
first message on fork selects provider P
  -> if source provider is P and native fork is available:
       resolve by provider-native fork
     else:
       materialize portable context
  -> create/resume target ProviderThread
  -> send resolved context + user message
```

建議第一版實作只從穩定的來源點 fork：已完成的 run、checkpoint，或是涵蓋範圍已知的閒置 Provider thread。從進行中的 run fork 時，應該使用最近一個已完成的 checkpoint，或者直接拒絕，直到「進行中 run」的語意經過審慎設計為止。

:::plain Fork 當下只記帳，不動 Provider
Fork 的那一刻，app 只做三件事：建立新的 app thread、記下它是從哪裡分出來的（lineage）、留一筆狀態為 pending 的 `ContextTransfer`。要用哪個 Provider、context 要怎麼帶過去，都等到你在 fork 上送出第一則訊息時才決定：來源和目標是同一個 Provider 而且它支援原生 fork，就用原生 fork；否則就產生一份可攜的 context。
:::

## 從 fork 合併回來（merge-back） {#merge-back-from-forks}

Merge-back 把在 fork 上探索的成果帶回來源 thread，但不會把整份 fork 的對話紀錄複製到主要的 Provider context 裡。

```text
source thread forked at point S
fork thread explores through point F
user sends next source-thread message with merge-back intent
  -> create ContextTransfer(type=merge_back, basePoint=S, sourcePoint=F)
  -> build delta context lazily
  -> inject delta with the next source-thread user message
```

這份差異（delta）應該描述 fork 點之後改變了什麼：做了哪些決定、改了哪些檔案、執行了哪些指令／測試、得到什麼結論，以及還沒解決的問題。除非有需要，它不應該包含 Provider 協定的雜訊，也不應該包含完整的對話紀錄內容。

## 中斷 {#interruption}

中斷的對象是一個 run 或一個節點。

```text
interrupt.run(RunId)
  -> resolve root node
  -> resolve provider turn/thread refs
  -> provider interrupt command if supported
  -> mark interrupt requested
```

終止狀態來自 Provider 的生命週期：

```text
provider interrupt request returns
  -> command acknowledged only
provider emits root turn/completed status=interrupted
  -> root node interrupted
  -> run interrupted
  -> checkpoint policy runs
```

App 不應該只因為中斷請求已經回傳，就把 run 標記為已終止。

如果 Provider 不支援中斷：

- 最好的情況：停止 Provider session，並依政策把 run 標記為 interrupted 或 cancelled。
- 最壞的情況：標記為不支援中斷，讓 run 維持進行中，直到 Provider 結束為止。

:::plain 按下中斷不等於已經停了
中斷請求有回應，只代表 Provider 收到了這個要求。run 要等 Provider 自己送出「根 turn 已結束，狀態是 interrupted」之後，才會被標記為已中斷，checkpoint 的政策也是在那之後才執行。
:::

## 恢復 {#resumption}

「恢復」有三個相關的意思：

1. 在 UI 裡，從已持久化的 projection 恢復一個 app thread。
2. 恢復一段 Provider 原生的對話／session。
3. 復原或重新建立一個活著的 Provider runtime 行程，同時保持 app 和 Provider thread 的連續性。

V2 一律支援從已儲存的 event／projection 恢復 app thread。恢復 Provider thread 則是 Provider adapter 必須具備的基本操作（primitive）。每一個 Provider harness 都必須提供一個 cursor／session／thread 代號（handle），可以用來恢復先前的 Provider 狀態。

Provider runtime 的復原也是核心的基本操作，不是只給測試用的 hook。以下情況都使用同一條復原路徑：

- 使用者重新啟動 app／server，所有 Provider 行程都不在了，
- 閒置 session 的回收器（reaper）刻意釋放 Provider 行程，
- Provider 行程當掉或失去網路連線，而政策允許重試。

```text
open app thread
  -> load AppThread, Runs, Messages, ExecutionGraph summary
  -> if provider work must continue, resume the relevant ProviderThread
```

Provider 恢復流程：

```text
resolve activeProviderThreadId
resolve nativeThreadRef / nativeConversationHeadRef resume cursor
start ProviderSession
provider resume
bind new ProviderSessionId to ProviderThread
```

Provider runtime 復原流程：

```text
provider runtime unavailable
  -> mark ProviderSession stopped/error with reason
  -> remove live runtime handle from ProviderSessionManager
  -> keep ProviderThread and nativeThreadRef durable
  -> on next work, open a new provider runtime
  -> resume the active ProviderThread before starting/retrying work
```

閒置清理和當機復原必須使用正式環境的生命週期 API。測試可以重新建立最外層的 layer／runtime，或是用可決定的（deterministic）時鐘和重播的 Provider transport 去驅動同一個回收器／復原服務，但不可以使用只給測試用的 session 重啟方法。

如果 Provider 恢復失敗：

- 保留歷史的圖。
- 把 Provider thread 標記為未載入或錯誤。
- 使用者繼續對話時，用重建出來的 app context 建立替代的 Provider thread。
- 把待處理的即時請求標記為無法恢復。

Provider 恢復失敗是一種 runtime／復原狀況。不應該把它建模成「Provider 不支援恢復」。

:::plain 三種「恢復」
第一種是畫面上的：重新打開一個 Thread，內容從已經存下來的紀錄讀回來，這一定做得到。第二種是接回 Provider 那邊的對話，這是每個 Provider adapter 都必須提供的能力。第三種是 Provider 的行程不在了（重開機、閒置被回收、當掉），要重新開一個行程再接回同一條 Provider thread。行程沒了不代表對話沒了：`ProviderThread` 和它的原生代號會留著，下次有工作時再接回去。
:::

## Fork {#forking}

Fork 是從一個穩定的來源，建立一個新的一等公民 `AppThread`。

支援的 fork 來源：

```ts
type ForkSource =
  | { type: "run"; threadId: ThreadId; runId: RunId }
  | { type: "node"; nodeId: NodeId }
  | {
      type: "provider_thread";
      providerThreadId: ProviderThreadId;
      providerTurnId?: ProviderTurnId;
    };
```

穩定的 fork 邊界：

- 已完成的 run
- 被中斷或失敗、但有 Provider snapshot／checkpoint 的 run
- 已完成、且帶有 Provider thread 的 subagent 節點
- Provider 回傳的 Provider thread snapshot
- checkpoint 邊界

不穩定的邊界：

- 串流中的訊息 delta
- 進行中的工具呼叫
- 待處理的核准請求
- 進行中的 subagent turn，除非明確實作了即時 fork 的支援

從 subagent fork：

```text
subagent node selected
  -> resolve ProviderThread owned by node
  -> provider fork/resume if supported
  -> create new AppThread
  -> attach forked ProviderThread
  -> copy/link checkpoint baseline
```

如果 Provider 無法 fork 原生的 thread，V2 可以用 projection 出來的訊息／context 建立一個新的 app thread，藉此合成出一個 fork，但應該透過能力（capability）把它標記為保真度較低。

## Checkpoint 的擷取 {#checkpointing}

Checkpoint 掛在 checkpoint scope 上。根 run 和子執行節點都可以做 checkpoint。

Run 開始之前的基準（baseline）：

```text
before root execution starts
  -> ensure root checkpoint for current app run ordinal - 1
```

根 run 結束之後的 checkpoint：

```text
root node terminal
  -> drain/finalize streams
  -> capture root checkpoint for app run ordinal
  -> compute diff from prior root checkpoint
  -> mark run terminal with checkpoint
```

子節點／subagent 的 checkpoint：

```text
child checkpointable node starts
  -> create child CheckpointScope under parent scope
child node terminal
  -> drain/finalize child streams/items
  -> capture child checkpoint for that scope
  -> compute diff from parent/previous child checkpoint
  -> mark child node checkpointed
```

被中斷／失敗的 run：

- 如果檔案系統的狀態有意義，而且可以安全地擷取，就擷取下來，並讓狀態反映它的終止狀態。
- 如果不是，就儲存一筆「缺少／錯誤」的 checkpoint 摘要。
- 允許子節點／subagent 的 checkpoint，但它們不會讓上層 app 的 run 計數往前推進。
- 根 run 的 checkpoint 應該包含或參照子 checkpoint 的摘要，讓這個 run 有完整的稽核軌跡。

Rollback：

```text
rollback.toRun(threadId, targetRunOrdinal)
  -> restore filesystem checkpoint targetRunOrdinal
  -> compute provider turns to roll back if provider supports rollback
  -> call provider rollback
  -> reconcile returned provider snapshot if available
  -> mark later runs rolled_back
  -> delete or mark stale later checkpoint refs
```

Codex 的 `thread/rollback` 會回傳一份具權威性的 Provider thread snapshot。其他 Provider 可能需要從 context 合成，重新啟動一個 Provider thread。

巢狀的 rollback：

```text
rollback.node(nodeId, checkpointId)
  -> restore child checkpoint if scope cwd/ref is available
  -> roll back provider thread for that child scope if supported
  -> mark descendant child checkpoints stale/rolled_back
  -> preserve parent run checkpoint history unless parent filesystem state changed
```

如果子 checkpoint 改動的是和上層相同的 workspace，還原它可能會弄髒上層 run 的 workspace 狀態。UI／API 應該把這一點明確呈現出來。

:::plain Checkpoint 分兩層
每個 run 的前後各有一個根 checkpoint，兩者相比就是這個 run 的 diff；run 的編號也是 rollback 時用來指定「回到第幾個 run」的單位。run 裡面的子節點（例如 subagent）也可以有自己的 checkpoint，但那是掛在裡面的一層，不會讓 run 的計數往前走。Rollback 除了還原檔案，也要讓 Provider 那邊的對話退回對應的位置，並把之後的 run 標記為 `rolled_back`。
:::

## 核准請求 {#approvals}

核准請求是以執行節點為範圍的 runtime request。

```text
provider requestApproval
  -> RuntimeRequest(kind=...)
  -> approval ExecutionNode
  -> thread pending request projection
  -> optional thread status waiting
```

使用者回應：

```text
approval.respond(RuntimeRequestId)
  -> resolve live provider callback
  -> send provider response
  -> RuntimeRequest resolved
  -> approval node completed/cancelled
```

規則：

- 核准請求的 id 由 app 擁有。
- Provider 的 request id 只是參照（ref）。
- 來自 subagent 的待處理核准請求，只要 Provider 提供即時回應的能力，就仍然可以處理。
- 如果 Provider 的 callback 狀態已經不在了，回應核准請求時應該以 `not_resumable` 失敗。

## 提問／使用者輸入 {#ask-questions--user-input}

Ask-questions 是一種使用者輸入請求，它本身不是計畫。

```text
provider requests user input
  -> RuntimeRequest(kind=user_input)
  -> ExecutionNode(kind=user_input_request)
  -> Question artifact
  -> run status=waiting
```

回答時：

```text
user-input.respond(RuntimeRequestId, answers)
  -> provider callback
  -> request resolved
  -> node completed
  -> run resumes/runs
```

如果 Provider 不支援結構化的提問，adapter 可以只投影出一則一般的助理訊息，而不產生可以回應的請求。

:::plain 核准和提問是同一類東西
兩者都是 Provider 在工作途中停下來等你回應，在模型裡都是一筆 `RuntimeRequest`，掛在某個執行節點上。回應要送回 Provider 還活著的那個 callback；如果那個 callback 已經不在了，回應就會以 `not_resumable` 失敗。
:::

## 計畫與待辦清單 {#plans-and-todo-lists}

V2 把三個概念分開：

- 提議的計畫（proposed plan）：一份持久的計畫 artifact，使用者可以接受／付諸實作。
- 待辦清單（todo list）：目前這個 run 的即時執行進度。
- 提問（ask questions）：結構化的使用者輸入請求。

Codex 的例子：

```text
turn/plan/updated
  -> PlanArtifact(kind=todo_list)
  -> activity/projection update

item/plan/delta or plan item completed
  -> PlanArtifact(kind=proposed_plan)

item/tool/requestUserInput
  -> PlanArtifact(kind=questions)
  -> RuntimeRequest(kind=user_input)
```

規則：

- 根 run 的待辦清單會更新主要的計畫／進度 UI。
- 子節點／subagent 的待辦清單巢狀掛在它們自己的執行節點底下。
- 子節點的計畫不會取代根計畫，除非被提升（promote）或 fork 出去。
- 實作提議的計畫時，會依使用者的操作建立一個新的 run 或一個新的 thread。

## Activity {#activities}

Activity 是執行圖 event 的一種 projection。

例子：

```text
tool.started
approval.requested
approval.resolved
plan.updated
checkpoint.captured
subagent.started
subagent.completed
runtime.warning
```

Activity 應該保留 `nodeId` 和 `runId`，讓 UI 可以正確地把它們分組。

## 完成前的關卡 {#completion-barriers}

在 run 被標記為已終止之前，V2 應該先通過一道收尾關卡（finalization barrier）：

```text
root provider turn terminal
  -> flush assistant text buffers
  -> close active assistant messages
  -> finalize plan/todo artifacts
  -> close open non-live child nodes if provider marked them done
  -> capture checkpoint
  -> publish run terminal
```

這樣可以避免太早擷取 checkpoint，也避免計畫狀態不完整。

:::plain 為什麼要有這道關卡
Provider 說「turn 結束了」的時候，手上可能還有沒送完的文字、還沒關掉的訊息、還沒定案的計畫。這道關卡規定一個固定順序：先把這些都收尾，再擷取 checkpoint，最後才對外宣布 run 已結束。
:::
