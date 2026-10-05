---
title: Antigravity
source: docs/user/providers-antigravity.md
source_hash: e28e9e06454f4518ddd2dea9dbcf77e2d5d53752
---

T3 Code 會在你選定的 environment 上執行 Google 官方的 Antigravity ACP agent。它有自己的登入，和 Antigravity IDE 或 CLI 的登入是分開的。透過這個 agent 能用哪些模型、帳號有哪些存取權，由 Google 決定。

## 設定 Antigravity {#set-up-antigravity}

在網頁版或桌面版開啟 **Settings > Providers**，選擇執行你專案的那個 environment，然後啟用 Antigravity。先在那裡安裝它的 runtime，再選 **Sign in** 並完成瀏覽器登入。請等 T3 Code 確認帳號存取權、載入模型之後，再開始 Thread。Runtime 安裝好之後，也可以從手機 app 的 **Settings > Provider accounts** 登入。

即使你離開設定頁或重新連線，安裝也會繼續進行。設定過程需要有操作該 environment 的權限；如果比較舊的 server 沒有提供 Antigravity 設定，請先更新它。

:::note 順序是：啟用、安裝 runtime、登入、等確認
Antigravity 不需要你另外去下載安裝程式，runtime 是從 T3 Code 的 Provider 設定裡安裝的。登入完成後先不要急著開 Thread，等設定頁顯示帳號已確認、模型清單也出來了再開始。
:::

### 從遠端裝置登入 {#sign-in-from-a-remote-device}

Google 登入完成後會返回一個 `127.0.0.1` 的位址。如果你的瀏覽器就在 environment 那台機器上，登入可以直接完成。從另一台裝置登入時，最後那個頁面通常會載入失敗，因為接收登入結果的 listener 是在 environment 上。

:::plain 為什麼最後一頁會打不開
`127.0.0.1` 的意思是「這台裝置自己」。等著接收登入結果的程式在 environment 那台機器上，但你的瀏覽器在另一台裝置上，瀏覽器去找「自己」當然找不到。所以頁面打不開是預期中的狀況，網址本身才是需要的東西，照下面的方式把它貼回去就好。
:::

把完整的返回位址（包括 `?` 後面的所有內容）複製起來，貼到你開始登入的那個 client 裡的 return URL 欄位，然後選 **Continue**。請保留原本的位址；不要把它換成 server 的主機名稱。只有那一個 T3 Code 登入 session 能完成這次登入。如果它過期了，請重新登入並使用新的連結。

:::screenshot antigravity-remote-sign-in-return-url
Antigravity 登入進行中的設定畫面，可以看到貼上返回位址的 return URL 欄位與 **Continue** 按鈕。
:::

返回的 URL 裡含有一組暫時的登入代碼。只能把它貼到設定用的那個欄位裡。光是 callback 頁面顯示成功，並不代表帳號存取權已經確認；請等 T3 Code 的確認。

### 其他登入方式 {#other-sign-in-methods}

在 Antigravity 的 Provider 設定裡選擇 **Sign-in method**：

| 方式                       | 憑證                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Google account             | 在瀏覽器裡用個人 Google 帳號登入                                                         |
| Gemini Enterprise          | 瀏覽器登入、GCP project，以及 GCP location                                               |
| Gemini API key             | API key；選擇 Connect，不需要瀏覽器                                                      |
| Agent Platform / Vertex AI | API key，或是 GCP project 與 location 搭配 environment 上的 Application Default Credentials |

Antigravity 的 API key 欄位，是以明文存在 environment 上的設定裡。Agent 使用的是這個 instance 所選的方式與憑證；環境中既有的 `GEMINI_API_KEY` 和 Google 憑證變數不會蓋過它們。變更登入方式會停止該 instance 的 session。要換帳號之前請先登出。

:::note 選哪一種方式也關係到怎麼計費
設定頁在 **Sign-in method** 底下的說明是：Google 帳號用的是你的訂閱，API key 和 Agent Platform 則是按用量計費。沒有特別需求的話，預設值就是 **Google account**。
:::

## Runtime 安裝 {#runtime-installation}

受管理的安裝支援 Apple Silicon 的 macOS、Linux x64 或 ARM64，以及 Windows x64 或 ARM64。Intel Mac 可以連到一個受支援的遠端 environment。請預留數 GB 的可用磁碟空間，Linux 上尤其需要。

### 使用手動安裝 {#use-a-manual-installation}

從[官方 ACP Registry](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json) 下載適用於你 environment 的壓縮檔。把 ACP 執行檔和它的 `localharness_external` helper 解壓縮到同一個目錄，兩者版本要相同。在 macOS 或 Linux 上要把兩個檔案都設成可執行；Windows 用的是 `.exe` 檔。

把 **Binary path** 設成 environment 上的 ACP 執行檔，之後的更新要自己處理。這一欄留空，就會使用受管理的 runtime；如果沒有安裝受管理的 runtime，則會使用 `PATH` 上相容的執行檔。

## 模型與 Thread {#models-and-threads}

模型清單來自你的 Antigravity 帳號，可能和其他 Antigravity app 裡看到的不同。接續的 Thread 會保留它所選的模型。如果你失去了那個模型的存取權，請先選另一個可用的模型再繼續。

規劃請用 Antigravity 原生的 `/plan` 指令。T3 Code 自己的 Plan 模式在這裡無法使用。工具的核准依循[權限模式](./permission-modes.md)。有固定選項的提問，即使在 **Full access** 下，也還是需要從提供的答案中選一個。

T3 Code 會保留對話歷史和檔案 diff，但 Antigravity 無法倒回它的對話。因此無法 revert Thread，也無法編輯先前的 turn 再重新送出。請用後續訊息接著做，或是開一個新 Thread。

:::plain 不能倒回是什麼意思
在支援倒回的 Provider 上，你可以回到某一則已送出的訊息、改寫後重送，讓對話從那裡重來。Antigravity 做不到這件事，所以發現方向錯了的時候，只能往下再送一則訊息請它修正，或是另開一個新 Thread 重新交代。
:::

### Skill 與附件 {#skills-and-attachments}

專案的 skill 請放在 `.agents/skills`。T3 Code 也會讀取 `.gemini/skills` 和舊版的 `.agent/skills` 目錄。在這幾個專案位置之間，同名的 skill 以先找到的那一份為準，順序是：`.gemini/skills`、`.agents/skills`、`.agent/skills`。叫用方式見[指令與 skill](./composer.md#commands-and-skills)。

所有專案都要用的 skill，放在 `~/.gemini/config/skills` 或 `~/.gemini/antigravity-cli/skills`。Antigravity 不會讀 `~/.agents/skills`，所以放在那裡的 skill 只有在專案本身就是你的 home 目錄時才會出現。

:::example skill 放哪裡才找得到
| 你想要的效果 | 放在哪裡 |
| --- | --- |
| 只給這個專案用 | 專案裡的 `.agents/skills` |
| 每個專案都能用 | `~/.gemini/config/skills` 或 `~/.gemini/antigravity-cli/skills` |

容易弄錯的是 `~/.agents/skills`：專案裡用的是 `.agents/skills`，但放到 home 目錄底下的同名位置，Antigravity 並不會去讀。另外，如果同一個專案的 `.gemini/skills` 和 `.agents/skills` 裡有同名的 skill，生效的是 `.gemini/skills` 那一份。
:::

Antigravity 會直接接收圖片。其他所有附件，包括 PDF、文字、音訊、壓縮檔和影片，都是以「已儲存的檔案路徑」的形式傳過去，讓 agent 用它的工具去檢視。傳了影片的路徑，並不代表啟用原生的影片輸入。

### Subagent {#subagents}

Antigravity 會把 subagent 的活動分批歸組。你無法開啟或控制個別的 subagent，而且某一批顯示為閒置，並不能確認裡面每個子工作都成功了。要在哪裡查看活動，見 [agent 的工作](./thread-sidebar.md#inspect-agent-work)。

## 帳號與移除 {#accounts-and-removal}

在網頁版或桌面版的 **Settings > Providers**，為每個 Google 帳號各新增一個 Antigravity Provider instance。每個 instance 有自己的登入；下載下來的 runtime 則是在該 environment 上共用。

| 動作                      | 效果                                                   |
| ------------------------- | ------------------------------------------------------ |
| Disable                   | 停止該 instance 的 session，並保留它的 Google 登入。   |
| Sign out                  | 停止該 instance 的 session，並移除它已儲存的 Google 登入。 |
| Remove downloaded runtime | 移除共用的安裝，並保留 Google 憑證。                   |

這三個動作都會保留 Thread 歷史和 workspace 的檔案。在 Thread 裡單獨送出 `/logout`，會把它的 instance 登出，連帶停止該 instance 的其他 session。要換帳號，請先登出，再重新登入。

移除受管理的 runtime 之前，請先停用使用它的 instance，並取消任何進行中的安裝。如果有明確指定的 binary path 指向那個 runtime 裡面，也請清掉。Runtime 還在使用中時，移除會被拒絕。

## 檢查存取權與疑難排解 {#check-access-and-troubleshoot}

Server 重新啟動後，你的 Google 登入仍然會保留。在某個 session、某次重新整理或某次登出回報新的狀態之前，Provider 顯示的都是已儲存的帳號。

要檢查存取權並重新載入模型，請在網頁版或桌面版的 Provider 設定裡使用 **Refresh provider status**，或在手機的 Thread 設定裡使用 **Refresh models**。如果被要求重新登入，網頁版或桌面版請到 Provider 設定，手機請到 **Provider accounts**。

如果 Google 回報 `SUBSCRIPTION_REQUIRED`、帳號限制或用量上限，請依照 Provider 的訊息以及其中的重試時間處理。資格相關的資訊見 [Google 的帳號方案](https://antigravity.google/docs/plans)。
