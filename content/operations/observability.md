---
title: 可觀測性（Observability）
nav: 可觀測性
source: docs/operations/observability.md
source_hash: b83a9015abb2286313a06a702aa7b6416f84292b
---

> 這一頁是寫給維護者的。如果你是 T3 Code 的使用者，請看 [docs/user](../user/)。

T3 Code 在 server 端只有一套可觀測性模型：

- 排版過、方便閱讀的 log 輸出到 stdout，給人看
- 已完成的 span 寫進本機的 NDJSON trace 檔
- trace、metrics 和 log 也可以透過 OTLP 匯出到真正的後端，例如 Grafana LGTM

一般的本機啟動方式下，本機 trace 檔就是持久化的唯一事實來源（source of truth）。這類啟動不會另外寫一份 server log 檔；不過由 SSH 管理的啟動，還會把遠端行程的 stdout/stderr 保存在 `~/.t3/ssh-launch/<state>/server.log`。

## 東西在哪裡找 {#where-to-find-things}

### Log {#logs}

Log 是給人看的：

- 輸出位置：stdout
- 格式：`Logger.consolePretty()`
- 一般本機啟動的持久化：無
- SSH 管理的啟動的持久化：`~/.t3/ssh-launch/<state>/server.log`
- 遠端匯出：只走 OTLP，而且要有設定才會匯出

如果你希望某則 log 訊息出現在 trace 檔裡，請在一個作用中的 span 裡面用 `Effect.log...` 送出。`Logger.tracerLogger` 會把它掛成一個 span event。

一旦設定了 logs endpoint，這件事就改由它接手。這時 server 會匯出 log record：它涵蓋每一則訊息，而不只是作用中 span 裡面的那些，並且帶有 trace id 和 span id，所以仍然能和 trace 對得起來。在這個模式下 `Logger.tracerLogger` 會被拿掉，所以同一則訊息不會被匯出兩次，trace 檔也不再帶有 log 訊息。不論哪一種模式，stdout 的輸出和 SSH 管理的啟動的持久化都維持不變。

:::plain log 訊息最後會出現在哪裡
沒有設定 logs endpoint 時：寫在 span 裡面的 log 會變成 span event，跟著 span 一起進 trace 檔；寫在 span 外面的 log 只會出現在 stdout。

有設定 logs endpoint 時：所有 log 都改用 log record 匯出到後端，trace 檔裡就不會再有 log 訊息，stdout 則照常輸出。所以開了 OTLP logs 之後，在本機 trace 檔裡找不到 log 是正常的。
:::

### Trace {#traces}

已完成的 span 會以 NDJSON record 的形式寫到 `serverTracePath`。預設路徑取決於 server 的啟動方式：正式環境和明確指定 home 的情況使用 `<home>/userdata/logs/server.trace.ndjson`（所以預設是 `~/.t3/userdata/...`，加上 `--home-dir /custom/path` 時則是 `/custom/path/userdata/...`）；在 linked worktree 裡執行的開發版使用 `<worktree>/.t3/userdata/logs/server.trace.ndjson`；不在 linked worktree 裡、也沒有明確指定 home 的開發版使用 `~/.t3/dev/logs/server.trace.ndjson`。

兩種 record 類型共通的重要欄位：

- `type`：`effect-span` 或 `otlp-span`
- `name`：span 名稱
- `traceId`、`spanId`、`parentSpanId`：用來互相關聯
- `durationMs`：經過的時間
- `attributes`：結構化的上下文
- `events`：內嵌的 log 和自訂 event

`effect-span` record 另外帶有 `exit`，值是 `Success`、`Failure` 或 `Interrupted`。`otlp-span` record 帶的則是 OTLP 的 resource、scope，以及選擇性的 status 欄位。

`TraceRecord`、`EffectTraceRecord` 和 `OtlpTraceRecord` 這幾個 schema 放在 `packages/shared/src/observability.ts`。

DPoP proof 驗證失敗時，span 上會帶有可以安全公開的 `environment.dpop.failure_code` 屬性。`time_window` 失敗代表某個已簽署的 proof 太舊，或是時間超前太多，落在 environment server 允許的時間範圍之外。這可能表示其中一台裝置的日期或時間有問題，但也可能只是 request 被延遲了。

#### 彙總 trace 檔 {#summarize-the-trace-file}

`t3 trace summary` 會直接讀取 trace 檔和它輪替出來的備份檔，所以 server 卡住或停止時也能用。它會依 span 名稱印出次數、頻率和延遲的百分位數。可以用它來量測背景工作，或是比較兩個 build。

```bash
t3 trace summary --since 30m --limit 40
```

如果有設定 `T3CODE_TRACE_FILE`，它就讀那個檔案；否則依 `--base-dir` 或 `T3CODE_HOME` 讀取 `<home>/userdata/logs/server.trace.ndjson`，再加上 `T3CODE_TRACE_MAX_FILES` 個輪替備份檔。如果是開發版，或是複製出來的檔案，請設定 `T3CODE_TRACE_FILE`。`--since 30m` 會保留最近 30 分鐘內結束的 span。頻率是以第一個和最後一個 span 結束時間之間的區間，換算成每分鐘的次數。

### Metrics {#metrics}

Metrics 不會寫到本機檔案。

- 本機持久化：無
- 遠端匯出：只走 OTLP，而且要有設定才會匯出
- 目前的定義：`apps/server/src/observability/Metrics.ts`

如果沒有設定 OTLP，metrics 仍然存在於行程內，但你不會有任何本機產物可以檢視。

### Event loop 停頓 {#event-loop-stalls}

`apps/server/src/observability/EventLoopMonitor.ts` 每 30 秒對 server 的 event loop 取樣一次。如果從上一次取樣以來，event loop 曾經停頓超過 2 秒，它就會記錄一個 root 層級的 `server.eventLoop.stall` span，並附上一則警告。這個 span 的 trace level 是 `Warn`，所以 `T3CODE_TRACE_MIN_LEVEL` 設成 `Warn` 時它仍然會留下來。這則警告會顯示在 **Settings → Diagnostics**，除非 OTLP logs 是開著的。Span 的時間是取樣執行的時間，不是停頓發生的時間。

有些延遲不會被記錄到：

- `delayMaxMs` 是最長的一次停頓，而且最多可能少算 1 秒。2 秒的門檻套用在這個值上，所以超過 3 秒的停頓通常會被記錄，比這短的則可能漏掉。剛好在取樣執行的那一刻結束的停頓，也可能漏掉。
- 在 macOS 和 Windows 上，電腦睡眠的時間會被讀成延遲。所以只有當 event loop 處於忙碌狀態（而不是在等待 event）的時間至少達到 `delayMaxMs` 時，這次取樣才算數。忙碌時間算的是整個取樣區間，所以如果區間內其他時候都很忙，一次短暫的睡眠仍然可能記錄成一次假的停頓。這時 span 顯示的 CPU 時間會遠低於 `delayMaxMs`。
- 啟動後的第一次取樣會跳過。在資料庫很大的情況下，migration 和 projection bootstrap 這類啟動工作可能讓 event loop 卡住好幾秒。

CPU 時間和 page fault 涵蓋的是整個行程、從上一次取樣以來的整個區間。這個區間名義上是 30 秒，但長時間的停頓會讓取樣延後，區間也跟著變長。區間內的其他工作可能把一段等待掩蓋掉，所以只有 CPU 時間遠低於 `delayMaxMs` 時，才能證明執行緒當時是在等待。CPU 要和 page fault 一起看：

- `cpuSystemMs` 很高，而且 page fault 很多，代表記憶體壓力。Major fault 是從磁碟或 swap 讀取。在 macOS 上，從壓縮記憶體讀取會表現成 minor fault 加上 system CPU。
- `cpuUserMs` 很高，而 page fault 很少，代表是 JavaScript 的工作或垃圾回收。
- CPU 很低，而且 major page fault 很少，指向同步的磁碟 I/O，例如 SQLite 讀取或寫入 trace 檔。
- `involuntaryContextSwitches` 很多，代表有其他行程在搶 CPU。

### 相關的產物 {#related-artifacts}

Provider runtime 的串流仍然有 Provider event 的 NDJSON 檔。這些檔案和 server 的主要 trace 檔是分開的。

## 以帶有觀測儀器的模式執行 server {#run-the-server-in-instrumented-mode}

有兩種實用的模式：

- 只用本機：stdout + 本機的 `server.trace.ndjson`
- 完整的本機可觀測性：stdout + 本機 trace 檔 + 透過 OTLP 匯出到 Grafana/Tempo/Prometheus

本機 trace 檔永遠是開著的。OTLP 匯出則要自己選擇啟用。

### 選項 1：只用本機 trace {#option-1-local-traces-only}

不需要任何額外的環境變數。照平常的方式執行 app，然後檢視 `server.trace.ndjson` 就可以了。

範例：

```bash
npx t3
```

```bash
node --run dev
```

```bash
node --run dev:desktop
```

### 選項 2：搭配本機的 LGTM stack 執行 {#option-2-run-with-a-local-lgtm-stack}

#### 1. 啟動 Grafana LGTM {#1-start-grafana-lgtm}

```bash
docker run --name lgtm \
  -p 3000:3000 \
  -p 4317:4317 \
  -p 4318:4318 \
  --rm -ti \
  grafana/otel-lgtm
```

接著開啟 `http://localhost:3000`。

Grafana 的預設登入資訊：

- 使用者名稱：`admin`
- 密碼：`admin`

#### 2. 匯出 OTLP 環境變數 {#2-export-otlp-env-vars}

```bash
export T3CODE_OTLP_TRACES_URL=http://localhost:4318/v1/traces
export T3CODE_OTLP_METRICS_URL=http://localhost:4318/v1/metrics
export T3CODE_OTLP_LOGS_URL=http://localhost:4318/v1/logs
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=development
```

選擇性的設定：

```bash
export T3CODE_TRACE_MIN_LEVEL=Info
export T3CODE_TRACE_TIMING_ENABLED=true
```

#### 3. 從同一個 shell 啟動 app {#3-launch-the-app-from-that-same-shell}

CLI：

```bash
npx t3
```

Monorepo 的 web/server 開發模式：

```bash
node --run dev
```

Monorepo 的桌面版開發模式：

```bash
node --run dev:desktop
```

已打包的桌面 app：

請從同一個 shell 啟動實際的 app 執行檔，這樣桌面 app 和內嵌的後端才會繼承 `T3CODE_OTLP_*`。

macOS app bundle 的範例：

```bash
T3CODE_OTLP_TRACES_URL=http://localhost:4318/v1/traces \
T3CODE_OTLP_METRICS_URL=http://localhost:4318/v1/metrics \
T3CODE_OTLP_LOGS_URL=http://localhost:4318/v1/logs \
"/Applications/T3 Code.app/Contents/MacOS/T3 Code"
```

直接執行 binary 的範例：

```bash
T3CODE_OTLP_TRACES_URL=http://localhost:4318/v1/traces \
T3CODE_OTLP_METRICS_URL=http://localhost:4318/v1/metrics \
T3CODE_OTLP_LOGS_URL=http://localhost:4318/v1/logs \
./path/to/your/desktop-app-binary
```

在 shell 裡設定環境變數之後，不要指望從 Finder、Spotlight、Dock 或開始功能表啟動也有效。用這些方式啟動通常讀不到那些變數。

#### 4. 改過環境變數後要完整重新啟動 {#4-fully-restart-after-changing-env}

後端是在行程啟動時讀取可觀測性設定的。如果你改了 OTLP 環境變數，請把 app 完全停掉，再重新啟動。

## 如何用 trace 和 metrics 來除錯 server {#how-to-use-traces-and-metrics-to-debug-the-server}

### 從本機 trace 檔開始 {#start-with-the-local-trace-file}

要檢視原始的 span 資料，trace 檔是最快的方式。

先依照啟動模式把路徑解析出來，之後就不用再找。正式環境和明確指定 home 的情況，會把 runtime 狀態存在 base directory 的 `userdata` 資料夾底下：

```bash
TRACE_FILE="${T3CODE_HOME:-$HOME/.t3}/userdata/logs/server.trace.ndjson"
```

從 linked worktree 啟動的開發版 server，預設使用該 worktree 自己的本機 home：

```bash
TRACE_FILE="$WORKTREE/.t3/userdata/logs/server.trace.ndjson"
```

只有不在 linked worktree 裡、也沒有明確指定 home 的開發版，才會使用共用的 dev 目錄：

```bash
TRACE_FILE="$HOME/.t3/dev/logs/server.trace.ndjson"
```

持續追蹤選定的檔案：

```bash
tail -f "$TRACE_FILE"
```

列出失敗的 span：

```bash
jq -c 'select(.type == "effect-span" and .exit._tag != "Success") | {
  name,
  durationMs,
  exit,
  attributes
}' "$TRACE_FILE"
```

列出慢的 span：

```bash
jq -c 'select(.durationMs > 1000) | {
  name,
  durationMs,
  traceId,
  spanId
}' "$TRACE_FILE"
```

檢視內嵌的 log event：

```bash
jq -c 'select(any(.events[]?; .attributes["effect.logLevel"] != null)) | {
  name,
  durationMs,
  events: [
    .events[]
    | select(.attributes["effect.logLevel"] != null)
    | {
        message: .name,
        level: .attributes["effect.logLevel"]
      }
  ]
}' "$TRACE_FILE"
```

追蹤單一個 trace：

```bash
jq -r 'select(.traceId == "TRACE_ID_HERE") | [
  .name,
  .spanId,
  (.parentSpanId // "-"),
  .durationMs
] | @tsv' "$TRACE_FILE"
```

篩選 orchestration command：

```bash
jq -c 'select(.attributes["orchestration_v2.command_type"] != null) | {
  name,
  durationMs,
  commandType: .attributes["orchestration_v2.command_type"],
  threadId: .attributes["orchestration_v2.thread_id"]
}' "$TRACE_FILE"
```

篩選 git 活動：

```bash
jq -c 'select(.attributes["git.operation"] != null) | {
  name,
  durationMs,
  operation: .attributes["git.operation"],
  cwd: .attributes["git.cwd"],
  hookEvents: [
    .events[]
    | select(.name == "git.hook.started" or .name == "git.hook.finished")
  ]
}' "$TRACE_FILE"
```

### 需要真正的 trace 檢視器時使用 Tempo {#use-tempo-when-you-need-a-real-trace-viewer}

遇到以下需求時，Tempo 比原始的 NDJSON 好用：

- 跨很多個 trace 搜尋
- 用視覺化的方式檢視父子關係
- 比較很多個慢的 trace
- 深入檢視某一個失敗的 request，而不必自己用 `traceId` 手動把資料串起來

建議在 Grafana 裡的操作流程：

1. 開啟 `Explore`。
2. 選擇 `Tempo` 資料來源。
3. 把時間範圍設成比較近的區間，例如 `Last 15 minutes`。
4. 從寬鬆的條件開始。不要一開始就下很窄的查詢。
5. 找出來自 `t3code-server` 或 `t3code-desktop` service 的 span，再用 span 名稱或屬性縮小範圍。

適合一開始使用的搜尋條件：

- service 名稱 `t3code-server` 或 `t3code-desktop`，加上一個 resource attribute，例如 `deployment.environment.name`
- span 名稱，例如 `sendTurn`，或是某個 Git 操作，例如 `GitVcsDriver.statusDetails.status`
- 用 `git.operation` 屬性標明是哪個操作的 Git span
- 帶有 `orchestration_v2.command_type` 這類屬性的 orchestration span

確認 trace 有送達之後，再針對 `sendTurn` 或 Git 操作名稱這類名稱下比較窄的 TraceQL 查詢，才會有用。

### 用 metrics 看系統性的問題 {#use-metrics-to-see-systemic-problems}

Trace 最適合看單一個 request。Metrics 最適合看趨勢。

值得觀察的幾組 metric：

- `t3_rpc_request_duration`
- `t3_provider_turn_duration`
- `t3_git_command_duration`

Counter 可以告訴你數量和失敗率：

- `t3_rpc_requests_total`
- `t3_provider_turns_total`
- `t3_git_commands_total`

問題是以下這類時，用 metrics：

- 「這個是不是一直都很慢？」
- 「某次修改之後是不是變糟了？」
- 「哪一種 command 類型最常失敗？」

問題是以下這類時，用 trace：

- 「這一個 request 到底發生了什麼事？」
- 「是哪一個 child span 讓這次操作變慢？」
- 「失敗的那段流程裡輸出了哪些 log？」

## 常見的工作流程 {#common-workflows}

### 「這個 request 為什麼失敗？」 {#why-did-this-request-fail}

1. 從本機的 NDJSON 檔開始。
2. 找出 `exit._tag != "Success"` 的 `effect-span` record。
3. 依 `traceId` 分組。
4. 檢視同層的 span 和 span event。
5. 有需要的話，改到 Tempo 看完整的 trace 樹。

### 「為什麼 UI 感覺很慢？」 {#why-is-the-ui-feeling-slow}

1. 在 trace 檔或 Tempo 裡搜尋慢的頂層 span。
2. 檢查 child span 裡有沒有 sqlite、git、Provider 或終端機的工作。
3. 看對應的 duration metrics，判斷這個慢是不是系統性的。

### 「是不是 git hook 造成延遲？」 {#are-git-hooks-causing-latency}

1. 篩選出 `git.operation` 的 span。
2. 檢視 `git.hook.started` 和 `git.hook.finished` event。
3. 把 hook 花的時間和外層 git span 的 duration 做比較。

### 「為什麼本機有 span，Grafana 裡卻什麼都沒有？」 {#why-do-i-have-spans-locally-but-nothing-in-grafana}

通常是以下其中一種情況：

- 沒有設定 `T3CODE_OTLP_TRACES_URL`
- 啟動 app 的環境，和你匯出變數的環境不是同一個
- 改過環境變數之後，app 沒有完整重新啟動
- Grafana 看的時間範圍或 service 名稱不對

如果本機的 NDJSON 檔有在更新，代表本機 tracing 是正常的。問題幾乎都出在 OTLP 匯出的設定，或是行程的啟動方式。

## 之後在程式碼裡加 tracing 時該怎麼想 {#how-to-think-about-adding-tracing-to-future-code}

### 以邊界為主，不要追蹤小型 helper {#prefer-boundaries-over-tiny-helpers}

適合當作 span 邊界的地方：

- RPC 方法
- orchestration command 的處理
- Provider adapter 的呼叫
- 外部行程的呼叫
- 持久化的寫入
- 佇列的交接

不要對每個小 helper 都做 tracing。大部分的 helper 應該沿用作用中的 span，而不是另外建立一個新的。

### 已經有 `Effect.fn(...)` 的地方就直接沿用 {#reuse-effectfn-where-it-already-exists}

程式碼裡已經大量使用 `Effect.fn("name")`。通常它就應該是你的第一個 tracing 邊界。

臨時性的工作可以這樣寫：

```ts
import { Effect } from "effect";

const runThing = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({
    "thing.id": "abc123",
    "thing.kind": "example",
  });

  yield* Effect.logInfo("starting thing");
  return yield* doWork();
}).pipe(Effect.withSpan("thing.run"));
```

### 高基數（high-cardinality）的細節放在 span 上 {#put-high-cardinality-detail-on-spans}

ID、路徑和其他詳細的上下文，請用 span annotation：

```ts
yield *
  Effect.annotateCurrentSpan({
    "provider.thread_id": input.threadId,
    "provider.request_id": input.requestId,
    "git.cwd": input.cwd,
  });
```

### Metric 的 label 要維持低基數 {#keep-metric-labels-low-cardinality}

適合的 metric label：

- 操作種類
- 方法名稱
- Provider 種類
- aggregate 種類
- 結果（outcome）

不適合的 metric label：

- 原始的 Thread ID
- command ID
- 檔案路徑
- cwd
- 完整的 prompt
- 完整的模型字串（如果用正規化後的模型家族 label 就夠的話）

詳細的上下文應該放在 span 上，不是放在 metrics 上。

:::plain 「基數」是什麼意思
基數（cardinality）指的是一個欄位可能出現多少種不同的值。「結果」只有成功、失敗少數幾種，是低基數；Thread ID 每個 Thread 都不一樣，是高基數。

Metrics 是把同一組 label 值的資料累加在一起看趨勢，label 的值種類越多，就會拆成越多條各自獨立的序列。Span 則是一筆一筆獨立的紀錄，本來就適合帶上這類細節。
:::

### 把 log 當成 span event 使用 {#use-logs-as-span-events}

寫在 span 裡面的 log 會成為這個 trace 脈絡的一部分：

```ts
yield * Effect.logInfo("starting provider turn");
yield * Effect.logDebug("waiting for approval response");
```

因為安裝了 `Logger.tracerLogger`，這些訊息會以 span event 的形式出現。

### 使用可以 pipe 的 metrics API {#use-the-pipeable-metrics-api}

要替一個 effect 加上 counter 和 timer，預設的做法是 `withMetrics(...)`：

```ts
import { someCounter, someDuration, withMetrics } from "../observability/Metrics.ts";

const program = doWork().pipe(
  withMetrics({
    counter: someCounter,
    timer: someDuration,
    attributes: {
      operation: "work",
    },
  }),
);
```

## 詳細的 API 參考 {#detailed-api-reference}

### Runtime 的組裝 {#runtime-wiring}

Server 的可觀測性 layer 是在 `apps/server/src/observability/Layers/Observability.ts` 組裝的。

它提供：

- 排版過的 stdout logger
- `Logger.tracerLogger`
- 本機 NDJSON tracer
- 選擇性的 OTLP trace exporter
- 選擇性的 OTLP metrics exporter
- 選擇性的 OTLP log exporter
- Effect 的 trace-level 和 timing ref

桌面版的 main process 是第二個資料產生者，在 `apps/desktop/src/app/DesktopObservability.ts` 組裝。它讀取的 `T3CODE_OTLP_*` 名稱和 Settings 項目，都和它所監管的後端相同，並且涵蓋後端看不到的工作：app 啟動、視窗和選單的處理、後端的監管，以及更新。它回報的 service 名稱是 `t3code-desktop`，所以 collector 會把它和後端並列顯示，而不是混在一起。它只匯出 trace 和 log；main process 不記錄任何 metrics，所以 metrics endpoint 只適用於後端。

### 環境變數 {#env-vars}

本機 trace 檔：

- `T3CODE_TRACE_FILE`：覆寫 trace 檔的路徑
- `T3CODE_TRACE_MAX_BYTES`：每個檔案達到多大就輪替，預設 `10485760`
- `T3CODE_TRACE_MAX_FILES`：輪替檔案的數量，預設 `10`
- `T3CODE_TRACE_BATCH_WINDOW_MS`：flush 的時間區間，預設 `200`
- `T3CODE_TRACE_MIN_LEVEL`：最低的 trace level，預設 `Info`
- `T3CODE_TRACE_TIMING_ENABLED`：啟用 timing metadata，預設 `true`

OTLP 匯出：

- `T3CODE_OTLP_TRACES_URL`：OTLP trace endpoint
- `T3CODE_OTLP_METRICS_URL`：OTLP metric endpoint
- `T3CODE_OTLP_LOGS_URL`：OTLP log endpoint
- `T3CODE_OTLP_EXPORT_INTERVAL_MS`：匯出的間隔，預設 `10000`
- `T3CODE_OTLP_HEADERS`：三個 exporter 共用的額外 header，格式和 `OTEL_EXPORTER_OTLP_HEADERS` 相同：以逗號分隔的 `key=value` 配對，值要經過 percent-encoding。
- `T3CODE_OTLP_PROTOCOL`：`http/json`（預設）或 `http/protobuf`

Server 和桌面 app 也會讀取標準的 `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` 和通用的 `OTEL_EXPORTER_OTLP_ENDPOINT`（後者會自動加上 `/v1/traces`、`/v1/metrics` 或 `/v1/logs`），給預期使用這些變數的 collector 用。非空白的 `T3CODE_OTLP_*_URL` 優先於這兩者；針對單一 signal 的 endpoint，在它那個 signal 上優先於通用的 endpoint。空白的值視為沒有設定。使用 OTEL endpoint 的 signal，header 取自 `OTEL_EXPORTER_OTLP_HEADERS`，protocol 取自 `OTEL_EXPORTER_OTLP_PROTOCOL`（預設 `http/protobuf`，讀取時不分大小寫）；針對單一 signal 的 `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_HEADERS` 或 `_PROTOCOL`，在它那個 signal 上優先於通用的設定。`T3CODE_OTLP_HEADERS` 和 `T3CODE_OTLP_PROTOCOL` 永遠不會套用在這種 signal 上。以下情況會讓該 signal 的匯出被關閉，並在啟動時顯示警告，而不是改送到 Settings 裡設定的 endpoint：endpoint 不是 `http` 或 `https` 的 URL；protocol 不是 `http/protobuf` 或 `http/json`，例如 `grpc`；header 不是「`key=value` 配對、值經過 percent-encoding」的格式。

:::plain endpoint 的優先順序
以單一個 signal（trace、metrics 或 log）來說，由高到低是：

1. `T3CODE_OTLP_*_URL`（非空白）
2. 該 signal 專用的 `OTEL_EXPORTER_OTLP_*_ENDPOINT`
3. 通用的 `OTEL_EXPORTER_OTLP_ENDPOINT`

要注意 header 和 protocol 是跟著 endpoint 的來源走的：endpoint 來自 `OTEL_*` 變數時，就只看 `OTEL_*` 的 header 和 protocol，`T3CODE_OTLP_HEADERS` 和 `T3CODE_OTLP_PROTOCOL` 不會套用。兩邊的 protocol 預設值也不同，`T3CODE_OTLP_PROTOCOL` 是 `http/json`，`OTEL_EXPORTER_OTLP_PROTOCOL` 是 `http/protobuf`。
:::

Service 名稱是固定的：後端是 `t3code-server`，桌面版的 main process 是 `t3code-desktop`，兩者的 `service.namespace` 都是 `t3code`。`OTEL_SERVICE_NAME`，以及 `OTEL_RESOURCE_ATTRIBUTES` 裡的 `service.name` 或 `service.namespace`，都會被忽略。要區分不同的安裝，請用其他的 resource attribute，例如 `OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=development`。

如果沒有設定 OTLP 的 URL，本機 tracing 仍然可以運作，metrics 只留在行程內，log 只輸出到 stdout。

### 總開關（Kill Switch） {#the-kill-switch}

`T3CODE_OTEL_SDK_DISABLED` 和 `OTEL_SDK_DISABLED` 會關掉 server 和桌面版 main process 的所有 OTLP 匯出，並蓋過來自環境變數或 Settings 的任何 endpoint。本機 trace 檔和 stdout 的 log 不受影響。

有設定 `T3CODE_OTEL_SDK_DISABLED` 時以它為準，所以在一台為了其他程式而設定 `OTEL_SDK_DISABLED` 的機器上，可以用 `T3CODE_OTEL_SDK_DISABLED=false` 重新啟用匯出。它接受常見的布林寫法（`true`/`false`、`yes`/`no`、`on`/`off`、`1`/`0`、`y`/`n`）。`OTEL_SDK_DISABLED` 遵循 OpenTelemetry 規格，只有 `true` 會停用匯出，所以 `OTEL_SDK_DISABLED=1` 不會停用。值不分大小寫，前後的空白會被去掉。無法辨識的值會被忽略，並在啟動時顯示警告。

把 `OTEL_TRACES_EXPORTER`、`OTEL_METRICS_EXPORTER` 或 `OTEL_LOGS_EXPORTER` 設成 `none`，只會關掉那一個 signal，並蓋過 OTEL endpoint 和 Settings 裡的 endpoint。`T3CODE_OTLP_*_URL` 在它那個 signal 上仍然優先。`otlp` 是預設值；其他任何 exporter 名稱，例如 `console` 或 `prometheus`，都會被忽略，並在啟動時顯示警告。

### 目前已加上觀測儀器的部分 {#what-is-instrumented-today}

目前價值比較高的 span 和 metric 邊界包括：

- 來自 `effect/rpc` 的 Effect RPC websocket request span
- `apps/server/src/observability/RpcInstrumentation.ts` 裡的 RPC request metrics
- 啟動的各個階段
- orchestration command 的處理
- Provider session 和 turn 的操作
- git 指令的執行和 git hook event
- 終端機 session 的生命週期
- sqlite 查詢的執行
- event loop 停頓（`server.eventLoop.stall`）

### 目前的限制 {#current-constraints}

- span 之外的 log 不會保存在 trace 檔裡；SSH 管理的啟動的 stdout/stderr 仍然會被記錄在它的 launcher log 裡
- metrics 不會在本機留下快照

## Heap snapshot {#heap-snapshots}

想知道一個長時間執行的 server 在記憶體裡保留了什麼，可以對它送出 `SIGUSR2`。Server 會把一份 V8 heap snapshot 寫到它的 logs 目錄，並在 log 裡印出路徑。這個做法適用於 macOS 和 Linux 上的桌面版、`npx t3`，以及以 service 方式安裝的版本。Windows 沒有 `SIGUSR2`。

訊號要送給 `server-runtime.json` 裡記錄的 server pid。這個檔案放在 server 的 state 目錄裡，和 `logs` 目錄並列。如果是開發版 server，或是用 `--home-dir` 啟動的，請使用 [Trace](#traces) 一節所說的那個 server 的 state 目錄。不要把訊號送給桌面 app 或 service launcher：沒有這個 handler 的行程收到 `SIGUSR2` 會直接結束。當掉之後，這個檔案裡可能留著過期的 pid，而那個 pid 現在已經屬於另一個行程，所以請先確認 pid。

```bash
pid="$(jq .pid "${T3CODE_HOME:-$HOME/.t3}/userdata/server-runtime.json")"
ps -p "$pid" -o command=
```

如果 `ps` 顯示的是 T3 Code server，再送出訊號：

```bash
kill -USR2 "$pid"
```

產生的檔案是 `<logsDir>/server-<pid>-<timestamp>.heapsnapshot`，和 `server.trace.ndjson` 放在一起。要開啟它，請使用 Chrome DevTools 的 Memory 分頁，然後選擇 Load。

擷取之前請注意：

- Server 在寫檔期間會停住。Heap 很大的話，可能需要一分鐘以上。已連線的 client 在暫停期間可能會重新連線；如果 server 有 event loop monitor，它會把這次暫停記錄成一次停頓。訊號只送一次。寫檔期間再送第二次訊號，會在第一份寫完之後再擷取一份 snapshot。
- 寫檔需要的可用記憶體，大約和 heap 目前使用的一樣多。在一台已經在 swap 的機器上，這可能讓問題更嚴重，或是讓 server 當掉。
- 檔案包含 server 記憶體裡的所有東西，包括 token、secret 和 Thread 的內容。不要公開分享。用完之後請刪除，因為儲存空間的清理機制不會移除它。
