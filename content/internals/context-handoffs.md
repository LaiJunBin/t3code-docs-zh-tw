---
title: Context handoff
source: docs/internals/context-handoffs.md
source_hash: 965a4623f796269afed6384a9f87d8a0994c3941
---

可攜式的 Provider handoff 和 fork handoff 都是文字摘要。它們並不宣稱和 Provider 原生的 context 完全對等。

`ContextHandoffServiceV2` 會納入使用者訊息、助理訊息、指令執行、檔案變更、checkpoint，以及先前的 handoff。其他類型的 turn item 會被略過。對於帶有文字的項目，`compactText` 會把每一段連續的空白換成一個空格，修剪結果的前後空白，並且最多傳回 240 個字元。被截斷的值包含前 237 個字元，後面接著 `...`。檔案變更帶的是檔名，而 checkpoint 只帶檔案的數量。

:::plain Handoff 交接的是什麼
把一個 Thread 交給另一個 Provider、或是把 fork 的結果併回來時，接手的一方拿到的是一份條列式的文字摘要，不是原本 Provider 內部的完整狀態。摘要裡每一則訊息、每一道指令都只留下開頭的一小段（最多 240 個字元），檔案變更只留檔名，checkpoint 只留「幾個檔案」。
:::

Provider handoff 使用的，要嘛是 app 裡所有符合條件的歷史紀錄，要嘛是「從那個 Provider 上次參與之後」的差異（delta）。Fork 併回（merge-back）的 handoff 則是摘要子 Thread 裡符合條件的差異項目。這兩條路徑都不會重建 Provider 原生的 session 狀態、工具狀態、核准請求，或是被省略掉的文字。

舊版 v1 的接續（continuation）使用另一套演算法。它只考慮使用者訊息和助理訊息，從最新的訊息往回走，在 32,000 個字元的預算內組出對話紀錄的結尾片段（suffix）。不要把這個遷移用的預算說成是可攜式 handoff 的上限，也不要把 240 個字元的前綴說成是遷移的規則。

:::note 兩個數字不要混在一起
240 個字元是「每一個項目」的截斷長度，用在可攜式 handoff。32,000 個字元是「整份對話紀錄」的預算，只用在從 v1 遷移過來的 Thread 第一次接續時。這是兩套不同的演算法，寫文件或改程式時不要把其中一個數字套到另一邊。v1 那一邊的細節見[舊版 orchestration 遷移](./legacy-orchestration-migration.md#first-continuation)。
:::
