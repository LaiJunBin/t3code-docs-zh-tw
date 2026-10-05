---
title: 歡迎精靈
source: docs/user/welcome-wizard.md
source_hash: 816a24e7d8447bed50d5d8ea4fd17305c7c1649e
---

當你開啟一個全新安裝的 T3 Code，或是第一次連到代管的網頁版 app 時，T3 Code 會顯示一個設定流程。既有的 workspace 會跳過這個流程。

## 連接你的電腦 {#connect-your-computers}

選擇一台或多台要設定的電腦。如果你是直接從某個 server 或桌面版 app 開啟 T3 Code，那台電腦就已經連上並選好了。畫面上是用電腦的名稱來標示它，這個名稱可能和你開瀏覽器的那台裝置不一樣。

繼續之前，你可以再加入更多電腦：

- **T3 Connect** 會連接已登入你帳號的電腦。在每一台想加入的電腦上[安裝 CLI](./install.md#command-line) 並執行 `t3 connect`，然後啟動 T3 Code 或執行 `t3 serve`，讓那台電腦保持可用。
- **Add a computer** 會直接連到你的網路或 tailnet 上的某個 server。先用 `t3 serve` 啟動 server，再執行 `t3 pair --tailscale`，然後貼上配對連結。如果 server 在你的網路上已經連得到，也可以執行 `t3 serve --host <address>`，再使用 `t3 pair`。

:::example 用 T3 Connect 把另一台電腦加進來
假設你想把一台遠端開發機也加進設定流程。在那台開發機的終端機依序執行：

```bash
curl -fsSL https://t3.codes/install.sh | sh
t3 connect
t3 serve
```

`t3 connect` 會帶你完成登入。只儲存登入資料並不會讓那台機器連得到，所以最後還要用 `t3 serve` 把 server 啟動起來。之後回到歡迎精靈，登入同一個帳號，那台電腦就會出現在清單裡。更完整的說明見[遠端存取](./remote-access.md#t3-connect)。
:::

已儲存的電腦，以及透過 T3 Connect 找到的電腦，預設都會被選取。不想設定的就取消勾選；取消勾選並不會中斷它們的連線。選取的電腦都連上之後就可以繼續。設定流程會檢查所有選取電腦上的 agent，接著依電腦分組，讓你匯入專案。

如果 T3 Code 在啟動時無法確認 workspace，設定流程會顯示 **Still connecting**，而不會開啟 app。選擇 **Reload** 再試一次。

如果 T3 Code 讀不到你儲存的設定，會顯示 **Could not read settings**。等儲存空間可以使用之後，選擇 **Retry**。設定流程不會用預設值去取代讀不到的設定。

## 檢查你的 agent {#check-your-agents}

T3 Code 會在每一台選取的電腦上檢查 Claude Code 和 Codex。如果某個 agent 還沒安裝或還沒登入，選擇它對應的動作，就會開啟一個終端機，裡面已經備好正確的指令可以執行。安裝時使用的是廠商自己的安裝程式，這樣 Settings 裡的 **Update now** 才能繼續正常運作。其他 Provider 可以在 Settings 裡啟用。

:::screenshot welcome-wizard-agents
歡迎精靈的「檢查 agent」步驟，列出 Claude Code 與 Codex 的安裝及登入狀態。
:::

設定用的終端機，會使用所選 Provider instance 設定的家目錄和環境變數。機密的值在 Settings 和終端機的 metadata 裡仍然會被遮蔽，但終端機的行程本身可以使用它們。

## 匯入你的專案 {#import-your-projects}

T3 Code 會找出 Claude Code 或 Codex 用過的目錄。Git repository 排在最前面，最近有活動的在最上方。當 remote 在 GitHub 上時，群組會以 `owner/name` 的形式顯示這個 repository。remote 相同的多份 clone 會歸在同一個群組。不是 git repository 的目錄則放在「Other folders」底下。

預設選取的是最近 30 天內有活動、而且至少有三段對話的 git repository。用核取方塊，或是「Select all」和「Select none」來調整選取範圍。連結的 git worktree、`Documents/Codex` 底下的 Codex 暫存目錄，以及 `Downloads` 底下的任何東西，都不會列出來讓你選。

:::screenshot welcome-wizard-import
歡迎精靈的「匯入專案」步驟，Git repository 依最近活動排序並附上核取方塊，下方是「Other folders」群組。
:::

很大或格式有問題的歷史紀錄可能會碰到掃描上限。T3 Code 會保留已經找到的專案，並在專案或對話可能有遺漏時提出警告。

匯入的專案會包含最近 30 天內有活動的 Codex 和 Claude 對話。你可以在 T3 Code 裡接續這些對話。

對話匯入是盡力而為（best effort）。T3 Code 會保留使用者的第一則 prompt，以及其餘看得到的使用者訊息與 assistant 訊息中最新的那些，總共 200 則。它會略過工具活動和附件。對 Codex，只有在一個正規的 user event 和一個有效的共用 turn ID 指向同一個使用者 turn 時，它才會略過自動產生的設定用 context。意義不明確的舊格式 context，或是只出現在回應裡的 context，會留在匯入的對話裡，這樣 T3 Code 才不會誤刪使用者寫的文字。它一次讀取一段對話，並跳過大於 16 MiB 的檔案。格式有問題的紀錄會被忽略，無法讀取或無法解析的對話會被跳過。

:::plain 匯入進來的對話是「夠你接著做」的版本
匯入的目的是讓你能在 T3 Code 裡把舊對話接下去，不是完整搬家。每段對話最多留下 200 則訊息：你的第一則 prompt 一定會留著，其餘名額給最新的訊息。agent 當時呼叫工具的過程和附件都不會帶過來。
:::

每一次匯入，每個專案最多讀取 100 個對話檔案和 64 MiB，輸入紀錄最多 100,000 筆。對話很多時，再執行一次匯入就可以接著處理。已經完成的對話不會重複匯入。你也可以不管剩下的歷史紀錄，直接繼續。

你可以不設定 agent、不匯入專案就繼續，也可以用設定進度列回到前面的步驟。匯入正在進行時，會暫時無法切換步驟。
