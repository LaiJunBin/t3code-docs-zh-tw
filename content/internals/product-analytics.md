---
title: 產品分析
source: docs/internals/product-analytics.md
source_hash: e9123640a541a411038e51c65ed3cbfe8d5c01bb
---

對於每一個連線的 client，PostHog 的遞送、退出（opt-out）和身分都由 server 負責。[身分的選擇](../../apps/server/src/telemetry/Identify.ts)會把可用的 Provider 帳號 ID 做雜湊，沒有的話就退回使用以安裝為範圍的 ID。這個身分可以橫跨好幾個 client；它並不識別某一個瀏覽器 session。Client 不會載入 PostHog 的瀏覽器 SDK。Client 使用類的 event 需要有經過驗證的連線，所以只是造訪託管的 app 而沒有連線，不會被算成使用了產品。

## 歸屬的界線 {#attribution-boundaries}

Client 的維度（dimension）屬於該 event 的那一條 WebSocket 連線。如果在 server 上用一個全域的「目前的 client」，同時進行的 web、desktop 和手機使用就會被歸到錯的地方。Provider 的執行有它自己的 event，因為一個 turn 的存活時間可能比發出請求的那條連線還長。

Client 和 server 的維度要分開。一台 desktop host 可以服務一支手機或一個遠端的瀏覽器，而一條直接連線也可能跨越網路。較舊的 client 會省略 metadata。缺少的 client 值必須維持未知，而不是用 server 的屬性去回填。舊有的 `clientType` 屬性描述的是 server 的執行方式；要描述連線的 client，請用 `surface`。

:::plain 「誰在用」和「跑在哪」是兩件事
一台桌面電腦上的 server，可能同時被手機、另一台電腦的瀏覽器連進來用。所以 server 自己是什麼型態，不能拿來推斷使用者用的是哪一種 client。client 的資訊只記在它自己那條連線上；舊版 client 沒有回報的，就留空，不要拿 server 的資料去填。
:::

## 解讀 event {#interpreting-events}

活躍使用的報表請用 `client.turn.requested`。`client.connected` 會把重新連線也算進去，所以網路狀況可能讓它虛增。同一個身分在一段期間內可能出現在好幾個 client 群組裡；把這些群組相加會重複計算使用者。

Provider 的送出次數和完成次數不一定會相等。Provider 可能在沒有送出請求的情況下，產生合成的（synthetic）turn。收集是盡力而為的，不會去掃描或回填 Provider 的歷史。

Token 總數涵蓋的是主要的 agent。因為有子 agent 和模型改道（rerouting），一個 turn 無法代表某一組 Provider / 模型組合的完整成本。要做 Provider 之間的比較時，必須要求：用量資料完整、沒有觀察到 subagent、沒有混用模型；並且比較的對象要有相同的模型、effort、interaction 模式和終止狀態。彙總的 output / input 比值，應該用加總後的總數去相除。如果改成把每個 turn 的比值拿來平均，input 很小的 turn 會主導結果。

:::plain 比值要先加總再相除
舉個假設的例子：A turn 的 input 是 10、output 是 100（比值 10）；B turn 的 input 是 10,000、output 是 5,000（比值 0.5）。把兩個比值平均會得到 5.25，看起來 output 遠多於 input；但加總後相除是 5,100 ÷ 10,010，大約 0.51。前一種算法被 input 很小的 A turn 拉走了，所以報表要用後一種。
:::

未知的計數要維持「不存在」。部分的用量資料包含有效的、觀察到的計數，但無法確立整個 turn 的總數。修改 token 正規化或製作報表時，要保留這些區別。

## 遞送 {#delivery}

一次送出可能在 PostHog 已經存下那個批次之後才失敗，所以每一次重試都是一份複本。[遞送](../../apps/server/src/telemetry/AnalyticsService.ts)會在記錄每個 event 時就給它一個 uuid，在送出失敗之後退避（back off），並在嘗試幾次之後丟棄那個批次。沒有這些限制的時候，曾經有一個卡住的批次每秒被送出一次，持續了好幾天。

## 收集的界線 {#collection-boundary}

分析用的 payload 只能包含產品 metadata 和正規化後的量測值。不要送出 prompt、驗證資料、Provider 的原始 payload、使用者自訂的裝置名稱，或是對話識別碼。Client metadata 是盡力而為的；無效的值不可以讓連線被拒絕。PostHog 的 person profile 維持停用。
