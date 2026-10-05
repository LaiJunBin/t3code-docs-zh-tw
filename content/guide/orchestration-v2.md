---
title: Orchestration V2 導讀
nav: Orchestration V2 導讀
---

Orchestration V2 是一組共九份的設計文件，說明 T3 Code 的 orchestrator（負責協調 Thread、Provider 與各種執行工作的核心）要怎麼重寫。這是全站最難讀的一批文件，這一頁幫你決定要不要讀、該從哪裡讀起。

## 讀之前先知道三件事 {#before-you-read}

**一、這是設計規格，不是使用說明。** 只是想使用 T3 Code 的話不需要讀。想參與開發，而且要動到 server 的 orchestration 相關程式碼時，才需要讀。

**二、它描述的是「目標架構」。** 總覽頁一開頭就說明，這組文件刻意不討論遷移與向後相容。所以文件寫的內容，不一定等於目前程式碼的實際行為。本站在每一頁開頭都放了提醒。

**三、有兩頁其實也在講現況。** [Orchestrator MCP Server](../orchestration-v2/orchestrator-mcp-server.md) 整頁的寫法是在描述已經存在的程式，還列出了程式碼位置。[Thread 譜系與 context transfer](../orchestration-v2/thread-lineage-and-context-transfer.md) 則有一節專門交代目前實作到哪裡。讀這兩頁時，請留意哪些段落是在講設計、哪些是在講現況。

想了解目前程式碼實際的運作方式，請先讀[架構總覽](../internals/overview.md)。

## 先認識五個名詞 {#five-terms}

V2 文件一開始就會出現一整串新名詞。下面是最核心的五個，以及它們跟你已經認識的詞的關係：

| V2 的名詞         | 意思                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `AppThread`       | 使用者在 T3 Code 裡看到的那段對話，也就是平常說的 Thread。           |
| `Run`             | 使用者看得到、會被計數的一個 turn。                                  |
| `ExecutionNode`   | 一個 run 裡面的一個工作單位，例如一次工具呼叫、一次核准請求、一個 subagent。 |
| `ProviderThread`  | Provider 那一邊原生的對話代號。                                      |
| `ProviderSession` | 一個正在執行、或可以恢復的 Provider 行程。                           |

貫穿整組文件的核心想法是：**T3 Code 自己發的 id 才是身分，Provider 給的 id 只是對照用的參照。** 這樣一來，不管 Provider 怎麼運作、甚至中途換了一個 Provider，使用者看到的 Thread 都還是同一個。

## 建議的閱讀順序 {#reading-order}

### 第一步：建立整體概念 {#step-1}

1. [總覽](../orchestration-v2/README.md)：說明 V2 是 orchestrator 的重寫，而不是整個 app 的重寫，並列出主要目標和十條關鍵的不變條件。一定要先讀這一頁。
2. [核心圖與資料模型](../orchestration-v2/core-graph-and-data-model.md)：逐一定義每一種實體和它的欄位。這是整組文件的詞彙基礎，其他幾頁都會回頭引用這裡的名稱。篇幅最長，第一次讀可以先看前半的實體定義，後半的 projection 等用到再回來查。

### 第二步：看功能實際怎麼運作 {#step-2}

3. [功能生命週期](../orchestration-v2/feature-lifecycles.md)：逐項說明使用者實際會用到的功能在 V2 裡的流程，包括建立 Thread、送出訊息、在 agent 工作途中 steer 或排隊、換 Provider、fork、中斷、恢復、checkpoint 與 rollback、核准請求與提問。想知道「按下某個按鈕之後，系統內部依序發生什麼事」的話，這一頁最有幫助。

### 第三步：依你要改的部分選讀 {#step-3}

| 你要處理的事                           | 讀這一頁                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| 接新的 Provider，或修改 adapter        | [Provider 能力系統](../orchestration-v2/provider-capability-system.md)、[實體 ID 與關聯](../orchestration-v2/entity-ids-and-correlation.md) |
| Fork、subagent、把成果併回原本的 Thread | [Thread 譜系與 context transfer](../orchestration-v2/thread-lineage-and-context-transfer.md) |
| 對話中途切換 Provider                  | [切換 Provider 與 context handoff](../orchestration-v2/provider-switching-and-context.md)  |
| 讓 agent 能夠委派工作、操作其他 Thread | [Orchestrator MCP Server](../orchestration-v2/orchestrator-mcp-server.md)                  |
| 寫測試                                 | [測試策略](../orchestration-v2/testing-strategy.md)                                        |

## 各頁在講什麼 {#summaries}

**[Provider 能力系統](../orchestration-v2/provider-capability-system.md)**：主張不要依 Provider 的名稱寫條件判斷，而是讓每個 adapter 宣告自己有哪些能力。文件列出每一類能力的旗標、缺少某項能力時的降級做法，以及 UI 該如何依能力決定要顯示哪些操作。

**[實體 ID 與關聯](../orchestration-v2/entity-ids-and-correlation.md)**：說明每樣東西都用 T3 Code 自己發的 id 當身分。內容包括 Provider 沒有提供穩定 id 時要怎麼配置 id、指令如何從 app 的 id 轉成 Provider 的參照，以及為什麼同一份 Provider 輸出重跑一次必須得到相同的 id。

**[Thread 譜系與 context transfer](../orchestration-v2/thread-lineage-and-context-transfer.md)**：主張 fork、換 Provider 接手、把 fork 的成果併回來源、subagent，其實都是同一種模型：兩個 Thread 之間的一層關係，加上來源的某個時間點，再加上「需要時才做」的上下文轉移。

**[切換 Provider 與 context handoff](../orchestration-v2/provider-switching-and-context.md)**：說明同一段對話中途換 Provider 時，上下文該怎麼帶過去。建議的預設做法是：回到用過的 Provider 時接回它原本的對話，再補上一份「你不在期間發生了什麼」的摘要。

**[Orchestrator MCP Server](../orchestration-v2/orchestrator-mcp-server.md)**：說明 T3 Code 如何透過自己的 MCP endpoint，把 orchestration 的操作開放給 agent 使用，讓 agent 可以把工作委派給子 Thread、建立或啟動一般的 Thread、讀取其他 Thread、送訊息、等待與中斷。

**[測試策略](../orchestration-v2/testing-strategy.md)**：規定 V2 要用少量、高價值的整合測試來驗證，而不是大量把行為 mock 掉的單元測試。做法是把事先錄好的 Provider 原始紀錄拿來重播，而 orchestrator、adapter、projection 等核心邏輯都要真的執行。

## 讀的時候會遇到的不一致 {#known-inconsistencies}

這組文件還在快速變動，各頁之間有幾處彼此對不上。譯文都照原文翻，沒有擅自調和。遇到時請以程式碼為準：

- `ContextHandoff` 在「Thread 譜系」和「切換 Provider」兩頁裡的欄位定義不同。
- 「核心圖與資料模型」的實體摘要，和同一頁後面的型別定義，有幾個欄位名稱不一樣。這一頁還提到一個 `countsForConversation` 欄位，但 `Run` 的型別定義裡沒有它。
- 「Orchestrator MCP Server」說提供十一個工具，但底下列了十二個。
- 「測試策略」裡錄製 replay 的指令，有的寫 `bun run`，有的寫 `pnpm --filter`。
