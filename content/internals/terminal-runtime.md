---
title: 終端機 runtime
source: docs/internals/terminal-runtime.md
source_hash: ca5f0d46ead6e5eed89c61ce5a23ff2d2ca587fe
---

Environment server 擁有 PTY、session 的生命週期，以及保留下來的輸出。每個 client，包括桌面版的 renderer，都是透過 environment 連線來附掛（attach）。這讓 client 可以重新連線，或共用一個執行中的 session。Renderer 的選擇是各個 client 本機的事，不會改變終端機的合約。

## 輸出與保留 {#output-and-retention}

[終端機歷史](../../apps/server/src/terminal/Manager.ts)是遞增式的。PTY 的 callback 把新的 chunk 附加上去；即時 event 只帶這些 chunk。如果每次 callback 都把完整的 scrollback 具體化或複製一份，輸出的成本就會隨著保留的歷史一起成長，所以只有 snapshot 和合併後的持久化，才是把內容具體化的時機。持久化是把可變的歷史 buffer 排進佇列，等到寫入真正執行時才讀取它最新的值。Clear、restart 和 close 都必須先把寫入 drain 完，才能完成它們各自的生命週期界線。

:::plain 為什麼不每次都整份處理
終端機一有輸出，callback 就會被呼叫一次，次數非常多。如果每次都把累積到現在的全部歷史重新組一份，歷史越長，每一次輸出就越貴。所以平常只處理「這次新增的那一小段」，只有在真的需要整份內容的時候（產生 snapshot、寫入磁碟）才組起來。
:::

Server 的歷史上限是每個終端機 5,000 行，以及 8 MiB 的 UTF-8 文字，所以一條很長、沒有換行的輸出也沒辦法繞過保留上限。淘汰時會移除最舊的輸出，而且不會把 Unicode code point 切開；即時輸出不會被截斷。被丟棄的 chunk 參照要立刻釋放，即使陣列的壓實（compaction）是之後才做。Client 的 buffer 另有 512 KiB 的上限。修改這條路徑時，要在 scrollback 全滿的情況下量測吞吐量。

還原時，只能讀取目前或舊版歷史檔案有上限的尾端，跳過任何不完整的 UTF-8 開頭，並套用行數上限。在重寫這個已截短的檔案之前，要先關閉讀取用的 handle。把整個舊 log 讀進來的話，啟動期間的記憶體上限就形同虛設。

## Renderer 的歸屬 {#renderer-ownership}

Android 和網頁版使用同一套 `libghostty-vt` C ABI 來實現終端機行為。繪製和輸入的整合由各平台的 adapter 負責，React 不介入終端機的畫面更新（frame）。網頁版的 adapter 在每個瀏覽器分頁裡共用一個 WebAssembly instance，而每個終端機各自擁有並釋放自己的 handle。正式的 upstream 版本釘選（pin）在 [`native/libghostty-vt/VERSION`](../../native/libghostty-vt/VERSION)；它一變動，原生和網頁的產出物都必須重新建置。網頁版會把 revision 嵌進它的建置資訊，這樣 ABI 檢查不需要第二個 pin 就能偵測到版本落差。

還原 scrollback 時，不可以把終端機的回覆送給目前的 shell。否則歷史裡的裝置查詢可能引發新的回覆，在提示字元處顯示成一堆亂碼。Server 會從保留的歷史裡去掉查詢／回應的流量，而[網頁版 renderer](../../apps/web/src/terminal/ghostty/core.ts) 在 replay 期間會把它的 PTY writer 卸離。修改保留機制或 renderer 的程式碼時，這兩道保護都要保留。

:::plain 提示字元前面那串亂碼是怎麼來的
有些程式會向終端機發出查詢，終端機會自動回覆。把舊的輸出重播一次時，裡面的舊查詢又會讓終端機再回覆一次，這些回覆就被送進現在的 shell，看起來像有人在提示字元打了一串怪字。所以有兩道防線：server 存歷史時先把這類查詢和回應拿掉；網頁版重播時，暫時不把終端機的回覆送出去。
:::
