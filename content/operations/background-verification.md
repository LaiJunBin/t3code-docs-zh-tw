---
title: 背景工作的實機驗證
source: docs/operations/background-verification.md
source_hash: 6d68e974bf0a121203ca93616dfbcd628132d3d2
---

請在 repository 根目錄執行，需要 Node 24 並且已安裝相依套件。這會用到真正的 Provider CLI 憑證，並且會消耗模型用量：

```sh
node apps/server/scripts/verify-background-live.ts --repeat 2
```

每個情境都會在一個全新的暫時 T3 home 和 Git 專案裡啟動正式版的 server。它透過經過驗證的 HTTP，以及和 client 相同的具型別 WebSocket RPC 合約來連線。過程中沒有替換過的 adapter、沒有 in-memory 資料庫，也沒有預先塞入的 projection 資料列。既有的 T3 environment 不會被修改。

這些情境演練的是：父層結束自己的 turn 之後，委派出去的工作才完成；把結果送進一個正在進行中的前景 command；原生背景 command 的喚醒；以及巢狀的委派結果。一個本機的 HTTP request 會把實際的背景 command 卡住，直到觀察到父層進入要求的狀態為止。它的隨機回應不會放進父層的 prompt。要通過，agent 必須取回那個結果、確認（acknowledge）它，然後結束；只有送達回條（delivery receipt）是不夠的。

:::plain 為什麼要用隨機回應
背景 command 拿到的回應是隨機產生的，而且沒有寫在 prompt 裡，所以 agent 沒辦法從 prompt 得知答案。驗證腳本會檢查 agent 的回覆裡有沒有出現這個值，有出現才算它確實取回了背景工作的結果。
:::

斷言還會檢查：task result 的發布、確認狀態、通知是具型別的通知而不是多出來的 user-message 項目、run 的邊界，以及 Provider 的背景名單是空的。成功的情境會重新啟動真正的 server，檢查確認狀態有保留下來，而且 run 仍然是已完成。這是「正常重新啟動後資料是否持久化」的檢查，並不能證明在送達過程中當掉時能夠復原。

用 `--scenario idle|active|native|nested`、`--model`、`--provider`，以及以秒為單位的 `--timeout` 來縮小執行範圍。預設的 Provider 是 `claudeAgent`，預設的模型是 `claude-sonnet-4-6`。native 情境明確要求使用 Claude 的背景 Bash 工具；不要把它當成通用的 Provider 相容性檢查。active 的送達情境需要 Provider 支援 active steering。缺少身分驗證、不支援的能力、Provider 失敗，以及模型違反指示，都算失敗，絕不會被當成「略過但通過」。請檢視保留下來的 trace 來分辨是哪一種。

用一個真正會失敗的 HTTP 相依服務，來檢查驗證工具本身能不能偵測到失敗：

```sh
node apps/server/scripts/verify-background-live.ts --scenario active --fail-gate
```

這個指令必須以非零的結束碼結束。不可以把它算成一次通過的產品測試。

:::note 這一步測的是驗證工具，不是產品
加上 `--fail-gate` 之後，腳本裡那個本機 HTTP 服務會故意回應 503，agent 拿不到真正的結果，這次執行就應該被判定為失敗。如果這個指令反而成功結束，代表驗證工具沒有偵測到這個失敗。
:::

每次執行都會印出它的證據目錄。裡面保留了 SQLite 資料庫、原生的 Provider log、串流的 event、最終的 projection、prompt、revision 與有未提交變更的檔案清單，以及機器可讀的判定結果。Suite 報告會連結到每一次嘗試，包括失敗的；重跑一次測試不會把先前的失敗抹掉。證據存在本機，可能含有 Provider 的輸出。不要把整個 T3 home 上傳。

這個驗證流程不會驗證以下項目：畫面上的折疊呈現、手機 UI、取消，以及在「Provider 已接受」到「receipt 已持久化」之間行程突然消失的情況。在宣稱已完整涵蓋背景工作的生命週期之前，這些都還需要另外的情境。
