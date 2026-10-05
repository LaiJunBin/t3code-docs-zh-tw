---
title: 舊版 orchestration 遷移
nav: 舊版遷移
source: docs/internals/legacy-orchestration-migration.md
source_hash: 2f496065a6cf31e638ae196b4a1e896ca2436e30
---

Orchestration v2 第一次啟動時，會在開啟可寫入的持久化儲存之前，先把 `state.sqlite` 做一份 snapshot，存成 `statev2.sqlite`。只有這份複本會被套用 v2 的 migration；原本的檔案仍然留給 v1 使用。之後每次啟動都會沿用這份複本，不會再從 v1 重新整理。它會先建立 v2 的 Thread shell event，等到 client 讀取或接續那個 Thread 時，才延遲（lazily）匯入完整的使用者與助理對話紀錄。v1 的 projection 資料表仍然是匯入的來源；萬一某次匯入需要調查，它們也提供了一個唯讀的復原來源。

:::plain 遷移分兩段進行
第一段在啟動時：複製一份資料庫給 v2 用，並且只替每個舊 Thread 建立「外殼」（標題、設定、時間這些基本資料）。第二段是等到真的有人打開或接續某個 Thread 時，才把那個 Thread 的對話內容搬過來。v2 的 migration 只套用在複本上，原本的 `state.sqlite` 留給 v1。
:::

## 匯入的資料 {#imported-data}

Shell 匯入會保留專案和 Thread 的識別碼、標題、Provider 與模型的選擇、runtime 與 interaction 模式、分支、worktree 路徑、建立與更新時間、封存與刪除時間、settle（結案）的覆寫設定與時間戳記、snooze（暫時擱置）的時間戳記、pin 的時間戳記與順序，以及連結的 pull request。對於在這些欄位被涵蓋之前就已經匯入的 Thread，metadata 修復路徑會補上 snooze、pin 順序、`unsettledAt` 和連結的 pull request 欄位。

對話紀錄的匯入會從 `projection_thread_messages` 讀取使用者和助理的資料列。它會保留訊息識別碼、文字、支援的附件、時間戳記、角色和順序。當時還在串流中的訊息，會變成一個被中斷（interrupted）的 turn item。

匯入程式不會轉換 Provider session 的身分、原生的 Provider run、checkpoint 與 diff、活動與工具呼叫、核准請求，或是提議的計畫（proposed plan）。因此 V2 不可以把這些紀錄呈現成已遷移的歷史。

## 第一次接續 {#first-continuation}

遷移過來的 Thread 沒有作用中的 Provider thread。它第一次被接續時，會建立一個全新的 Provider session，並送出一份只由使用者訊息和助理訊息組成的舊版 handoff。這份 handoff 會在 32,000 個字元的預算內，選取對話紀錄最新的結尾片段（suffix），預算包含各段的標籤和匯入通知在內。這個預算和可攜式 Provider handoff 是分開的。

:::plain 接續舊 Thread 時 agent 知道多少
Provider 那邊是全新的 session，不記得之前的事。T3 Code 會把舊對話裡最新的一段文字（最多 32,000 個字元）整理成一則 handoff 送過去，讓 agent 有脈絡可以接下去。這段文字只包含使用者和助理的訊息；工具呼叫、checkpoint 這些都不在裡面。
:::

## Client 與 server 的切換 {#client-and-server-cutover}

Client 和 server 必須對 `ORCHESTRATION_PROTOCOL_VERSION`（目前是 2）有一致的認定。Client runtime 會在 socket URL 後面加上 `orchestrationProtocol=2`，而 `/ws` 路由遇到版本缺少或不符時，會在任何 RPC 或驗證工作執行之前，就以 HTTP 426（`orchestration_protocol_incompatible`）拒絕。Client 也用同樣的方式檢查 environment descriptor：缺少版本代表那台 host 早於 protocol 2，版本不同則代表兩邊都需要更新。不論是哪一個方向，連線都會被擋下來並標示為 `unsupported`，同時附上一則訊息，指出該更新的是哪一台機器，而不是在只升級一半的狀態下執行。參見 `packages/client-runtime/src/connection/compatibility.ts` 和 `apps/server/src/ws.ts`。

## Migration id 分歧 {#divergent-migration-ids}

`effect_sql_migrations` 會記錄 `migration_id` 和 `name`，但 migrator 只比較 id：id 小於或等於已記錄最大值的項目都會被跳過，不會檢查名稱。所以，如果一個資料庫曾經用某個 id 執行過本地或 fork 的 migration，而這個 build 之後把同一個 id 指派給另一個不同的 migration，那個資料庫就永遠不會收到這個 build 在該 id 上的 migration。`runMigrations` 會把每一個「已記錄、但名稱和 manifest 不同」的 id 記到 log 裡，這樣被跳過的 schema 變更才有辦法診斷。在這本帳冊裡，fork 沒有安全的 id 範圍可用：任何小於或等於未來某個 upstream id 的 id，都會永遠把它遮住。所以 fork 的 schema 變更應該放在另一張 migration 資料表裡，或是完全放在 migrator 之外。

:::plain 為什麼 fork 不能自己加 migration 編號
Migrator 只記得「我跑到第幾號」，不看每一號的名稱。假設你的 fork 自己加了一個 migration 並佔用了某個編號，之後 upstream 也用了同一個編號做別的事，你的資料庫會認為那一號已經跑過，於是直接跳過 upstream 的變更。挑一個很大的編號也沒用：資料庫記下的最大編號變大之後，upstream 之後新增的 migration 只要編號小於或等於它，全都會被跳過。能幫忙診斷的線索是 `runMigrations` 會在 log 裡印出名稱對不上的編號。
:::

## 復原 {#recovery}

目前沒有受支援的「匯出整個 Thread」API。復原時使用的是 environment 的 `userdata` 目錄的一份未經更動的複本，並以 SQLite 的唯讀模式開啟那份複本。使用者指南裡記載了針對 `projection_threads` 和 `projection_thread_messages` 的查詢。絕對不要對著復原用的複本啟動 server，因為啟動時可能會執行 migration 並寫入新的狀態。
