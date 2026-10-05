---
title: 活動紀錄
source: docs/user/activity-log.md
source_hash: 24b28b61ea9502bacd273730916f3badf101e478
---

在網頁版和桌面版，連續的工具呼叫會顯示成一則可以展開的摘要。展開它，可以查看指令、工具的輸入、狀態和結束代碼（exit code）。指令的原始輸出和工具結果的內容不會顯示。在檔案變更上使用 **Open diff**，可以檢視它的內容。

:::screenshot activity-log-summary
對話裡一則展開的工具呼叫摘要，列出其中的指令、狀態與結束代碼，檔案變更旁有 **Open diff**。
:::

T3 Orchestrator 的摘要會描述做了哪些動作，例如 **Ran 2 commands and sent messages to 3 threads**。對相同的對象重複傳送訊息時，兩個數字都會顯示：**Sent 5 messages to 2 threads**。建立 Thread 的數量，算的是工具回傳的 Thread 數，批次建立的也包含在內。

包含很多種活動的群組，最多會顯示兩個具體的動作類別，再加上其餘動作的數量。指令、檔案變更和 orchestration 變更的優先順序，高於讀取和狀態檢查。展開群組就能看到完整的列表。

失敗的呼叫不會算進成功的訊息或建立數量。等待某個 Thread，不代表它已經完成；送出中斷或取消的請求，也不代表那個 Thread 已經停下來。無法取得工具的詳細資料時，摘要會改用比較籠統的描述，而不是去猜測影響了多少個 Thread。

:::plain 摘要只說「做了什麼動作」，不保證「結果如何」
摘要是依照 agent 呼叫了哪些工具整理出來的。看到「等待了某個 Thread」，只表示 agent 做過等待這個動作，那個 Thread 可能還在跑；看到「送出了中斷請求」，只表示請求送出去了，對方不一定已經停下來。想確認實際結果，要展開群組看每一筆的狀態，或是直接去看那個 Thread。
:::
