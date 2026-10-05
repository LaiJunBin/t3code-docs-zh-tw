---
title: Thread 譜系與 context transfer
nav: Thread 譜系
source: docs/orchestration-v2/thread-lineage-and-context-transfer.md
source_hash: bf2a117fec2078f7f1279243fa4b8937e7c15c2b
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

Fork、Provider 交接（handoff）、merge-back（併回）和 subagent 是各自獨立的產品功能，但它們應該共用同一套 orchestration 模型。共通的基本元素不是「fork」，也不是「摘要」，而是：

```text
thread relationship
  + source point
  + optional context transfer resolution
```

App 應該用很低的成本把譜系（lineage）保留下來；昂貴的 Provider 與上下文工作則延後處理，等到某個 run 真的需要時才解析。

:::plain 這一頁在講什麼
從一個 Thread 分出另一個、換一個 Provider 接著做、把分出去的成果帶回來、agent 自己再開子 agent，這四件事看起來不一樣，但文件主張它們是同一種東西：兩個 Thread 之間有一層關係，這層關係指向來源的某個時間點，另外可能還需要「把上下文搬過去」。關係先記下來就好，搬上下文這件貴的事，等真的要跑的時候再做。
:::

## 產品使用情境 {#product-use-cases}

### Fork 出去探索 {#fork-to-explore}

使用者把一個既有的 app thread fork 出去，探索一個岔出去的方向，而不會污染來源 Thread 的上下文。

```text
source AppThread
  -> user forks from stable source point
  -> new idle AppThread
  -> no provider chosen yet
  -> first message chooses provider/model
```

如果 fork 上的第一個 run 用的 Provider 和來源相同，而且這個 Provider 支援原生 fork，就走 Provider 原生的 fork 路徑。如果用的是不同的 Provider，就在第一次 dispatch 時把可攜的上下文（portable context）實體化。

### 在同一個 Thread 換一個 agent 繼續 {#continue-same-thread-with-a-different-agent}

使用者在同一個 app thread 上改用另一個 Provider 繼續。這不會產生新的 app thread，但它仍然是一次 context transfer（上下文轉移）。

```text
AppThread runs 1-5 with Codex
user sends run 6 with Claude
  -> resolve context transfer from Codex-backed source state to Claude
  -> start Claude provider thread with handoff context + user message
```

App thread 仍然是正規的那份對話。Provider 原生的 thread 是在背後支撐它的 handle，各自帶有明確的涵蓋範圍（coverage）。

### 把 fork 併回它的來源 {#merge-a-fork-back-into-its-source}

使用者在 fork 裡深入探索之後，把結果帶回來源 Thread。

```text
source thread at source point S
fork explores runs F1-Fn
user sends next message in source thread with "bring this back"
  -> build delta from S to fork latest stable point
  -> inject delta context with the source-thread user message
```

這不是讓來源 Thread 整個切換 Provider。它是一次有明確目標的 context transfer：從 fork 回到原本的 Thread。

### Subagent {#subagents}

Subagent 屬於同一類操作，只是建立者不同，生命週期的約定也不同。

原生 subagent：

- Provider 透過它自己的原生能力產生子代；
- app 觀察原生的子代 ref 與 event；
- 子代被建模成一個子 execution node，在有用的情況下，也會被建模成一個相關的 app 子 Thread（subthread）。

跨 Provider 的 T3 subagent：

- 父 agent 呼叫一個由 app 擁有的工具；
- app 建立一個子 app thread／run，並記下它與父代之間的關係；
- 子代的結果以「subagent 結果」這種 context transfer 的形式轉移回父代。

這套共用模型應該讓「使用者做的 fork」和「agent 建立的子 Thread」感覺是同一種圖形結構，只是 `createdBy` 和生命週期政策不同。

:::plain 四種情境，同一種形狀
Fork 是「分出一個新的 Thread」；換 Provider 是「同一個 Thread，換人接手」；merge-back 是「把分出去那邊從分岔點之後的進展帶回來」；subagent 是「由 agent 而不是使用者開出來的子 Thread」。文件要的是：這四種都用同一種紀錄來表示，差別只在是誰建立的、之後怎麼收尾。
:::

## 核心概念 {#core-concepts}

### Thread 關係 {#thread-relationship}

Thread 關係（thread relationship）描述的是：某個目標 Thread 或 run，相對於另一個 Thread，為什麼會存在。

```ts
type ThreadRelationshipKind =
  "fork" | "provider_handoff" | "merge_back" | "subagent_spawn" | "subagent_result";
```

關係屬於產品層級，而且不偏向任何 Provider。Fork 和 Provider 原生的 fork 不是同一件事。對一個 fork 關係來說，Provider 原生的 fork 只是其中一種可能的解析策略。

### 來源點 {#source-point}

來源點（source point）描述的是被轉移的那個確切狀態。

```ts
type ContextSourcePoint = {
  threadId: ThreadId;
  runId?: RunId;
  checkpointId?: CheckpointId;
  turnItemId?: TurnItemId;
  providerThreadRef?: NativeThreadRef;
  providerTurnRef?: NativeTurnRef;
};
```

穩定的來源點應該優先選已完成的 run 或 checkpoint。進行中的 run 比較難處理，因為 Provider 的 chunk 可能還在陸續送達，checkpoint 也可能還沒定案。

### Context transfer {#context-transfer}

Context transfer 是一筆持久化的操作紀錄，把來源和目標連起來。建立它的成本很低，而且可以一直維持未解析的狀態，直到第一次被用到。

```ts
type ContextTransfer = {
  id: ContextTransferId;
  type: ThreadRelationshipKind;
  sourceThreadId: ThreadId;
  targetThreadId: ThreadId;
  sourcePoint: ContextSourcePoint;
  basePoint?: ContextSourcePoint;
  sourceProvider?: ProviderKind;
  targetProvider?: ProviderKind;
  status:
    "pending" | "resolved_native" | "resolved_portable" | "failed" | "consumed" | "superseded";
  resolution?: ContextTransferResolution;
  createdBy: "user" | "agent" | "system";
  createdAt: string;
  consumedAt?: string;
};
```

`basePoint` 用在差異（delta）轉移，特別是 merge-back。以 fork 的 merge-back 來說，`basePoint` 是當初 fork 的來源點，`sourcePoint` 則是 fork 最新的穩定點。

### Context handoff {#context-handoff}

Context handoff（上下文交接）是實體化之後的上下文產物，成本昂貴。只有在原生轉移無法使用或不足以應付時，才會延後（lazily）建立。

```ts
type ContextHandoff = {
  id: ContextHandoffId;
  transferId: ContextTransferId;
  kind: "portable_context" | "delta_context" | "checkpoint_context";
  payload: PortableContextPayload;
  createdAt: string;
};
```

Context handoff 應該是可以稽核的 app 產物，而不是藏起來的 prompt 串接。

### 解析策略 {#resolution-strategy}

解析（resolution）決定目標 Provider／Thread 要用什麼方式收到來源的上下文。

```ts
type ContextTransferResolution =
  | {
      strategy: "native_fork";
      providerThreadRef: NativeThreadRef;
    }
  | {
      strategy: "portable_context";
      contextHandoffId: ContextHandoffId;
    }
  | {
      strategy: "delta_context";
      contextHandoffId: ContextHandoffId;
    }
  | {
      strategy: "checkpoint_context";
      contextHandoffId: ContextHandoffId;
    };
```

同一個 Provider 的 fork，在來源的原生 ref 夠可靠、而且 adapter 支援的情況下，應該優先用 `native_fork`。跨 Provider 的交接和 merge-back 通常需要一份 context handoff。

:::plain Transfer 和 handoff 的差別
`ContextTransfer` 是一張便宜的「待辦單」：記下從哪個 Thread 的哪個點、要帶到哪個 Thread、是哪一種關係、處理到什麼狀態。`ContextHandoff` 則是真的做出來的那包上下文，做起來貴，所以只有在 Provider 沒辦法用自己的原生方式接續時才做。解析策略就是在回答「這張待辦單最後是怎麼完成的」。
:::

## 延後解析 {#lazy-resolution}

建立 fork 的成本應該要低：

```text
thread.fork
  -> create target AppThread
  -> record thread relationship / ContextTransfer(status=pending)
  -> do not create provider session
  -> do not create provider thread
  -> do not build portable context
```

一個還在 pending 的 fork，會在第一次 dispatch 時解析它的 transfer：

```text
first run on fork chooses provider P
  -> find pending fork ContextTransfer
  -> if source provider == P and native fork is supported:
       resolve native fork
     else:
       materialize portable context
  -> create/resume provider thread
  -> send handoff/native context + user message
```

這樣就不必強迫使用者在 fork 的當下選好 agent，也不會產生可能永遠用不到的摘要。

:::plain 為什麼要延後
Fork 的當下只多了一個新的 Thread 和一筆 pending 的紀錄，沒有啟動任何 Provider，也沒有產生摘要。等使用者在 fork 上送出第一則訊息、選了 Provider，才決定是走 Provider 原生的 fork，還是做一份可攜的上下文。
:::

## Runtime 進入點 {#runtime-entry-point}

Run 啟動時應該只有一個不偏向任何 Provider 的 hook：

```ts
resolveStartContext({
  threadId,
  provider,
  message,
}): StartContextResolution
```

這個 hook 會檢查有哪些 pending 的 context transfer 以這個 Thread／run 為目標，然後選一種策略：

1. 不需要轉移：目標 Provider 已經涵蓋到目前的進度。
2. 原生轉移：Provider 相同，而且 adapter 支援原生的 fork／resume。
3. 可攜轉移：建立一份 context handoff，並注入到這個 run。
4. 差異轉移：建立 `basePoint` 到 `sourcePoint` 之間的變更。
5. 不支援：在 Provider 的工作開始之前，就明確地失敗。

原生的細節由 Provider adapter 負責。Orchestrator 負責的是關係、來源點、持久化的 transfer 紀錄，以及 command receipt。

以 Codex 來說，原生的 `thread/fork` 接受一個 `lastTurnId` 邊界，這個邊界包含該 turn 本身。當 app 的來源點是一個已完成、而且帶有原生 turn reference 的 Provider turn 時，Codex adapter 會把那個原生 id 傳過去，讓 Provider 直接在指定的點建立 fork。在分頁式（paginated）的 Codex thread 上，這是唯一可行的路徑，因為它們會拒絕 `thread/rollback`。如果沒有原生的 turn reference 可用，adapter 會退而求其次：先 fork 最新的原生狀態，再把這個 fork 往回 rollback，rollback 的數量等於在那之後已結束（terminal）的 Provider turn 數量。如果 fork 出來的 thread 使用的是分頁式歷史，adapter 會回報明確的失敗，因為這個退路在那種情況下無法成立。Orchestrator 傳的仍然是不偏向任何 Provider 的來源點，以及來源的 Provider turn 歷史；它不會把 Codex 的邊界或 rollback 政策寫進去。

同樣的分頁式歷史限制，也適用於直接的 checkpoint rollback：`thread/rollback` 只對使用舊式歷史（legacy-history）的 Codex thread 有效。V2 adapter 在 rollback 之前會先探測 `historyMode`，遇到分頁式 thread 就明確地失敗，而不是送出一個 Codex 會拒絕的請求。分頁式的對應做法（對 `thread/turns/list` 逐頁查詢，找到第一個被移除的 turn，再用 `beforeTurnId` 呼叫 `thread/revert`）還沒有實作。

:::plain 誰負責什麼
每個 run 開始前都經過同一個關卡，由它判斷「這個 Provider 需不需要先補上下文、要怎麼補」。Orchestrator 只管「從哪裡帶到哪裡」這些不分 Provider 的事；像 Codex 的 fork 要傳哪個 id、能不能 rollback 這類細節，都留在 adapter 裡。行不通的時候要明確失敗，不要送出一個注定被拒絕的請求。
:::

## 資料的所有權 {#data-ownership}

`AppThread` 應該存放輕量的、供瀏覽用的譜系：

```ts
type AppThreadLineage = {
  parentThreadId: ThreadId | null;
  relationshipToParent: "fork" | "subagent" | null;
  rootThreadId: ThreadId;
};
```

操作層面的轉移細節應該放在 `ContextTransfer`，不要直接放在 `AppThread` 上，因為一個 Thread 可能參與很多次轉移：

- 由 fork 建立；
- 之後切換到另一個 Provider；
- 之後併回它的來源；
- 之後又產生 subagent。

## Checkpoint 與進行中 run 的政策 {#checkpoint-and-active-run-policy}

第一版實作應該優先使用穩定的來源點：

- 已完成 run 的 checkpoint；
- 明確指定的 checkpoint；
- 涵蓋範圍已知的閒置 Provider thread。

從進行中的 run 做 fork 或交接時，應該二選一：

- 使用最新一個已完成的 checkpoint，或
- 直接拒絕，直到進行中 run 的語意設計好為止。

不要悄悄地從串流到一半的 Provider 狀態做 fork。那會削弱關聯（correlation），也會讓 replay 和復原變得困難。

:::plain 只從「站穩的點」分出去
來源點要選已經塵埃落定的狀態，例如跑完的 run 所留下的 checkpoint。如果來源還在跑，要嘛退回最近一個完成的 checkpoint，要嘛直接拒絕，不可以拿 Provider 講到一半的內容當起點。
:::

## 目前的實作邊界 {#current-implementation-boundary}

後端的第一個切片（slice）實作的是「同一個 Provider 的 fork 延後解析」：

- `thread.fork` 建立一個目標 app thread，帶有 fork 譜系和一筆 pending 的 `ContextTransfer`。
- `thread.fork` 不會建立 Provider session、Provider thread、Provider turn，也不會建立可攜的上下文產物。
- Fork 上的第一次 dispatch 會解析那筆 pending 的 transfer。對於原生 ref 夠可靠、而且支援 `thread/fork` 的 Codex 對 Codex fork，orchestrator 會走 Provider 原生的 fork 路徑，並依序記錄 `resolved_native` 和 `consumed`。
- 跨 Provider 的 fork transfer，或是因為其他原因無法走原生路徑的 fork transfer，會在目標 Thread 第一次 dispatch 時，延後實體化一份可攜的 `ContextHandoff`。
- 明確指定 run／checkpoint 的 fork，如果來源 run 還在進行中，會被拒絕；`latest_stable` 則會解析成最新一個已完成且有 checkpoint 的 run。

這讓 runtime 與架構保持一致，同時透過 `ContextTransfer` 和 `ContextHandoff` 紀錄，讓可攜的上下文變得明確而且可以稽核。

## 與切換 Provider 的關係 {#relationship-to-provider-switching}

切換 Provider 是一種 context transfer，其中 `sourceThreadId === targetThreadId`，而且目標 Provider 與目前使用中的 Provider 不同。

回到先前用過的 Provider 也是一種 context transfer，通常是一份差異：從那個 Provider 最後涵蓋到的 run 範圍，到 app thread 目前所在的點。

[切換 Provider 與 context handoff](./provider-switching-and-context.md) 這份文件說明的是那一項功能的策略選擇。本文件定義的則是更廣的模型，由切換 Provider、fork、merge-back 和 subagent 共用。
