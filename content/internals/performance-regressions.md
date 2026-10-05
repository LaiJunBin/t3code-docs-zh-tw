---
title: 效能回歸檢查
source: docs/internals/performance-regressions.md
source_hash: 9440d2ab6144832a3016fa240d27b29affe3e45e
---

v2 transport 有一個專用的回歸檢查指令：

```bash
vp run test:perf:v2-wire
```

它會實際跑過真正的 v2 projection 和 client reducer。這一點很重要，因為較舊的 built-app benchmark fixture 塞進去的是 v1 的 orchestration event；拿那些 fixture 去跑 v2 的 client，可能會得到看起來令人放心的時間數字，卻沒有測到目前真正在用的 transport 路徑。

:::plain 為什麼需要這個專用指令
舊的效能測試餵的是 v1 格式的資料。用它來測 v2 的 client，數字可能很好看，但其實沒有經過 v2 實際在走的那條路。這個指令直接跑 v2 的 projection 和 client reducer，所以下面列的那些限制，改壞了會在本機就測出來。
:::

v2 的檢查固定住以下這些不變條件：

- Client 冷啟動開啟時，目標是 75 列最近的時間軸資料，以及大約 1 MiB 的編碼後資料。必要的控制紀錄和「至少要有一列」的規則可以超過這個位元組目標；它不是硬性上限。
- 有界的 snapshot 不會保留完整而重複的 conversation-message 資料表。
- 較舊的活動是以有界的 HTTP 分頁抓取，並在不干擾即時捲動視窗的情況下合併進來。
- 已確認支援歷史分頁的 client，會選擇加入（opt into）socket snapshot fallback；這種 fallback 使用同樣的有界近期歷史視窗，並帶有抓取更舊歷史所需的 cursor。較舊的 client 和只用 WebSocket 啟動的情況，則保留相容的完整 snapshot fallback。
- Snapshot 查詢是以「每個 fork ancestor」為單位限制時間軸的讀取量，而不是限制總列數：相依紀錄和控制紀錄仍然會跟著這個視窗一起送。光是 socket frame 變小，並不能證明整個 server 的記憶體用量降低了。
- Resume 的 catch-up 會在解碼之前，先檢查原本 1 MiB 的已持久化 payload 預算；接著最多重播 128 個 Thread event 和 1 MiB 的投影後 event JSON，超過就退回使用 snapshot。原始 JSON 的位元組數並不是 heap 記憶體的上限。只因為輸出投影後很小就調高這個預算，可能會在大型工具更新反覆出現時增加 server 的記憶體配置。
- 原始的指令輸出、dynamic-tool 的結果本體，以及行內的檔案變更本體，在 wire 邊界上都會被省略，連很小的輸出也一樣。明確的失敗旗標和有界的 result ID 可以保留狀態和分組後的動作計數，而不必傳送那些本體。已持久化的 event 仍然是完整的；需要檔案內容時，既有的 diff endpoint 仍然會提供。
- 初始的 shell 只包含作用中的導覽列。已封存的列使用專用的封存查詢，而對話紀錄的訊息本體不論大小，都留在 Thread detail 裡。
- Shell 的 resume 送的是 delta 加上精簡的 repository-enrichment metadata，而不是再送一次完整的專案與 Thread snapshot。
- Auto、steer 和 restart 這幾種送出方式，是在 server 的 per-thread dispatch lock 裡面，依據權威狀態來決定遞送方式。在 server 宣告支援的情況下，模型選擇和指定 checkpoint 的 rollback，也不必先抓取完整的 Thread projection 就能 dispatch。較舊的 server 保留以 projection 為基礎的驗證。明確的 start 送出本來就略過了那次讀取，所以這項節省並不適用於每一條 client 送出路徑。

修改 projection schema、分頁、shell 同步或 Thread 狀態時，請執行這個指令，同時搭配針對相關 package 的型別檢查，並在每一個受影響的 surface 上用真正的 client 跑過一遍。Transport 的效能 fixture 會驗證合約的編碼，並針對同一份合成的工作負載比較壓縮前的 RPC JSON，同時另外保留歷史上的應用程式物件數量。這些既不是壓縮後的 WebSocket 擷取，也不是 server RSS 的量測；而且 command fixture 排除了不相干的 settings 呼叫和訂閱 event。Payload 預算應該放在這些測試裡，這樣回歸才會在本機就失敗。

:::note 這些數字量的是什麼
測試比較的是「壓縮前的 RPC JSON 大小」。它不代表實際在網路上傳的位元組數（那是壓縮過的），也不代表 server 用了多少記憶體。引用這些數字時不要把它說成後面兩者。
:::

## Event store 與啟動 {#event-store-and-startup}

Sequence cursor 必須用索引去 seek，而不是掃描保留下來的歷史。應用程式層級的 sequence 索引包含專案 event 和 v2 的 Thread event；每個 Thread 各自的 sequence 索引只包含 v2 的 Thread event。只存在於舊版的 Thread 和未知的 Thread 必須傳回零，而且不能去掃描其他 Thread。Catch-up 查詢要讓 sequence 範圍，以及選用的 Thread 或 command 條件，都維持在可以使用索引的形式。

啟動時，會先從目前的 projection 狀態挑出需要復原的候選者，再去讀取完整的 Thread projection。候選者的挑選範圍包含排入佇列的 run、等待中的 runtime 請求、仍在運作的 Provider session、背景工作，以及尚未完成的委派遞送（delegated delivery）。在復原有需要的地方，已封存的 Thread 仍然會參與。不會只為了發現「已經沒有工作要做」，就去載入已完成的 Thread 歷史。

Projection 驗證會以有界的分頁解碼正規的資料列，包含共用的 Provider 紀錄和 fork ancestry。Rebuild 會在它的 transaction 裡，以固定的 sequence 為界，一頁一頁重播 event；它不可以先把整個 event log 收集起來才開始投影。

專門的回歸測試放在 `OrchestrationEventStore.sequence.test.ts`、`ProjectionRecovery.test.ts`，以及 `apps/server/src` 底下的 Provider runtime 復原測試。

## 背景工作與導覽 {#background-work-and-navigation}

Settlement worker 透過 `ProjectionStore.getSettlementCandidates` 讀取「作用中、未 pin、而且沒有明確 settle（結案）覆寫設定」的 Thread。它會讀取最新的 run 和使用者訊息的時間戳記，排除有進行中 run 和等待中請求的 Thread，並使用和 shell 相同的推導方式檢查背景工作。它不會載入已封存的歷史、fork ancestry、對話紀錄的計數，或是 Provider session。Orchestrator 在套用 settle 之前，仍然會驗證 Thread 目前的狀態。

已讀回條（read receipt）使用 `ProjectionStore.getThread`，只載入正規的 Thread metadata。一次造訪會讓 `lastVisitedAt` 單調地往前推進，不會改變 `updatedAt`，也不會解碼歷史。Shell 查詢使用一個涵蓋式（covering）的 thread / run 索引來取得項目數量，並使用一個部分索引（partial index）來處理尚未到達終止狀態的背景項目，包含閒置的項目。讀取最新的使用者訊息時，使用的是依更新時間排序的索引。

指令面板的結果會讓即時的 VCS 查詢和已連結 pull request 的查詢，只對可見的 viewport（包含一小段 overscan 區域）保持租約（lease）。租約釋放之後，快取的 badge 仍然可以使用。本機的 Git status 讀取會略過分歧（divergence）的計算；需要 ahead / behind 數量的呼叫端，則保留完整的 status 路徑。快取的 fetch 失敗會共用既有的 backoff，而且只記錄實際失敗的那一次嘗試。Desktop 的 environment bootstrap 讀取如果內容沒變，會保留原本的陣列身分（identity），這樣輪詢就不會讓訂閱者失效。

Relay awareness 會為每個 Thread 排入一筆等待中的發佈；如果 Thread 在傳送過程中又有變動，會保留一筆後續的發佈。對話紀錄的 delta 和工具輸出不會把 awareness 工作排入佇列。Run、請求和相關的 Thread metadata event 則會。設定會在讀取 shell 之前先檢查，而連線的變動會讓已發佈的身分失效，這樣重新連結（relink）時就能發佈沒有變動的狀態。失敗的發佈會以指數遞增的延遲重試最新的狀態，最多五次。新的相關 event 會重設這個重試額度；發佈成功、停用或解除連結則會取消重試。額度用完之後，發佈會等待下一個相關的 event，而不是在服務中斷期間持續產生流量。

專門的測試涵蓋：`ProjectionSettlement.test.ts`、`ThreadSettlementService.test.ts`、`runtimeLayer.test.ts`、`AgentAwarenessRelay.test.ts`、`GitVcsDriverCore.test.ts`、`ThreadStatusIndicators.subscriptions.test.tsx`，以及 `desktopLocal.test.ts`。
