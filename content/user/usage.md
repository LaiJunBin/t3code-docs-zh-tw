---
title: 用量與額度
source: docs/user/usage.md
source_hash: 24db5f3f3b92b21a4a92f0911637461d5671feda
---

從側邊欄或指令面板開啟 **Usage**；在網頁版和桌面版，只要焦點不在終端機上，也可以按 `mod+u`。這個快捷鍵對應的是 `usage.open`，可以在 **Settings → Keybindings** 自訂。

:::note `mod` 是哪個鍵
`mod` 在 macOS 上是 Command，在其他系統上是 Control。所以 `mod+u` 在 Mac 上是 `Cmd+U`，在 Windows 和 Linux 上是 `Ctrl+U`。詳見[快捷鍵](./keybindings.md)。
:::

## 了解你的用量 {#understand-your-usage}

**Usage** 會把你已連線的 environment 上 Codex、Claude Code、Grok Build、OpenCode、Antigravity 和 Cursor 的歷史紀錄合併在一起。它會顯示 token 用量、快取省下的量、各模型的明細，以及估算的「等值 API 費用」，並依 token 類型和速度分開列出。這些估算值不是你的訂閱帳單。**Premium** 是 Fast 和 Ultrafast 請求比標準費率多出來的部分。無法拆分的費用會顯示為 **Other**，例如某個模型沒有公開費率、只有 Provider 回報的費用。在 **Breakdown** 底下選一個模型，可以看它的趨勢、快取命中率，以及每百萬 token 的費用。

:::plain 「等值 API 費用」不是你要付的錢
這個數字回答的問題是：「同樣這些 token，如果照 API 的費率計價，大概是多少錢。」它是用來比較用量大小的估算值。你實際付的是 Provider 訂閱方案的費用，帳單要到 Provider 那邊看。
:::

:::screenshot usage-overview
Usage 頁面：上方是環境下拉選單與時間範圍，中間是費用與 token 的圖表，下方是 **Breakdown** 的模型明細。
:::

總計取決於每台 server 上有多少歷史紀錄可用。Grok 的 turn 如果沒有存下「已完成 turn」的紀錄，就不會算進總計。

OpenCode 會讀取它的 SQLite 資料庫和較舊的 JSON 歷史紀錄。Antigravity 會讀取本機的對話資料庫，包含由 T3 管理的 profile。如果要讀取別的資料目錄，請在 server 上設定 `OPENCODE_DATA_DIR` 或 `ANTIGRAVITY_DATA_DIR`；用逗號分隔多個路徑，就能讀取多個目錄。

Cursor 會用存在 server 上的 CLI 登入資訊，從 Cursor 的 dashboard API 讀取帳號用量。這包含 headless 的 T3 session，以及跨機器的桌面版用量；同一個帳號在多個已連線的 environment 之間只會算一次。如果沒有可用的 CLI 登入資訊，T3 會顯示一則提示，而不是顯示不完整的本機總計。T3 不會從對話文字去推估缺少的 token。在 macOS 上，請在 Usage 頁面選擇 **Enable Cursor usage**，允許 T3 從 Keychain 讀取你既有的 CLI 登入資訊。你可以在 **Settings → Providers → Usage providers** 把它關掉。macOS 可能會在 server 那台 Mac 上請你允許存取。

Usage 會納入每個已設定帳號的歷史紀錄，包含已停用的帳號。自訂的 home 目錄會依照帳號的 home 設定，或是它的 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`、`GROK_HOME` 環境變數。在帳號的環境變數設定裡，請使用絕對路徑或 `~/` 開頭的路徑；相對路徑會隨每個專案的工作目錄而變，Usage 沒辦法可靠地找到它們。共用同一個歷史紀錄目錄的帳號只會算一次。

如果你的 app 和 server 支援的 Provider 不一樣，用量總計可能只涵蓋你的 app 認得的 Provider。更新 app 就能納入新支援的 Provider。

在網頁版和桌面版，可以用環境下拉選單來篩選費用、token 和額度。預設會選取所有 environment。下拉選單會顯示哪些 environment 還在掃描；每個 environment 回應之後，結果就會陸續出現。

如果最近的工作沒有出現，或是新模型沒有顯示費用，請重新整理，讓它重新掃描 session 歷史紀錄並更新模型價格。

## 自訂模型價格 {#set-custom-model-prices}

在網頁版或桌面版，開啟 **Usage** 上的環境下拉選單，然後選擇 **Model prices**，就可以新增、編輯或重設某個模型的估算價格。**Apply to** 一開始會帶入你目前的 Usage 篩選條件；你可以選擇所有 environment，或是個別挑選要套用的對象。輸入完全一致的 model ID，以及每百萬個輸入 token 和輸出 token 的美元費率。你可以輸入任何 model ID，包含沒有公開定價的模型。當 **Usage** 上有模型沒有已知價格時，在 **Breakdown** 底下選取它，再選擇 **Set price**，就會開啟這張表，並且已經把那個模型加進去。

快取讀取和快取寫入的費率可以不填，留白時會使用輸入費率。免費的 token 請輸入 `0`。儲存的價格會取代該 environment 所有歷史紀錄的自動定價，並且會分享給連到它的 client。當各個 environment 的價格不一樣時，儲存格會顯示 **Mixed**。直接在表格裡編輯費率，然後選擇 **Save changes**，就會套用所有編輯過的列。沒有動過的儲存格會保留各個 environment 原本的費率。只選取一個 environment，就能檢視它自己的價格。**Reset to automatic** 會把某個模型的覆寫值標記為「儲存時移除」；在儲存之前都還可以復原。

:::example 幫一個沒有公開定價的模型設定價格
假設 **Breakdown** 裡有一個模型沒有顯示費用（以下的費率只是示範用的數字）：

1. 在 **Breakdown** 選取那個模型，選擇 **Set price**。價格表會開啟，並且已經填好它的 model ID。
2. 輸入費率填 `2`，輸出費率填 `8`，單位是「每百萬 token 多少美元」。
3. 快取讀取和快取寫入兩欄留白，代表比照輸入費率，也就是 `2`。如果這個模型的快取 token 不收費，就填 `0`，不要留白。
4. 用 **Apply to** 確認要套用到哪些 environment，然後選擇 **Save changes**。

留白和填 `0` 的意思不一樣：留白是「跟輸入費率一樣」，`0` 才是「免費」。
:::

每個套用對象都會回報這次變更有沒有存成功。離線或無法使用的 environment 會標示為 **Not saved**。把它們重新連上之後，選擇 **Retry failed saves**，就能完成同一次變更，而且不會對已經存成功的 environment 再寫一次。關閉對話框之後，變更不會留在佇列裡等待。

## 追蹤訂閱額度 {#track-subscription-limits}

**Usage → Limits** 會依 Provider，把它看得到的每一個訂閱帳號合併成一個額度池。所以當你的 environment 和 hub 上有好幾個 Codex 或 Claude 帳號時，每個時段你看到的是一個數字，而不是一長串清單。每張時段卡片會顯示額度池還剩多少，以及一條長條圖，每個帳號佔其中一段，而且在各個時段裡都維持在同一欄。帳號依照 5 小時額度的重設時間排序，最快重設的排最前面；如果沒有任何帳號回報 5 小時額度，就依第一個可用的時段排序。空一格代表那個帳號沒有回報該時段。當 Provider 有回報重設時間時，卡片還會告訴你下一次重設是什麼時候，以及會還回多少額度。某一段裡畫斜線的部分，就是那次重設會恢復的量。點一下某一段或某個帳號列，可以看到該帳號的方案、它是在哪裡登入的，以及重設時間。在網頁版也可以用滑鼠停在上面查看。有存下重設額度（reset credits）的 Codex 和 Claude 帳號，會在帳號詳細資料裡顯示票券數量和 **Use reset** 動作。當 server 執行在 macOS 上時，無法使用 Claude 的重設，因為 Claude 在 macOS 上把登入資訊存在 Keychain 裡。在窄螢幕上，長條圖下方會有編號的列，顯示每個帳號的配額、倒數時間和重設額度。點一下某一列可以開啟它的詳細資料。

:::plain 「額度池」是怎麼看的
假設你有兩個 Claude 帳號，一個登入在筆電、一個登入在遠端開發機。**Limits** 不會列出兩行讓你自己加總，而是把兩個帳號的額度合起來，告訴你「這個時段總共還剩多少」。長條圖上的兩段分別代表這兩個帳號，想知道其中一個帳號的狀況時，點它那一段就可以。
:::

:::screenshot usage-limits-pool
**Usage → Limits** 的時段卡片：顯示額度池剩餘量，長條圖依帳號分段，其中畫斜線的部分是下一次重設會恢復的量。
:::

同一個帳號如果在不只一個 environment 上登入，或是同時也被 hub 回報，只會算一次。用環境下拉選單篩選，就能看到單一台機器有哪些額度。

開啟 Limits 時，會自動檢查已選取、已連線的 environment。每個 client 對同一個 environment 的自動檢查，至少會間隔五分鐘，檢查失敗之後也一樣。如果某個時段看起來還是舊資料，請重新整理 Limits，讓它重新檢查每一個 Provider 和 hub。

從訊息輸入框（composer）的指令選單挑選 `/usage-limits`，或是把它當成訊息送出，就能在不離開對話的情況下查看目前模型的額度。結果會在訊息輸入框上方開啟，在你關掉它或送出下一則訊息時關閉。它用的是和 **Usage → Limits** 同一份 snapshot，所以不會讓 agent 執行，也不會重新整理任何東西。只有出現在 **Usage → Limits** 底下的 Provider，才會提供這個指令。

OpenCode Go 會在 OpenCode 於該 environment 本機執行時，回報它的 session、每週和每月額度。T3 無法回報外部 OpenCode server 的額度，因為那些憑證屬於遠端的 server。Cursor 會使用 CLI 登入資訊或 `CURSOR_AUTH_TOKEN`，回報它的每月額度，其中 Auto 和 API 用量會分開列出。在 macOS 上，啟用 Cursor 用量之後，這也包含預設的 Keychain 登入資訊。只有在使用 Cursor 預設的 API endpoint 時，Keychain 登入資訊才會用來查詢額度。如果你設定了自訂的 Cursor endpoint，請改用明確指定的 token 或是以檔案儲存的 CLI 登入資訊來查詢額度。

Grok 會在你用 `grok login` 登入之後，回報目前計費週期剩下的訂閱額度和重設時間。明確使用 `XAI_API_KEY` 的連線，以及自訂了驗證方式或 endpoint 的設定，不會回報訂閱額度。

使用 API key 的帳號可能不會回報訂閱額度。透過 `ANTHROPIC_AUTH_TOKEN` 走 proxy 的 Claude 連線也是一樣。

## 連接 CLIProxyAPI hub {#connect-a-cliproxyapi-hub}

要查看合併管理的帳號，請開啟 **Settings → Providers → Usage providers → Add hub**。選擇要連到這個 hub 的 environment，然後輸入 hub 的 URL 和 management key。

這些帳號會出現在 **Usage → Limits** 底下。Codex 帳號會顯示存下來的重設額度；選取一個帳號，再選擇 **Use reset**，就可以兌換一次。不需要安裝 hub 的外掛。

這個連線只提供用量資訊；如果要讓 agent 的請求經由 hub 送出，Provider 要另外設定。不再需要這個 hub 時，到同一個設定區塊把它移除。

:::plain 連接 hub 只是「看得到」，不是「改走 hub」
在這裡加入 hub，效果只有一個：**Usage → Limits** 會多出 hub 上那些帳號的額度。agent 送出的請求還是走原本的路徑，要改成經由 hub，得在 Provider 的設定裡另外處理。
:::

## 訂閱用量小工具 {#subscription-usage-widget}

從 iOS 或 Android 的小工具（widget）庫加入 **Subscription usage**，就能看到 Codex 和 Claude 剩下的配額。點一下它會開啟 **Usage → Limits**；在 Android 上，這需要 T3 正在背景執行才有作用，否則請從啟動器（launcher）開啟 app。在 iOS 上，用 **Edit Widget** 為每個 Provider 選擇 Session、Weekly 或兩者都顯示。重新開啟 T3 可以更新已經過期的讀數。

## 快捷鍵 {#keyboard-shortcuts}

在網頁版和桌面版，可以從指令面板開啟 Usage。在 Usage 頁面上，只要不是正在欄位裡打字，按 `C`、`T` 或 `L` 可以切換到 Cost、Tokens 或 Limits。用 `Ctrl+Shift+1/2/3/4`（macOS 上是 `Cmd+Shift+1/2/3/4`）切換到過去 24 小時、7 天、30 天或 90 天。在 Limits 上，切換時間範圍的快捷鍵沒有作用。按 `Escape` 回到上一頁。這些快捷鍵可以在 **Settings → Keybindings** 自訂。
