---
title: 舊版 T3 Code 的 Thread
nav: 舊版 Thread 遷移
source: docs/user/thread-migration.md
source_hash: f01488e1a56ed9d43f9140c77a033ef75154d844
---

第一次啟動 V2 時，T3 Code 會把 V1 的資料庫 `state.sqlite` 複製成同一個資料目錄裡的 `statev2.sqlite`，然後對這份副本進行遷移。你的 Thread 會自動出現，完整的對話紀錄則在需要時匯入。你不需要執行任何匯入指令。

V1 會繼續使用它原本的資料庫，V2 則使用那份副本。資料庫的匯入可以在 V1 開著的時候進行。再次開啟 V2 時，會接續你在 V2 的歷史紀錄。複製只會發生一次：之後在任何一個版本裡新增的對話和變更，都不會同步到另一個版本。設定、附件和 workspace 的檔案則仍然是共用的。

:::plain 像是影印了一份筆記本
V2 第一次啟動時，把 V1 的筆記本整本影印一份，之後就在影印本上繼續寫。原本那本 V1 還在，也還能繼續寫，但兩本從影印的那一刻起就各寫各的，不會互相抄過去。所以升級之後如果又回去用 V1，在 V1 裡新開的對話不會出現在 V2。
:::

V2 的桌面版 app 使用另一個獨立的瀏覽器 profile，所以瀏覽器的 cookie 和快取不會從 V1 帶過來。在 app 裡開啟的網站，你可能需要重新登入。

遷移過來的 Thread 會保留它的標題、專案、Provider 與模型的選擇、權限模式與互動模式、分支或 worktree、封存狀態、settle（結案）狀態、snooze（暫時擱置）與 pin 狀態，以及連結的 pull request。T3 Code 也會帶入使用者和助理的訊息、它們的時間戳記，以及支援的附件。歷史紀錄很大時，可能會隨著 server 匯入對話紀錄而分批出現。

遷移不會重建舊 Provider 當時還在執行的 session。它也不會把舊的 run 紀錄、checkpoint 與 diff、工具活動、核准紀錄或提案計畫的歷史轉換成新格式。即使對話文字還在，這些項目也可能不會出現在遷移過來的時間軸上。

:::note 遷移後的舊 Thread 會少掉什麼
對話的文字都在，但「agent 當時執行了哪些指令、改了哪些檔案、每個 turn 的 diff」這類紀錄可能看不到。舊的 checkpoint 也沒有帶過來，所以不要期待能在遷移過來的 Thread 上，用舊的 checkpoint 把檔案還原到升級之前的某個時間點。
:::

## 繼續遷移過來的 Thread {#continuing-a-migrated-thread}

第一則新訊息會啟動一個全新的 Provider session。T3 Code 會用和切換 Provider 時相同的 [handoff 額度](./portable-handoffs.md)，挑選完整的使用者和助理訊息帶過去。被省略的文字仍然留在 Thread 裡，agent 可以去把它取回來。遷移另外保留了一份 32,000 個字元的復原用摘錄；這份摘錄和 handoff 都不會取代完整匯入的對話紀錄。

在繼續一個很長或很重要的 Thread 之前，請先讀過最近的對話紀錄，並把 agent 仍然需要知道的舊要求寫進你的下一則訊息。如果舊對話裡有互相衝突的指示，開一個新 Thread 並貼上一段簡短的交接說明，也是很好的做法。

:::example 繼續舊 Thread 時的第一則訊息
新的 Provider session 不一定會讀到很久以前講過的要求，所以把還有效的要求直接寫出來：

```text
接續之前的工作。提醒幾個先前約定、現在仍然有效的要求：
1. 只改 src/billing 底下的檔案，不要動共用的型別定義。
2. 所有金額都用整數的「分」來存，不要用浮點數。
接下來請完成退款流程的單元測試。
```
:::

## 保留一份復原用的副本 {#keeping-a-recovery-copy}

T3 Code 目前沒有匯出整個 Thread 的指令。在進行重大的 server 更新之前，請先停止 server，然後把它的 `userdata` 目錄複製到安全的位置。預設位置是 `~/.t3/userdata`；用 `--home-dir <path>` 啟動的 server 則使用 `<path>/userdata`。

:::note 旗標名稱請以 `t3 serve --help` 為準
原文這裡寫的是 `--home-dir`，那是開發時用 `vp run dev` 啟動才有的旗標。正式安裝的 `t3` 指令裡，指定資料目錄的旗標叫做 `--base-dir`（等同於環境變數 `T3CODE_HOME`），執行階段的狀態一樣是存在它底下的 `userdata`。如果你當初有自訂資料目錄，備份的就是那個目錄底下的 `userdata`。
:::

:::example 備份預設位置的 userdata
先停止 server，再複製整個目錄。目的地的名稱可以自己取：

```sh
cp -a ~/.t3/userdata ~/t3-userdata-recovery-copy
```
:::

如果某個遷移過來的對話紀錄在 app 裡不見了，請讓那份副本保持原樣。你可以在不對它啟動 server 的情況下，檢視舊的對話紀錄：

```sh
sqlite3 -readonly /path/to/recovery-copy/state.sqlite
```

在 SQLite 的提示字元下，列出最近的舊版 Thread：

```sql
.headers on
.mode tabs
SELECT thread_id, title, updated_at
FROM projection_threads
ORDER BY updated_at DESC;
```

然後印出其中一份對話紀錄，把 `<thread-id>` 換成第一個查詢得到的值：

```sql
SELECT role, text, created_at
FROM projection_thread_messages
WHERE thread_id = '<thread-id>'
  AND role IN ('user', 'assistant')
ORDER BY created_at, message_id;
```

只開啟複製出來的那個資料庫。不要編輯它，也不要讓較新或較舊的 server 指向你的復原用副本。如果受影響的 environment 在遠端，請在執行那個 environment 的機器上製作並檢視副本。
