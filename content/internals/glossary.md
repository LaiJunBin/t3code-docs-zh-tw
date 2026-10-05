---
title: 術語表
source: docs/internals/glossary.md
source_hash: 88c2b6057d7e37a3c707e6b9534734e5c901d05e
---

這裡列出在整個 T3 Code 裡意義都很重要的術語。架構與生命週期方面的限制屬於[架構總覽](./overview.md)，不放在這些定義裡。

## Workspace 與對話 {#workspace-and-conversation}

| 術語                             | 意義                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Environment（環境）              | 一個執行中的 server，加上它所擁有的機器、憑證、workspace 存取權與狀態。                                      |
| Client（用戶端）                 | 連到某個 environment 的網頁、桌面或手機 UI。桌面 app 也可以自己內建一個 server。                             |
| Project（專案）                  | 以某個目錄為根、屬於單一 environment 本機的 workspace 紀錄。                                                 |
| Workspace root（workspace 根目錄） | 專案在該 environment 上的基礎檔案系統目錄。                                                                  |
| Worktree                         | 一份獨立的 Git checkout，Thread 可以用它來取代專案的主要 checkout。                                          |
| Thread                           | 一個專案裡持久保存的對話與工作紀錄。Provider 行程結束後它仍然存在。                                          |
| Turn                             | 一次從使用者到 agent 的循環，也就是一個 V2 run。Provider 的工作可能在 checkpoint 和 diff 工作塵埃落定之前就結束。 |
| Activity（活動）                 | 時間軸上不屬於訊息的項目，例如工具動作、核准請求或失敗。                                                     |
| T3 home                          | 基礎資料目錄。Runtime 狀態通常放在它底下的 `userdata` 目錄。                                                 |

## Orchestration {#orchestration}

| 術語                                 | 意義                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Command                              | 要求變更領域狀態的請求。它被接受，不代表它的副作用已經完成。                                     |
| Event                                | 由 command 產生、已持久化的事實。                                                                |
| Orchestrator                         | 把 command 排成序列逐一處理，並根據目前狀態決定要產生哪些 event 的服務，過程中不做任何 I/O。     |
| Projection / read model（讀取模型）  | 目前狀態的持久化檢視，和改變它的 event 在同一個 transaction 裡提交。                             |
| Command receipt（command 收據）      | 一個 command 處理結果的持久紀錄，用來讓重試保持冪等（idempotent）。                              |
| Outbox effect                        | 和 event 一起提交的副作用意圖，例如啟動一個 Provider turn 或擷取一個 checkpoint。                |
| Effect worker                        | 在提交之後執行 outbox effect，並把結果以 command 的形式送回去的 worker。                         |

:::plain 這七個詞怎麼串起來
Client 送出 command，orchestrator 判斷之後產生 event。Event、projection、command receipt、outbox effect 是在同一個 transaction 裡一起寫進去的。之後 effect worker 才去執行 outbox effect 記下的副作用，並把結果再用 command 送回來。完整的說明在[架構總覽的「持久化的意圖與副作用」](./overview.md#durable-intent-and-side-effects)。
:::

## Provider 與 checkpoint {#providers-and-checkpoints}

| 術語                                     | 意義                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Provider                                 | T3 Code 所控制的 agent runtime，例如 Codex 或 Claude Code。                                        |
| Driver                                   | 針對某一種 Provider 的整合實作。                                                                   |
| Provider instance（Provider 實例）       | 一份設定好的 Provider，有自己的設定與生命週期。多個 instance 可以使用同一個 driver。               |
| Adapter                                  | 把 Provider 的原生協定轉譯成 T3 Code 的操作與 event 的那道界線。                                   |
| Session                                  | 附掛在某個 Thread 上的 Provider runtime。Session 可以停止再恢復，不必刪除 Thread。                 |
| Runtime mode（runtime 模式）             | Thread 的權限政策。參見[權限模式](../user/permission-modes.md)。                                   |
| Interaction mode（互動模式）             | agent 處理任務的方式，例如先做規劃。它和權限政策是分開的。                                         |
| Checkpoint                               | 儲存下來的 workspace 狀態，用於產生 diff 與還原，以隱藏的 Git ref 保存。                           |
| Checkpoint baseline（checkpoint 基準）   | 在要比較的那段工作開始之前所擷取的 workspace 狀態。                                                |
| Turn diff                                | 歸屬於某一個 turn 的 workspace 變更。                                                              |

## Pull request {#pull-requests}

| 術語                                         | 意義                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request link（PR 連結）                 | 持久化的 Thread 關聯，以 host、repository 和編號來識別。連結可以在同一個 environment 內跨專案，並帶有一份由 server 維護的 snapshot。                                         |
| Pull request sync（PR 同步）                 | 一個 worker：每個週期把每一個不重複的已連結 review 各重新整理一次，並找出原生的 stack 層。明確要求的重新整理，以及失敗的 stack 讀取，都會再觸發一次讀取。                    |
| Current pull request（目前的 pull request）  | 給單一 review 的控制項和舊版 client 使用的那個連結。尚未結束的工作優先；已完成的單一鏈會指向它最上面那一層。彼此無關且已終結的連結，則採用最近更新的那一個。                 |

## Composer context {#composer-context}

| 術語                                   | 意義                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Context record（context 紀錄）         | 訊息輸入框（composer）裡一個 chip 背後的具型別 payload，在 `message.context.records` 裡以 `contextId` 為鍵。它絕不存放位元組資料。 |
| Context reference（context 參照）      | 一筆 record 在訊息文字裡的一次出現：`[label](t3-context://v1/<kind>/<contextId>)`。多個 reference 可以共用同一筆 record。        |
| Attachment binding（附件綁定）         | 從一筆圖片或檔案 record 連到它那個由 server 擁有的附件的連結。附件 ID 可以改變，而 `contextId` 不變。                            |
| Attachment inventory（附件清單）       | 顯示在文字上方、以縮圖呈現的有序圖片 record，也包含沒有任何行內 reference 的圖片。                                               |

合約與生命週期請看 [composer context references](./composer-context-references.md)。
