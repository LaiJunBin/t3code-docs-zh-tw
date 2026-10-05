---
title: 切換 Provider 與 context handoff
nav: 切換 Provider
source: docs/orchestration-v2/provider-switching-and-context.md
source_hash: 17515dda213363daa6cc7f37051b700f2cb8ce69
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

切換 Provider 是 V2 的一級功能。一個 app thread 可以包含來自多個 Provider 的 run，同時保留每個 Provider 的原生對話 handle，以及 app 自己那份正規的對話歷史。

這份文件說明的是更廣的 [Thread 譜系與 context transfer](./thread-lineage-and-context-transfer.md) 模型在「切換 Provider」這個情境下的特化版本。切換 Provider 是一種 context transfer（上下文轉移），其中來源與目標的 app thread 通常是同一個。Fork、merge-back（併回）和 subagent 用的是同一套來源點（source point）／解析（resolution）概念，只是產品上的生命週期不同。

:::plain 先對一下名詞
App thread 就是使用者看到的那段對話；run 是其中算數的一個回合，也就是術語表裡說的 turn。Provider thread 則是某個 Provider 自己那邊的原生對話。這一頁要講的是：同一段對話中途換 Provider 時，app 這邊的對話不變，變的是背後接了哪一個 Provider thread，以及要補給它多少上下文。
:::

## 建議做法 {#recommendation}

回到先前用過的 Provider 時，預設做法是 resume 那個 Provider 先前的 Provider thread，並注入一份差異摘要（delta summary），涵蓋這個 Provider 不在場期間發生的那些 run。

只有在以下情況，才建立一個全新的 Provider thread 並附上整個 app thread 的完整摘要：resume 先前的 Provider thread 失敗、設定不相容，或是差異交接很可能產生品質不好的上下文。

這是最好的預設取捨：

- 保留 Provider 自己先前工作的原生連續性，
- 避免一再重新摘要所有內容，
- 讓每個 Provider 保有它自己的工具／歷史機制，
- 讓跨 Provider 的上下文明確而且可以稽核，
- 當舊的 Provider 上下文過時的時候，仍然有一條乾淨的退路。

## 範例 {#example}

```text
runs 1-5: Codex, ProviderThread C1
switch to Claude for run 6
  -> ContextHandoff H1 covers runs 1-5
  -> create ProviderThread L1
  -> run 6 uses L1 with H1
runs 6-8: Claude, ProviderThread L1
switch back to Codex for run 9
  -> ContextHandoff H2 covers runs 6-8
  -> resume ProviderThread C1
  -> run 9 uses C1 with H2
```

ProviderThread C1 並不被期待原生地包含 Claude 的那些 run。它包含的是 Codex 的原生對話，再加上明確的 handoff 產物，用來摘要外部的進展。

:::plain 換回來的時候發生什麼事
回到用過的 Provider 時，接回它原本那段原生對話，再補一份「你不在的這幾個 run 發生了什麼」的摘要。以上面的範例來說，Codex 回來時接回 C1，並收到涵蓋 run 6 到 8 的 H2。只有接不回去、設定不相容，或是補差異的效果可能很差時，才開一個全新的 Provider thread 並給它整段對話的摘要。
:::

## 為什麼不乾脆每次都開新的 Provider thread？ {#why-not-always-create-a-fresh-provider-thread}

每次都建立全新的 Provider thread 比較簡單，但會失去有用的 Provider 原生連續性：

- 只存在於 Provider thread 裡的先前隱藏推理／上下文，
- Provider 端的 thread metadata，
- 原生的工具狀態（在有提供的情況下），
- Provider 專屬行為的連續性。

這也會迫使每一次切換都取決於完整摘要的品質。完整摘要是有用的退路產物，但在可以安全 resume 先前 Provider thread 的情況下，它不應該是預設做法。

## 為什麼不能不附摘要就 resume？ {#why-not-resume-without-summary}

因為 Provider 不在場的期間，app thread 已經往前走了。被 resume 的 Provider 不會知道另一個 Provider 做了什麼。這會造成錯誤的回答、過時的計畫，以及對檔案狀態的不安全假設。

回到某個 Provider 時必須附上 handoff 摘要，除非從它上次參與之後沒有發生過任何 run。

## Provider thread 的涵蓋範圍 {#provider-thread-coverage}

Provider thread 有原生涵蓋範圍（native coverage）和 handoff 涵蓋範圍（handoff coverage）。

```ts
type ProviderThreadCoverage = {
  providerThreadId: ProviderThreadId;
  nativeRunOrdinals: number[];
  handoffIds: ContextHandoffId[];
};
```

以上面的範例來說：

```text
C1 native runs: 1,2,3,4,5,9
C1 handoffs: H2 covering 6-8

L1 native runs: 6,7,8
L1 handoffs: H1 covering 1-5
```

App thread 仍然是完整歷史的唯一事實來源（source of truth）。

:::plain 涵蓋範圍是什麼
每個 Provider thread 知道的事分成兩種：它自己親自跑過的 run（原生涵蓋），以及透過 handoff 摘要得知的 run（handoff 涵蓋）。兩種加起來，才知道這個 Provider thread 目前還缺哪一段。完整的紀錄永遠以 app thread 為準。
:::

## Handoff 產物 {#handoff-artifact}

Handoff 是明確的圖資料（graph data）。在更廣的模型裡，`ContextTransfer` 記錄來源、目標、關係類型和解析狀態。`ContextHandoff` 則是實體化之後的可攜上下文產物，在轉移無法靠 Provider 的原生連續性來滿足時使用。

```ts
type ContextHandoff = {
  id: ContextHandoffId;
  transferId: ContextTransferId;
  threadId: ThreadId;
  targetRunId: RunId;
  fromProviderThreadIds: ProviderThreadId[];
  toProviderThreadId: ProviderThreadId;
  coveredRunOrdinals: { from: number; to: number };
  strategy:
    | "delta_since_target_last_seen"
    | "full_thread_summary"
    | "checkpoint_summary"
    | "manual_context";
  summaryText: string;
  status: "pending" | "ready" | "failed" | "superseded";
  createdByProvider: ProviderKind | null;
  createdAt: string;
  updatedAt: string;
};
```

Handoff 應該連結到使用它的那個 run。如果同一份摘要被重新產生，舊的 handoff 會被標成 superseded（已被取代），而不是在看不見的地方被改掉。

## 切換流程 {#switch-flow}

```text
start run with target provider P
  -> find current app thread history
  -> find best ProviderThread for P
  -> decide handoff strategy
  -> generate ContextHandoff if needed
  -> ensure ProviderSession for P
  -> ensure/resume/create target ProviderThread
  -> send provider turn with handoff context + user message
```

使用者的訊息仍然是這個 run 真正的輸入。Handoff 上下文則是另外一段前置內容，依 Provider 的能力而定，可能以 preamble、system、developer 或合成的 user 上下文的形式送出。

## 策略選擇 {#strategy-selection}

建議的策略順序：

1. 不需要 handoff：目標 Provider thread 已經涵蓋到 app 目前的 run。
2. 對既有的 Provider thread 做差異 handoff：目標 Provider thread 可以 resume，而且只錯過一段 run 範圍。
3. 對既有的 Provider thread 做整個 Thread 的 handoff：目標 Provider 可以 resume，但差異鏈太複雜。
4. 對新的 Provider thread 做整個 Thread 的 handoff：目標 Provider 的 resume 失敗、設定不相容，或舊的上下文已經過時。
5. 不支援：Provider 無法接受 handoff 上下文，而且沒有安全的重建路徑。

:::plain 由省到貴的順序
能不補就不補；要補就先試「只補缺的那一段」；差異一層疊一層太亂的話，改成補整段摘要；連原本的 Provider thread 都接不回去，就開新的再補整段。全部都行不通時，要明確說不支援。
:::

## 過時判定政策 {#staleness-policy}

App 應該要能夠判斷：回到某個舊的 Provider thread 已經不再合適。

可能的過時訊號：

- 上次使用之後，在其他 Provider 上跑的 run 太多，
- 串接的 handoff 太多，
- 目標 Provider 的模型／runtime mode 有不相容的變更，
- Provider thread 的 resume 失敗，
- 先前的 Provider thread 被 rollback，或以互相衝突的方式被 fork，
- 使用者選了「clean context」，
- handoff 摘要會超過 Provider 的上下文政策。

判定為過時的時候，就用 `full_thread_summary` 建立一個新的 Provider thread。

## 摘要的來源 {#summarization-source}

摘要可以由以下任一者產生：

- 被離開的那個 Provider，
- 要進入的那個 Provider，
- 另外設定的摘要用 Provider，
- 針對結構化產物的本機決定性摘要器（deterministic summarizer）。

產生摘要的不一定是目標 Provider。Handoff 會記錄 `createdByProvider`，之後才能檢視品質和出處。

## 摘要應該包含什麼 {#what-the-summary-should-contain}

摘要應該以 app thread 為正規依據，而不是只根據 Provider 的對話紀錄（transcript）。

要包含：

- 使用者的目標與限制，
- 已經做出的決定，
- 變更過的檔案，
- 執行過的指令／測試，
- 計畫／待辦狀態，
- 尚未解決的核准請求／問題，
- 目前的 checkpoint／diff 摘要，
- 已知的失敗，
- 相關的 subagent 結果。

不要包含：

- 無關的 Provider 協定雜訊，
- 隱藏的思考鏈（chain-of-thought），
- 已經被後續 run 取代的過時工具輸出，
- 大型的 diff（只要檔案摘要就夠的時候）。

:::plain 摘要是寫給下一個接手的人看的
摘要要從整段對話的角度來寫：使用者要什麼、已經決定了什麼、動過哪些檔案、跑過哪些指令和測試、還有什麼沒解決。無關的 Provider 協定雜訊、已經被後面的 run 取代的舊工具輸出，都不要放進去。
:::

## 與 checkpoint 的互動 {#checkpoint-interaction}

切換 Provider 不會改變 checkpoint 的所有權。Checkpoint 仍然附著在 app run 上。

不過，產生 handoff 時應該參照最新的 checkpoint 和 diff 摘要，這樣下一個 Provider 才會對 workspace 的狀態有正確的認識。

```text
run N completed
  -> checkpoint N captured
switch provider for run N+1
  -> handoff includes summary through checkpoint N
```

## 與 rollback 的互動 {#rollback-interaction}

Rollback 會讓涵蓋到「被 rollback 的 run」的 handoff 失效。

```text
rollback to run 5
  -> runs 6+ marked rolled_back
  -> handoffs covering 6+ marked superseded
  -> provider threads whose native/handoff coverage includes 6+ marked divergent or rolled back by capability
```

如果使用中的 Provider 支援 Provider rollback，就呼叫它。否則，等工作繼續的時候，從保留下來的 app thread 摘要建立一個新的 Provider thread。

## 與 fork 的互動 {#forking-interaction}

從一個混用多個 Provider 的 app thread 做 fork 時，應該記錄 app thread 的譜系（lineage）和一個來源點，而不需要在 fork 的當下選擇 Provider。Provider 上下文會延後解析，等到 fork 上的第一個 run 開始時才處理。

例子：

- 從 Codex 上的 run 5 做 fork，fork 的第一個 run 用 Codex：如果來源的 ref 夠可靠，優先使用 Codex 原生 fork。
- 從 Codex 上的 run 5 做 fork，fork 的第一個 run 用 Claude：在第一次 dispatch 時延後建立可攜的上下文。
- 從沒有 Provider 原生 thread 的 app checkpoint 做 fork：用 checkpoint／整個 Thread 的上下文建立目標 Provider thread。
- 從 subagent 的 Provider thread 做 fork：如果它是穩定的，就直接使用 subagent 的 Provider thread，否則退回使用可攜的上下文。

:::plain Checkpoint、rollback、fork 各自的影響
Checkpoint 還是跟著 app 的 run 走，不因為換 Provider 而改變歸屬；只是做摘要時要把最新的 checkpoint 和 diff 摘要帶進去。Rollback 之後，涵蓋到被退掉那幾個 run 的 handoff 就作廢。Fork 的當下不用選 Provider，等 fork 上第一個 run 開始才決定上下文怎麼來。
:::

## 資料模型的變更 {#data-model-changes}

切換 Provider 需要：

- `Run.provider`
- `Run.providerThreadId`
- `Run.contextHandoffId`
- `ContextTransfer`
- `ProviderThread.firstRunOrdinal`
- `ProviderThread.lastRunOrdinal`
- `ProviderThread.handoffIds`
- `ContextHandoff`
- 用來表示是否支援 handoff 的 Provider capability

App 不需要為了切換 Provider 而另外開對話 Thread。它需要的是讓多個 Provider thread 附著在同一個 app thread 上。
