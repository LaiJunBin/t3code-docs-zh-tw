---
title: 架構總覽
source: docs/internals/overview.md
source_hash: 149bcf57dff01173d42c0ffd0f70e0adb009a540
---

T3 Code 讓執行工作留在擁有 workspace 的那個 environment 裡。網頁、桌面、手機這些 client 透過經過驗證的 RPC 來控制它。遠端 client 絕對不可以拿自己的檔案系統、Provider 憑證或機器狀態，去取代 environment 的。桌面 app 內建了一個 server，但它的 renderer 同樣遵守這條界線。

:::plain 一句話版本
agent、終端機、Git、檔案全部都在 server 那台機器上。client 只是遙控器：送指令過去、把狀態顯示出來。就算 client 和 server 剛好在同一台電腦（桌面 app），程式也是照「兩邊分開」的方式寫的。
:::

## 所有權的界線 {#ownership-boundaries}

Provider 行程、終端機、Git 和專案檔案屬於 server。共用的連線狀態與領域狀態放在 `packages/client-runtime`；各個 client 只提供平台服務和 UI。把這些邏輯集中共用，可以避免重新連線、多 environment 這類行為在網頁版和手機版之間走樣。參見[連線 runtime](./connection-runtime.md) 與[遠端 environment](./remote.md)。

[RPC 合約](../../packages/contracts/src/rpc.ts)是 client 與 server 之間的界線，兩邊各自有獨立的版本。訂閱（subscription）只送出 client 需要的狀態，所以正在看某一個 Thread 的 client，不必負擔所有 Thread 的歷史紀錄。一條 socket 通過了身分驗證，不代表它被授權呼叫上面的每一個方法。參見 [environment 驗證](./environment-auth.md)。

### Pull request 連結的相容性 {#pull-request-linking-compatibility}

網頁、桌面、手機和 environment 各自獨立升級。是否支援連結功能，要透過 environment descriptor 來協商，絕對不要依據 client 版本，也不要假設各端會同步發版：

| Environment 的能力                    | Client 的行為                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `threadPullRequests: true`            | 使用持久化的 `pullRequests[]`、多重連結指令、stack UI，以及從 PR 反查 Thread。                            |
| 只有 `threadPullRequestLinking: true` | 使用 `linkedPullRequest` 和既有的 `thread.meta.update` 單一連結操作。不要呼叫多重連結的 RPC。             |
| 兩個旗標都沒有                        | 隱藏連結相關的操作；既有的「由分支找到 PR」顯示方式仍然可用。                                             |

新版 environment 會繼續宣告舊旗標、接受舊版的 metadata 指令，並為舊版 client 送出推導出來的 `linkedPullRequest` 欄位。這個不帶 host 資訊的欄位只包含 Thread 所屬專案自己 repository 裡的連結；跨 host、跨 repository 的連結需要多重連結協定。新版 client 可以接受省略了 `pullRequests` 的 snapshot。舊的 wire 欄位、projection 欄位和 replay 支援都要保留；這個功能並沒有安排移除它們的時程。Environment 降版之後，缺少的新能力也必須蓋過快取裡的多重連結資料。

:::plain 為什麼要這樣協商
使用者的手機 app、桌面 app、遠端 server 不會同時更新，所以任何時候都可能是「新 client 連舊 server」或「舊 client 連新 server」。做法是讓 server 明白說出「我會什麼」，client 依此決定要用哪一套做法，而不是用版本號去猜。寫新功能時，舊的欄位和指令也要繼續留著。
:::

Provider 專屬的行為要放在 adapter 後面。Orchestration 處理的是正規化之後的 command 和 event，所以新增一個 Provider 時，不應該需要在領域邏輯或各個 client 裡到處加分支。參見 [Provider 的限制](./providers.md)。

## 設定的所有權 {#settings-ownership}

Client 的偏好設定留在目前這個 client；environment 的預設值和專案的覆寫值留在擁有它們的 server 上。網頁版和桌面版「正在設定哪個對象」是 URL 狀態，會對照目前的連線和專案成員關係來解析。指定的對象無法使用時，不可以退而改用另一個 environment。**All environments** 是對「已連線且已載入的 server」做一次明確的批次編輯，它不是持久的全域預設值，也不保證會同步到離線中或未來才出現的 environment。同樣地，專案群組這種對象選到的是已知的、各 environment 本機的 checkout；群組本身並不儲存可以繼承的預設值。

## 持久化的意圖與副作用 {#durable-intent-and-side-effects}

Event log 是 orchestration 狀態的唯一事實來源（source of truth）。[v2 orchestrator](../../apps/server/src/orchestration-v2/Orchestrator.ts) 把 command 排成序列逐一處理，並決定要產生哪些 event，過程中不執行任何 Provider 或檔案系統的工作。[EventSink](../../apps/server/src/orchestration-v2/EventSink.ts) 在同一個資料庫 transaction 裡提交 event、持久化的 projection、已接受的 command receipt，以及 outbox effect。訂閱者在提交之後才會收到 event。這樣一來 command 重試時可以保持冪等（idempotent），也避免持久化的 projection 跑到 event log 前面。

[Effect worker](../../apps/server/src/orchestration-v2/EffectWorker.ts) 在意圖被記錄下來之後才執行副作用，然後把結果送回 orchestration。因此 command 得到確認（acknowledgement），代表的是「意圖已經提交」，不是 Provider、checkpoint 或其他後續工作已經完成。外部 I/O 不要放進 command 的決策過程，也不要放進資料庫 transaction。跟一個已經遺失的 Provider 行程綁在一起的 effect 不能直接重播；復原流程會先把它們作廢，再接受新的工作。

:::plain 用點餐來比喻
1. 你點餐（command）。
2. 櫃台只做一件事：判斷這張單能不能接，然後把「已接單」寫進帳本（event），同時在待辦單上記下「廚房要做這道菜」（outbox effect）。這兩筆是一起寫進去的，不會只寫一半。櫃台自己不下廚。
3. 廚房（effect worker）看到待辦單才開始做菜，做完再回報櫃台，櫃台再記一筆「已出餐」。

所以櫃台跟你說「好的」，意思只是單接了，不是菜好了。這樣設計的好處是：就算中途當機，重開之後帳本和待辦單一定對得上，知道哪些事還沒做。
:::

已持久化的 event 在 replay 時必須仍然能夠解碼。修改 schema 不只影響即時的 RPC 流量，也會影響舊 environment 的啟動過程。相容性工作必須把已儲存的歷史資料算進去，而不只是考慮最新版 client 會送出什麼。

## Turn 完成與 checkpoint {#turn-completion-and-checkpoints}

Provider 的 turn 結束，和它的後續工作塵埃落定，是兩個不同的里程碑。Orchestration 記錄 Provider turn 和 run 的狀態時，與 [run finalization](../../apps/server/src/orchestration-v2/RunFinalizationService.ts) 是分開的。比較晚才完成的 checkpoint 或 diff，不可以拉長已記錄的 Provider 執行時間，也不可以讓 client 繼續顯示 Provider 還在工作。完成之後的 PR 探索，還會檢查 checkout 是否仍然對應到這個 Thread 的非預設分支，以及是否沒有更新的 run 正在進行。

[Checkpoint](../../apps/server/src/checkpointing/CheckpointStore.ts) 使用隱藏的 Git ref 來擷取 workspace 狀態，不會在使用者的分支上增加 commit。Revert 必須讓 workspace 狀態和 Provider 的對話彼此協調一致。無法倒回自己對話的 Provider，必須在動到檔案系統之前就拒絕這個操作。

Thread 的 settle（結案）狀態由 server 負責。[Settlement service](../../apps/server/src/orchestration-v2/ThreadSettlementService.ts) 不需要有 client 連線，就能評估 PR 與閒置時間的設定。Merge 通知會讓快取的 PR 狀態失效，並觸發一次檢查。在 T3 之外發生的 merge（例如 agent 自己執行 `gh pr merge`）不會送出通知，所以 [PR sync reactor](../../apps/server/src/orchestration-v2/PullRequestSyncReactor.ts) 會在「執行過 merge 或 close 指令的 run」結束時，重新讀取該 Thread 仍然開啟的連結。受保護的 `thread.auto-settle` command 遇到以下情況會拒絕執行：有更新的活動、有明確的 settle 覆寫設定、有進行中或被擋住的工作。它會記錄活動時間戳記以維持穩定的排序，並卸離閒置的 Provider session。Client 只負責呈現已持久化的結果；它們不會用自己的時鐘或 PR 快取去推導 settle 狀態。

## 等待非同步工作 {#waiting-for-asynchronous-work}

測試使用 [drainable worker](../../packages/shared/src/DrainableWorker.ts) 來等待，直到佇列和目前正在處理的項目都已完成。光是佇列空了，並不能證明 worker 已經閒置。

V2 的測試也會 drain effect worker，或是等待某一個特定的已持久化 event 或 receipt。測試用的訊號，和讓 dispatch 保持冪等的持久化 command receipt 是分開的。正式環境的行為必須依據已持久化的狀態和 event，而不是測試用的儀器，也不是對經過時間的假設。

:::note 寫測試時的實際意思
不要用「等個幾百毫秒應該就好了」的寫法。測試要等的是一個明確的訊號：worker 已經 drain 完，或是某個 event、receipt 已經寫進去。
:::

Electron shell 會在非同步服務之前，先同步取得 `DesktopPreReadyPlatform.layer`。在 Linux 上，這會在 Chromium 初始化它的 portal 連線之前，先設定好 desktop-entry 身分和 global-shortcut portal 旗標。晚一點才在 `DesktopAppIdentity` 裡設定身分就太遲了：Chromium 會快取第一次註冊的結果，連失敗也一樣快取。這個身分必須和 `DesktopLinuxUrlHandler` 所管理的已安裝 entry 相符。Pre-ready 設定也會在 portal 註冊之前更新該 entry 的 `Exec` 路徑：AppImage 更新可能會移除先前的執行檔，導致舊的 entry 即使檔名正確也已經失效。稍後執行的 URL handler 會避免在 portal 可能正在讀取時，重寫一個內容完全相同的 entry。在 Wayland 上，Electron 同步回傳的快捷鍵註冊結果只確認「已送出」；並不確認桌面環境已同意，也不確認綁定已生效。

原生模組絕對不會在啟動路徑上載入 Electron 的 main process，而 snapshot 功能保留的兩個原生模組都被隔離起來：`@crowecawcaw/xa11y` 只在 fork 出來的 Node 模式子行程（`SnapShotAccessibilityWorker`、`RegionSnapShotWorker`）和一個 worker thread 裡執行；`ffi-rs` 則是在 `WindowsForeground.ts` 裡延遲載入，只用於少數幾個 Win32 呼叫。macOS 的視窗查詢改為呼叫 `osascript`，不使用原生 addon。這些元件任何一個當掉或卡住，都不可以把整個 app 拖垮，所以新的原生功能要放在有時限（deadline）的子行程裡，而不是在 main 裡 `import`。

共用術語請看[術語表](./glossary.md)，環境設定與檢查方式請看[開發 runbook](../operations/development.md)。
