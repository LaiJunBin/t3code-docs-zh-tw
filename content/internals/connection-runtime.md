---
title: 連線 runtime
source: docs/internals/connection-runtime.md
source_hash: 35c8b0a7365837aa1e9c00e28aea744f8e12ae21
---

網頁、桌面的 renderer 和手機，對每個 environment 都共用同一個連線擁有者，它放在 `packages/client-runtime`。平台程式碼負責提供儲存、憑證、網路訊號和應用程式生命週期事件。React 的 view 只是使用這個 runtime。把重試和 session 的生命週期放在這裡，可以避免多個 view 需要同一個 environment 時，出現互相競爭的重新連線迴圈。

## 只有一個負責傳輸層重試的擁有者 {#one-transport-retry-owner}

[Supervisor](../../packages/client-runtime/src/connection/supervisor.ts) 擁有傳輸層的重試策略；解析 endpoint 和開啟 RPC session 都只是單次嘗試。暫時性的失敗會以帶有 jitter 的指數退避（exponential backoff）重試，上限是五分鐘，而且只有在連線維持住之後才會重設。沒有 jitter 的話，一台重新啟動的 server 的所有 client 會在同一秒重新連線；上限太短的話，一個永遠連不上的 client 會整天不停重試。離線狀態和身分驗證失敗則是等待喚醒（wakeup），而不是在條件沒有改變的情況下浪費嘗試次數。

:::plain 重試策略白話版
連不上時，每次重試前等待的時間會越拉越長，最長等五分鐘，而且每次會加上一點隨機的時間差（jitter），讓很多 client 不會剛好同時重連。只有「連上而且撐住了」，等待時間才會歸零重算。如果問題是「沒網路」或「憑證不對」，再試幾次結果也一樣，所以乾脆停下來，等有新的訊號再試。
:::

回到前景、明確按下重試、以及收到離線回報，都只會去探測（probe）已經建立的 session，探測失敗才會重新連線。離線回報常常是錯的，例如對 loopback server 來說就是如此。手機在背景被長時間暫停是唯一的例外：這時會立刻換掉 session，因為作業系統可能砍掉 socket 卻不回報關閉，而探測會讓一條已經死掉的 socket 卡在「Resuming」直到逾時。即使網路回報離線，這次全新的嘗試還是會執行。回到前景也會立刻喚醒等待中的重試，但不會去動一個正在進行中的普通嘗試。

[Registry](../../packages/client-runtime/src/connection/registry.ts) 依 environment 來界定連線的範圍（scope）。非自願的斷線會保留註冊資料和快取資料。明確移除則會關閉這個 scope，並清除憑證、projection，以及草稿這類由平台擁有的狀態。雲端帳號的變更只套用到 relay 的註冊；不可以因此丟掉直接配對的 environment。

## HTTP 授權 {#http-authorization}

RPC session 是在 socket upgrade 的時候驗證身分，而 HTTP 請求需要從[授權服務](../../packages/client-runtime/src/authorization/service.ts)取得目前有效的憑證。為了更新 HTTP 憑證而換掉一條健康的 socket，會打斷對話，還會在沒有傳輸失敗的情況下改變 transport generation。憑證到期不會關閉 socket，而更新失敗是屬於那個 HTTP 操作的問題。

Session 列表在憑證到期之後，必須保留尚未被撤銷、仍在連線中的 session，這樣一條開著的連線才不會從連線管理介面裡消失。這並不會延長憑證的有效期限。新的 HTTP 請求和 socket upgrade 仍然需要有效的憑證。

## 傳輸層健康與資料新鮮度是兩回事 {#transport-health-and-data-freshness-are-separate}

Socket 開啟了，並不足以證明這個 environment 可以使用。[RPC session](../../packages/client-runtime/src/rpc/session.ts) 會等到收到最初的 server 設定之後才算就緒。接下來 shell 資料和 Thread 資料各自有自己的同步狀態。shell 訂閱失敗和連線健康是可以同時存在的；把這種狀態標成「reconnecting」，等於承諾了一次永遠不會發生的傳輸層重試。

:::plain 三層狀態不要混在一起
「socket 通了」、「server 設定收到了」、「畫面要的資料同步好了」是三件不同的事。連線本身沒問題、只是某個訂閱失敗時，不能跟使用者說「重新連線中」，因為根本沒有人在重新連線。
:::

快取的 projection 在離線時仍然可以讀取。它們不可以暗示目前有即時連線，也不可以在重新連線時蓋掉較新的即時資料。載入和恢復 snapshot 是共用狀態服務的工作，這樣每個 view 對「哪一份資料才是目前的」會有一致的認知。

[Thread detail](../../packages/client-runtime/src/state/threads.ts) 把訂閱的生命週期和快取的生命週期分開。已掛載（mounted）的使用者共用同一條即時串流，最後一個使用者卸載時串流就停止；隱藏但仍掛載的 route 也算在內。一個 registry 本機的快取會在閒置的五分鐘內保留狀態和它的 replay cursor，所以按返回時可以直接接續，不必再下載一次 snapshot。

桌面 app 多加了一個使用者：一個 [keep-alive](../../apps/web/src/state/threads.ts) 會在每個已啟用的 environment 裡，把所有 session 正在啟動或執行中的 Thread 都掛載起來。這樣打開一個執行中的 Thread 就不需要 replay。shell 串流和 detail 串流彼此獨立，所以 shell 可能在 detail 載入完成或追上進度之前，就先回報已停止。已停止的 Thread 會維持掛載，直到它自己的串流進入 live 狀態並顯示出停止為止，接著串流才會關閉，並把塵埃落定後的狀態存起來。網頁版和手機版不會讓 Thread 保持 alive。

只有在一次更新完成之後，才能把狀態和 cursor 一起保留下來。取消不可以讓快取的 cursor 超前於已套用的資料，舊的 scope 也不可以蓋掉後繼者的快取。重複使用時要保留分頁資料，但要清掉已取消的載入狀態。

:::note 動快取時要守住的不變條件
狀態和 cursor 必須是一對：cursor 指到哪裡，狀態就必須剛好套用到哪裡。所以更新做到一半被取消時，不要先把 cursor 往前推；scope 被換掉之後，舊 scope 晚到的寫入也不能蓋掉新 scope 的快取。
:::

[RPC boundary](../../packages/client-runtime/src/rpc/client.ts) 是在執行的當下，才對照目前的 session 去解析請求。持久的訂閱會跟著替換後的 session 走。傳輸失敗之後，它們會等待 supervisor；如果是預期中的領域失敗，則可以在同一條健康的 session 上重新訂閱。重新連線不會自動重播變更操作（mutation），它們的重試與冪等規則是由各個操作自己決定的。
