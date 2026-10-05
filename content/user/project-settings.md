---
title: 設定與專案覆寫
source: docs/user/project-settings.md
source_hash: bb9af1ff358d8f6ebb2fbdbcb5e8232c42e3d990
---

在網頁版和桌面版，設定頁最上方那一句「Applying settings for …」，用來選擇這次變更要套用到哪個專案和哪個 environment。只存放裝置偏好設定的頁面（例如 Appearance）不會顯示這一句。它一開始選的是 **All projects** 和 **All environments**，你在各個分類之間切換，或是搜尋某個設定時，選擇都會保留。

儲存在這台裝置上的偏好設定（例如外觀、確認提示和瀏覽器 profile）一律會顯示，而且不受這個選擇影響。其他的設定全都存在 server 上。選擇單一 environment 可以編輯它的設定；保持 **All environments** 則會一次編輯所有已連線的 environment。離線的 environment 會保留它們目前的值；這是一次批次編輯，不是會同步的全域預設值。

選擇一個專案，就可以在選定的 environment 上為它覆寫設定。每一列 server 設定的標題旁邊有一個圖層圖示，顯示這個值是從哪裡來的：內建預設值、environment，或是專案覆寫。點它可以看到每一個選定 environment 上的這條來源鏈。覆寫可以重設，讓它重新回到繼承。無法由專案覆寫的設定，在選了專案的期間會顯示為唯讀。

:::plain 三層設定，上層蓋過下層
可以把每個設定想成有三層：

1. 最底層是 T3 Code 的內建預設值。
2. 中間是某個 environment（某一台機器）自己的設定。
3. 最上層是某個專案在那個 environment 上的覆寫。

實際生效的是有設定值的最上面那一層。把覆寫重設掉，就等於把最上層拿掉，讓下一層的值露出來。圖層圖示就是用來告訴你，現在看到的值是哪一層給的。
:::

:::screenshot settings-scope-sentence
設定頁最上方的「Applying settings for …」那一句，可以看到專案和 environment 兩個選擇項，以及某一列設定標題旁的圖層圖示。
:::

選定的幾個 environment 值不一致時，控制項會顯示 **Mixed** 而不是某個值，圖層圖示也會變成琥珀色。選一個值，就會把它套用到每一個選定的 environment。

修改 environment 的值，絕對不會動到專案自己的覆寫。如果有專案覆寫了你正在編輯的設定，圖層圖示會顯示這些專案的數量，來源鏈也會逐一列出它們和各自的值：點某個專案可以跳到它，或是按 **Reset all** 讓那些專案重新跟隨 environment。

Provider 和診斷資訊是以機器為單位的：它們一次只顯示一個 environment，在你另外選擇之前，顯示的是主要的那一個。其他的設定都會套用到整個選擇範圍。

在手機上，開啟 **Settings**，用標頭裡的篩選器選擇已連線的 environment 和專案。這個篩選器在各個 server 設定頁面裡都可以使用。選了 **All projects** 時，**Server settings** 的各個分類，以及 **Thread behavior** 裡的 auto-settle 控制項，編輯的是選定 environment 的預設值。選了某個專案，編輯的就是它在選定 environment 上的覆寫。在頁面裡使用 **Use defaults**，可以移除那一頁的專案覆寫。開啟 **Settings → Projects & threads → Overview**，可以為專案在選定的已連線 checkout 上統一改名，並查看那些 checkout 的所在位置。屬於整個 environment 的設定，在選了專案的期間維持唯讀。選定的對象值不一致時，控制項會顯示 **Mixed**，直到你選定一個值為止。外觀、鍵盤，以及其他只屬於手機的設定，不受篩選器影響。

## Worktree 的分支名稱 {#worktree-branch-names}

在 **Settings → Source Control → Worktree branch naming** 裡，可以選擇固定的前綴、由模型挑選的語意前綴（例如 `feat/` 或 `fix/`），或是用自訂指示來決定完整的名稱。固定前綴的預設值是 `t3code/`；結尾的斜線可寫可不寫，前綴留空就什麼都不加。固定前綴裡的無效字元會被換成連字號。自訂指示會附加在命名用的 prompt 後面，可以用來指定 issue 編號、命名空間和大小寫規則。

:::example 三種模式產生的分支名稱
設定頁裡這三種模式分別叫 **Static prefix**、**Semantic prefix** 和 **Custom instructions**。假設你的第一則訊息是請 agent 加上搜尋功能：

| 模式                    | 分支名稱的樣子                                        |
| ----------------------- | ----------------------------------------------------- |
| **Static prefix**       | `t3code/add-search`（前綴填 `t3code` 或 `t3code/` 都一樣） |
| **Semantic prefix**     | `feat/add-search`；修 bug 的任務則會像 `fix/login-timeout` |
| **Custom instructions** | 完全由模型依照你的指示產生，不會另外加前綴或後綴      |
:::

這些設定適用於自動命名的新 Worktree 分支。選擇一個專案，就可以覆寫它的 environment 預設值。Worktree 的目錄會保留原本的名稱。如果產生名稱失敗，或是自訂的名稱無效、已經被用掉，就會繼續沿用暫時的分支名稱。

## 手機上的排程任務 {#scheduled-tasks-on-mobile}

開啟 **Settings → Scheduled tasks**，可以建立重複執行的任務，或是管理各個已連線 environment 上既有的任務。用設定的篩選器，可以依 environment 或專案縮小列表範圍。每個任務會在你選擇的 environment 上執行，使用它的專案、模型和 workspace 設定。固定時間的排程用的是那個 environment 的時區，可能和你手機的時區不同。

你可以從列表編輯、暫停、恢復、立即執行或刪除任務。離開編輯過的表單時，會先詢問你，才捨棄尚未儲存的變更。

:::note 排程的時間是照哪一台的時鐘
是執行任務的那個 environment，不是你的手機。例如手機在台北，environment 是一台時區設為 UTC 的遠端機器，那麼排在「每天 09:00」的任務，會在台北時間 17:00 執行。
:::

## 預設值與繼承 {#defaults-and-inheritance}

General 包含新 Thread 使用的模型和 workspace。Integrations 控制 agent 的瀏覽器存取。Source Control 包含自動 pull、pull request 的預設 merge 方式，以及文字產生。同樣的那幾列，編輯的是 environment 的預設值還是專案的覆寫，要看專案 crumb（專案選擇項）目前選的是什麼。

Project 分類只在選了專案時顯示，裡面有專案的名稱、圖示、actions、checkout 和移除。Actions 屬於專案：編輯它們，會在每一個選定的 environment 上建立這個專案自己的清單；重設則會回到 environment 的共用清單。專案的 `t3.json` 裡的 actions 可以在那裡匯入。

repository 也可以在 `t3.json` 裡宣告的設定（例如新 Thread 的 workspace），會依照固定的順序決定：先看專案覆寫，再看 environment 的設定，再看 `t3.json`，最後才是內建預設值。把設定留在 **Inherit**，就是交給下一層決定。瀏覽器存取的變更，會在 agent session 下一次啟動時生效。

:::example 在 t3.json 裡幫整個團隊設好預設
`t3.json` 放在 repository 的根目錄，會跟著程式碼一起 commit，所以每個打開這個 repository 的人都會套用到：

```json
{
  "defaultThreadEnvMode": "worktree",
  "worktreeSubmodules": "top-level"
}
```

`defaultThreadEnvMode` 可以是 `"worktree"`（新 Thread 在全新的 worktree 裡開始）或 `"local"`（在目前的 checkout 裡開始）。這只是「大家都沒特別設定時」的預設：只要某人在自己的 T3 Code 裡對專案或 environment 設了值，就會以他的設定為準。四層都沒設定時，內建預設值是 `local`。
:::

新的 worktree 會以遞迴方式初始化 git submodule。如果因為 repository 宣告了很多巢狀的 submodule，導致這個步驟很慢，可以把 **Settings → General** 裡的 **Submodules**（選了專案就是在那裡覆寫它）設成 **Top level only**，只處理 repository 自己宣告的那幾個；或是設成 **Skip**，留給 setup script 處理。它決定的順序和 workspace 預設值相同：當專案和 environment 都是 **Inherit** 時，套用的是被 checkout 的那個分支的 `t3.json` 裡的 `"worktreeSubmodules"` 值。

## 儲存空間清理 {#storage-cleanup}

開啟 **Settings → Storage**，可以在單一機器或所有已連線的 environment 上啟用自動清理。這些規則預設是關閉的，會在 server 上執行，時機是啟動時、規則變更時，以及每小時一次。離線的機器會保留它們既有的規則。

選擇一個專案，可以把 **Automatic worktree cleanup** 設成 **Inherit**、**Off** 或 **Custom**。Inherit 會跟隨每台機器的規則；Off 會保留那個專案的 worktree，直到你手動移除。Custom 則會對選定的專案或 checkout 套用另一組 worktree 規則。瀏覽器擷取內容和 log 的保留期限，仍然是整台機器共用的。

Worktree 可以在以下情況被移除：閒置超過你指定的天數、已經 merge，或是除了預設分支之外沒有任何額外的 commit。只有由 T3 管理的 worktree 才符合資格。有進行中的 session、共用的 worktree、尚未 commit 的變更，以及 `node_modules` 以外被 ignore 的檔案，都會讓 worktree 不被移除。分支和 Thread 的歷史紀錄會留著；再開始一個 turn，就會重新建立 checkout。merge 清理要求那些 commit 已經包含在遠端的預設分支裡，所以用 squash merge 的話，可能要改用閒置天數的規則。

:::plain 為什麼 squash merge 不會觸發「已 merge」清理
squash merge 會把分支上的多個 commit 壓成一個全新的 commit 再放進預設分支。內容雖然進去了，但你分支上原本那幾個 commit 並不在預設分支的歷史裡。T3 Code 檢查的是「這些 commit 有沒有被包含進去」，所以它會認為這個 worktree 還沒 merge。團隊習慣用 squash merge 的話，就靠閒置天數的規則來清。
:::

啟用 **Delete worktrees with deleted threads** 之後，當 worktree 的最後一個 Thread 被刪除，可以安全移除的 worktree 就會被移除，包括已封存的 Thread，以及先前刪除時留下來的 worktree。server 會等 session 和終端機停止，重新啟動之後也會重試先前跳過的 worktree。這項規則關閉時，手動刪除 worktree 的既有提示仍然可以使用。

瀏覽器擷取內容和已輪替的 log，各有各的保留期限。過期的擷取內容，連結會失效。目前的 log、訊息附件和瀏覽器 profile 會保留。

## 專案圖示 {#project-icons}

選擇專案並開啟 Project，可以挑選圖示、emoji、monogram（字母標誌）或圖片。這個選擇會套用到專案群組裡的每一個 checkout，並顯示在已連線的 client 上。選擇 **Automatic**，可以讓 T3 Code 重新自動偵測圖示。

在圖示選擇器裡選 **Monogram**，可以設定一到兩個字母或數字，以及一個顏色。

找不到圖片時，網頁版和桌面版會顯示兩個字元的 monogram，顏色取自圖示色盤，並且是由儲存的專案名稱推導出來的。例如 `Nebula` 會變成 `NA`，`Silver Orchard` 會變成 `SO`，`M7 Forge` 會變成 `M7`。

## 讓預設分支保持最新 {#keep-the-default-branch-current}

在 Source Control 裡啟用 **Automatically pull**，可以讓預設分支的 checkout 跟它設定的 upstream 保持同步。選擇一個 environment 來設定預設值，或選擇一個專案來覆寫它。在手機上，用 **Settings → Source control** 修改選定 environment 的預設值或專案覆寫。

T3 Code 只有在可以 fast-forward，而且 checkout 裡沒有已變更的檔案、未追蹤的檔案或本機 commit 時，才會 pull。位在其他分支上、或是沒有 upstream 的 checkout，它會跳過。如果 checkout 裡有你自己的本機工作，要先自行處理好，自動 pull 才會恢復。

:::plain 「只在可以 fast-forward 時才 pull」是什麼意思
fast-forward 指的是：你這邊沒有任何自己的改動，只是單純落後遠端，所以把分支指標往前移到最新的 commit 就好，不需要合併任何東西。T3 Code 只做這種不可能產生衝突的更新。只要 checkout 裡有任何你自己的東西（改過的檔案、新檔案、還沒 push 的 commit），它就不碰，留給你自己決定怎麼處理。
:::
