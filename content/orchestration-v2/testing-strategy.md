---
title: 測試策略
source: docs/orchestration-v2/testing-strategy.md
source_hash: f6fb27ab931ca8be27374b9d4e3f859ae81be3f7
---

:::warning 這是目標架構的設計文件
這一頁描述的是 orchestration 的目標設計，不一定等於目前程式碼的實際行為。原文刻意不討論遷移與向後相容。
:::

V2 應該用少量高價值的整合測試來驗證，而不是用一大套單元測試，把正要測的行為都 mock 掉。

目標並不是「完全不用測試替身（test double）」。目標是：測試替身只出現在真正的行程、網路、時鐘、id 和檔案系統邊界上。核心的 orchestration 行為必須真的執行。

## 測試原則 {#testing-principle}

V2 測試的預設形態是：

```text
command dispatch
  -> real Orchestrator
  -> real ProviderAdapter
  -> replayed ProviderRuntime transport
  -> real adapter normalizer
  -> real V2 event store/sink using production persistence semantics
  -> real V2 projection/projector
  -> real Checkpoint policy
  -> assertions
```

Replay 框架取代的是外部的 Provider 行程或網路串流。它不取代 adapter、normalizer、command／event 基礎設施、projection reducer／projector、checkpoint 政策，也不取代商業邏輯。

Replay transcript（錄製下來的紀錄）裡的原始 Provider frame，是貼近真實的 transport 證據。在正式環境裡，對等的原始 frame 是診斷用的 log 資料，保留期限有上限。整合測試仍然應該使用真正的、正規化之後的 orchestration 持久化與 projection，這樣 replay 的輸入走過的 adapter 與 orchestration 路徑，才會和即時的 Provider 輸出相同。

:::plain 只換掉最外面那一層
測試時唯一被換掉的，是「跟 Provider 行程或網路講話」的那一層：改成照著事先錄好的紀錄重播。從 adapter 往內的每一層，包括 orchestrator、event 儲存、projection、checkpoint 政策，都用真的程式跑。
:::

## 允許的測試替代品 {#allowed-test-substitutes}

允許的替代品：

- Provider runtime transport，由決定性的 replay transcript 支撐。
- Effect runtime 的時間，在測試中用 `effect/testing` 的 `TestClock` 控制。
- Effect 的 `Random`，提供一個決定性的測試實作，讓 UUID／數字保持穩定。
- 暫時的檔案系統／worktree。
- 暫時的資料庫，或是具有相同 repository 介面的記憶體內資料庫。
- 假的 process supervisor，只在直接測試行程失敗行為的時候使用。

整合測試中不允許：

- mock 的 orchestrator。
- mock 的 Provider adapter。
- mock 的 Provider event normalizer。
- mock 的 command／event 基礎設施或 V2 event sink。
- mock 的 projection reducer。
- mock 的 checkpoint service 行為。
- mock 的 Provider capability 政策。
- 把預先正規化好的 domain event 當成 adapter 測試的輸入。
- 自訂的時鐘／id 服務，重複了 Effect 的 `Clock`、`DateTime` 或 `Random` 服務已經做的事。

純 reducer 測試仍然有效，但數量應該少，而且有明確的對象。它們應該直接測試 projection 的不變條件（invariant），而不是用來取代整合測試的涵蓋範圍。

正式環境的程式碼應該透過 Effect runtime 的 API 讀取時間，例如 `DateTime.now` 和 `Clock.currentTimeMillis`，而不是透過 `Date.now` 或臨時寫的包裝函式。正式環境的程式碼應該透過 `effect/Random` 取得隨機值，而不是直接用 `crypto.randomUUID`、`Math.random`，或自訂的全域 id 產生器。

測試應該提供 Effect 的測試服務：

```ts
import { TestClock } from "effect/testing";
```

Id 配置器仍然可以提供領域專屬的輔助函式，例如 `newRunId` 或 `newNodeId`，但這些輔助函式應該建立在 `Random` 之上，這樣測試用的 layer 就能產生決定性的值，而不必 mock orchestration 邏輯。

:::plain 能換和不能換的界線
時間、亂數、檔案系統、資料庫、Provider 的傳輸層，這些屬於「外部世界」，可以換成受控制的版本。Orchestrator、adapter、normalizer、projection、checkpoint 這些是要被測的對象，不可以 mock。也因為這樣，正式的程式碼要透過 Effect 提供的服務取得時間和亂數，測試才有辦法把它們換成固定的值。
:::

## 通用的 replay runtime {#generic-replay-runtime}

Replay 必須不偏向任何 Provider。Codex 的 NDJSON fixture 只是某一個 Provider 的 transcript 格式，不是框架本身。

```ts
type ProviderReplayTranscript = {
  provider: ProviderKind;
  protocol: string;
  version: string;
  scenario: string;
  entries: ProviderReplayEntry[];
};

type ProviderReplayEntry =
  | {
      type: "expect_outbound";
      label?: string;
      frame: unknown;
    }
  | {
      type: "emit_inbound";
      label?: string;
      frame: unknown;
      afterMs?: number;
    }
  | {
      type: "runtime_exit";
      status: "success" | "error" | "cancelled";
      error?: unknown;
    };
```

Replay runtime 負責決定性的 transport 語意：

- 依序送出 inbound event。
- 對 outbound command 做斷言。
- 暫停／繼續，以及時間控制。
- 模擬 runtime 結束／錯誤。
- resume cursor／session 的還原。
- transcript metadata 的驗證。

Replay runtime 不可以知道 turn、plan、approval、subagent 或 checkpoint 是什麼意思。Provider 專屬的 frame 由 Provider adapter 來解讀。

復原測試只在 Provider transport 邊界使用 replay。App 重新啟動的測試方式，是把最外層的 orchestrator／server layer 拆掉，再對著持久化的資料重新建立。閒置清理和當機復原，則透過正式環境的生命週期服務來測試，例如 session reaper 或 runtime 復原政策。測試不可以在 adapter 或 orchestrator 上新增「只為了讓斷言能重啟 session」的方法。

:::plain Replay runtime 只懂「收」和「送」
一份 transcript 就是一串依序排好的紀錄：這裡預期 app 會送出什麼、這裡要假裝 Provider 送進來什麼、最後 runtime 怎麼結束。Replay runtime 只管照順序播放和核對，它不懂這些內容代表 turn 還是核准請求；那是 adapter 的工作。
:::

## 各 Provider 的 transcript 格式 {#provider-transcript-formats}

每個 Provider 都可以在通用的 replay 外層格式（envelope）裡，使用自己的原始 frame 格式。

例子：

```text
Codex replay transcript
  -> JSON-RPC app-server requests/responses/notifications
  -> consumed by CodexAdapter

Claude replay transcript
  -> Claude Agent SDK query() outbound options and yielded SDKMessage chunks
  -> consumed by ClaudeAdapter

Cursor replay transcript
  -> Cursor Agent SDK open/send calls and ordered onDelta/run results
  -> consumed by CursorAdapter

OpenCode replay transcript
  -> OpenCode SDK requests/responses plus ordered SSE events
  -> consumed by OpenCodeAdapter

ACP replay transcript
  -> logical JSON-RPC requests/responses/notifications over a strict NDJSON peer
  -> consumed by AcpAdapter and a provider flavor (Grok or ACP Registry)
```

Fixture 應該盡可能原樣保留 Provider 的原始證據。預期的 V2 event 或 projection 是斷言，不是 fixture 的輸入。

以 Claude 來說，一開始的 replay 邊界是 Agent SDK 的 `query()` 呼叫所回傳的 async iterable。Transcript 應該包含我們送出的 `query` prompt／options，然後依 Provider 的順序重播原始的 `SDKMessage` chunk。這是刻意要拿真實的 Claude SDK 輸出來測試 V2 adapter；它不測試 SDK 自己的子行程或 transport parser。

ACP 的 fixture 是對著一個子行程 replay peer 執行，這個 peer 會驗證每一個 outbound frame，並送出錄好的 inbound frame。這只取代外部的 ACP driver transport；共用的 runtime、adapter 的正規化、orchestration、持久化和 projection 仍然是正式環境的程式碼。通用的 ACP Registry harness 會把符合協定標準的 ACP transcript 重新指向（retarget）；Provider 擴充的 transcript 則維持只限於擁有該擴充的 flavor。

OpenCode 的 fixture 在 HTTP／SSE 邊界上取代 SDK client。它們必須保留「請求的回應」和「SSE event」之間的競態（race），因為使用者訊息和終結的 `session.status` event，可能比對應的 `promptAsync` 或 `abort` 回應更早到達。Subagent 的 fixture 必須同時保留父與子的 session id，這樣「只有 root 才算終結」的行為才測得到。

Provider transcript 的錄製工具放在 server 的 orchestration testkit 裡，而不是放在各 Provider 的 client 套件裡。Codex app-server 的 transcript 用 `bun run record:codex-replay -- --scenario <name>` 錄製，Claude Agent SDK 的 transcript 用 `bun run record:claude-replay -- --scenario <name>` 錄製。Cursor Agent SDK 的 transcript 用 `pnpm --filter t3 record:cursor-replay --scenario <name>` 錄製。

## Contract 測試的層級 {#contract-test-levels}

建議的層級：

1. V2 contract 的 schema 測試。
2. 針對硬性不變條件的純 projection 測試。
3. Provider adapter 的 replay 測試：從原始 transcript 到 V2 domain event。
4. 完整的 orchestration 整合測試：從 command 經過 replay runtime 到最終的 projection。

第四層是最重要的一層。就是這種測試，才抓得到生命週期對不上的問題，例如子 turn 把父 run 關掉，或是 checkpoint 太早被擷取。

## 最初的十個整合測試 {#first-ten-integration-tests}

V2 應該從大約十個扎實的測試開始：

1. `simple`：送出一則訊息，會建立一個 run、一個 root node、一個 Provider turn、一則 assistant 回應，以及一個 root checkpoint。
2. `multi_turn`：後續的訊息會在同一個 app thread 上建立順序單調遞增的 app run。
3. `message_steering`：steering 會附加到進行中 run 的意圖上，而不是變成一個不相干的 run。
4. `turn_interrupt`：interrupt 得到確認（acknowledgement）並不會讓 run 完成，要等 Provider 的終結 event 到達才算。
5. `steering_restart_fallback`：沒有原生 steering 的 Provider，會中斷進行中的 attempt，並在同一個 run 底下建立一個替代的 attempt。
6. `subagent`：子 Provider turn 會建立巢狀的 execution node，而且絕對不會讓父 run 完成。
7. `subagent_checkpoint`：子代／subagent 的 node 會建立巢狀的 checkpoint scope，但不會讓 app 的 run 計數往前推進。
8. `thread_rollback`：rollback 以 checkpoint scope 為目標，並與 Provider rollback 的 snapshot 進行對帳（reconcile）。
9. `approval_request`：Provider 的核准 callback 會變成持久化的 runtime request，並透過真正的 adapter 路徑解決。
10. `provider_switch_return`：從某個 Provider 切走會建立一份 context handoff；切回來時則 resume 先前的 Provider thread，並附上一份差異（delta）handoff。

只有在能保護一個新的不變條件，或是能重現一個真實的失敗模式時，才應該增加額外的測試。

:::plain 為什麼是「少量但完整」
文件把測試分成四層，其中最看重第四層：從 command 一路跑到最後的 projection。理由是有些錯只有整條路跑過才看得出來，例如子 turn 結束卻把父 run 也關掉。所以起步只要大約十個這種完整的測試，之後每加一個，都要說得出它保護了哪條規則或重現了哪個真實的問題。
:::

## Fixture 規則 {#fixture-rules}

- Fixture 是原始的 Provider transcript，不是 mock 出來的 domain event。
- Fixture 應該包含足夠的 outbound 預期，足以證明 app 送出了正確的 Provider command。
- Fixture 應該包含協定 metadata、Provider 版本、模型、cwd 政策，以及擷取時的時間戳記。
- Fixture 的重播在 Effect `TestClock` 和決定性的 `Random` layer 之下，必須是決定性的。
- 當 Provider transcript 是從真實的執行產生時，要保留 Provider frame 原本的順序。
- 遮蔽敏感資料（redaction）時，應該保留 id、方法名稱、生命週期順序，以及關聯結構。
- Fixture transcript 是測試輸入，也是診斷用的證據。這不代表正式環境會把所有原始的 Provider frame 存進 SQLite。

## 斷言 {#assertions}

斷言應該優先針對最終的 projection 和持久化、正規化之後的 orchestration event，而不是實作上碰巧發生的呼叫。

好的斷言：

- 重複 dispatch 同一個 command，會回傳原本的 receipt sequence，而不會重播 Provider transport。
- 已儲存 event 的 sequence 單調遞增。
- snapshot 的 sequence，加上「從某個 sequence 之後開始串流」的行為。
- run 的狀態與 ordinal。
- 進行中／最終的 run attempt。
- execution node 的父／子結構。
- Provider thread 與 Provider turn 的關聯。
- checkpoint scope 的階層。
- pending／已解決的 runtime request。
- handoff 的涵蓋範圍與策略。
- replay transcript 的 frame 數量，以及正規化後的 event 數量（在相關的時候）。

薄弱的斷言：

- 內部函式確切被呼叫了幾次。
- 私有輔助函式的呼叫順序。
- adapter／runtime 邊界以下，mock callback 收到的引數。

:::plain 驗結果，不驗過程
要檢查的是最後留下來的東西：projection 長什麼樣、存了哪些 event、順序對不對。至於內部某個函式被呼叫幾次、先後順序如何，這類檢查很薄弱，不該當成主要的斷言。
:::

## 實作順序 {#implementation-order}

測試基礎設施應該在改寫正式環境程式碼之前就先建好：

1. V2 contract schema。
2. Effect service 定義。
3. Provider runtime transport 的抽象層。
4. 通用的 replay runtime。
5. Codex、Claude、Cursor、OpenCode 和 ACP 的 transcript loader，用於由 app 擁有的 Provider replay fixture。
6. 針對核心不變條件的 projection reducer 測試。
7. 完整的 command 到 projection 整合測試。
8. 正式環境的 layer。

這樣做可以讓架構在建造的過程中就一直是可以執行的，也避免測試只驗證到簡化過的 mock。
