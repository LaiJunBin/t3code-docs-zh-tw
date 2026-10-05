---
title: Server 更新
source: docs/internals/server-updates.md
source_hash: e40675a14162de14267f908405b773231f033e85
---

一個[穩定的 launcher](../../apps/server/src/serviceLauncher.ts) 擁有由 systemd 或 launchd 所選定的 runtime。在執行期間，它是唯一會寫入持久 service 狀態的角色。Server 子行程透過繼承來的 IPC 提出更新請求；它們絕對不會改寫自己的 service 定義，也不會自己挑選替代者。本機的 service 指令可以在 service 停止的時候，替換 launcher 和狀態。前景執行的 CLI 行程不會自我更新。

安裝時指定確切的版本，讓重新啟動不受 npm 快取被清除或 release tag 移動的影響。安裝和 preflight 都在 staging 裡進行，之後才發布成一個不可變的 runtime。Preflight 會檢查 launcher 協定，因為一個需要新的 rollback 保證的目標版本，無法安全地在較舊的 launcher 底下執行。要升級那個 launcher，需要做一次本機的 service 更新。

:::plain launcher 是什麼角色
Launcher 是一個穩定不動的程式，由系統的服務管理員（systemd 或 launchd）啟動，再由它去啟動真正的 server。更新時是 launcher 負責換掉 server，server 只能向它「提出請求」，不能自己換自己。這樣一來，新版 server 起不來的時候，還有一個沒被動到的角色可以把舊版叫回來。
:::

## Commit 界線 {#commit-boundary}

Launcher 會先把待處理的更新持久記錄下來，然後才確認收到，接著停止舊的子行程，並以試行（trial）的方式啟動目標版本。Service 狀態的寫入方式是在同一個目錄裡做替換，並對檔案和目錄都做 fsync。狀態無效時會停止啟動，而不是去猜該啟動哪一個 runtime。

試行版本必須完成 migration、取得相依資源、綁定 HTTP，並把每一個長時間執行的 root 都停在啟用閘門（activation gate）前，之後才能回報 `prepared`。接著 launcher 把目標版本持久地 commit，並回覆 `committed`。只有到這個時候，子行程才可以放開閘門、接受 command 並發布 ready。可能失敗的啟動期資源取得，都要放在這條界線之前。光是有一個 listener，並不能證明 runtime 已經準備好可以 commit。

失敗或逾時的試行會回到舊版本。Commit 之後，目標版本就是權威版本，接下來適用服務管理員一般的重新啟動策略。

:::plain 更新的順序
1. Launcher 把「要更新到某版」寫進磁碟，然後才回覆收到。
2. 停掉舊 server，用試行的方式啟動新版。
3. 新版把所有可能失敗的啟動工作做完，但先不開始接受工作，回報 `prepared`。
4. Launcher 把新版寫成正式版本，回覆 `committed`。
5. 新版這時才真正開始服務。

第 4 步之前任何地方失敗或逾時，都會退回舊版。
:::

## 資料庫 rollback {#database-rollback}

舊的子行程結束之後，launcher 會對 SQLite 的主檔、WAL 和 shared-memory 檔做 snapshot。這讓試行期間的 migration 可以復原，不需要寫 down migration。每次更新只做一次 snapshot，而且它在 launcher 重新啟動之後仍然存在；如果在重試時換掉它，可能會把失敗的試行所造成的變更也拍進去。

Rollback 會先停止試行版本再做還原。一個持久的還原標記（restore marker），會讓被中斷的還原在任何一個版本啟動之前先做完。Snapshot 要一直保留到 commit，或是保留到還原結果和最終的 rollback 狀態都已經持久化為止。附件以及 SQLite 之外的其他檔案，不在這個 rollback 界線之內。

:::note 寫 migration 時要知道的範圍
更新失敗時能自動還原的只有 SQLite 資料庫。如果啟動過程還改了資料庫以外的檔案（例如附件），rollback 不會幫你還原那些檔案。
:::

## Client 的確認 {#client-acknowledgement}

更新被接受，仍然只是待處理狀態。Client 重新連線之後，會把 launcher 的 update ID 和 ready event 對應起來，然後檢查結果和目標版本。光是重新連上，無法分辨是替換成功還是已經 rollback。沒有 update ID 的舊版 server，則保留只依版本來對應的方式。

桌面版的更新另有一套兩階段的交接，因為安裝 app 會停止它內建的後端。準備階段會在連線還活著的時候回傳一個 token；client 只有在收到這個 token 之後才會 commit 它。否則後端一關閉，唯一一次成功的 RPC 結果就可能遺失。之後 client 必須在重新連線後觀察到準備好的那個版本。如果安裝失敗，桌面版會重新啟動被停掉的後端，並針對同一個 token 重播這次失敗。

## 復原被中斷的 Thread {#recovering-interrupted-threads}

重新啟動後接續執行（restart continuation）是一項由 environment 擁有的偏好設定，預設關閉。[V2 recovery service](../../apps/server/src/orchestration-v2/ProviderRuntimeRecoveryService.ts) 要求持久化的 run、Provider thread、session 和原生 resume 身分全部吻合。一般排在佇列裡的工作、已完成的 run，以及只有背景工作的情況，都不符合條件。

復原流程會把跟已遺失行程綁在一起的 effect 作廢，並把接續的意圖記錄在持久的 outbox 裡。這份意圖即使在 Provider 啟動之前又重新啟動一次，也仍然存在。接續用的 effect 會等待啟用；一個啟動很慢的 Provider，不可以拖延 server 的就緒，也不可以拖延 launcher 的 commit 界線。正常關機（graceful shutdown）時，會在關閉 Provider 之前先把意圖記下來，然後在 ingestion 停止之後再做對帳，這樣晚到的完成結果就不會被過時的取消蓋掉。

[Continuation handler](../../apps/server/src/orchestration-v2/RestartContinuation.ts) 在 dispatch 之前，會重新檢查偏好設定、封存狀態、Provider 的選擇，以及是否有更新的使用者工作。穩定的 command ID 和 message ID 可以避免 outbox 重試之後重複送出。Codex 在 resume 時不會加入 Provider prompt 文字；其他 adapter 則是透過它們一般的 turn 路徑收到接續訊息。
