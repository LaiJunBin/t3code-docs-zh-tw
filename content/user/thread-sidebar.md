---
title: 使用 Thread
source: docs/user/thread-sidebar.md
source_hash: 1172678440c7fd647267dab23b8fe496cd1d1a7b
---

每一件獨立的任務請開一個新 Thread。如果它對程式碼的修改需要獨立的分支和工作目錄，請選擇 **New worktree**。

:::plain New worktree 是什麼意思
Worktree 是 Git 的功能：同一個 repository 另外開一份獨立的工作目錄，搭配它自己的分支。選了 **New worktree**，這個 Thread 的 agent 就在那份獨立的目錄裡改程式碼，不會動到專案目錄裡你手邊正在改的檔案，也不會和其他 Thread 互相干擾。
:::

## 開始一個 Thread {#start-a-thread}

在網頁版和桌面版，新 Thread 會沿用目前的專案，並帶著你選的模型和模式，除非目的地的專案有自己的模型預設值。它的分支和 workspace 模式來自你設定的預設值。要在既有的 worktree 裡繼續工作，請使用分支工具列上的 **New thread in this worktree**。

當你更改新 Thread 的專案時，如果那個專案存在於目前的 environment，T3 Code 會留在目前的 environment。否則它會選一個有這個專案的 environment。

### 不使用專案開始 {#start-without-a-project}

Thread 不一定需要專案。要開始一個沒有專案的 Thread，可以點新 Thread 標題下方的 **or start without a project**；也可以從那個標題裡的專案選單，或從指令面板的 **New thread in...** 選擇 **No project**；或是按 `mod+alt+n`。在手機版，從專案清單選擇 **No project**。要把草稿移進某個專案，在標題裡選擇那個專案即可。

:::note 快捷鍵裡的 mod 是哪個鍵
`mod` 在 macOS 上是 Command，在其他系統上是 Control。所以 `mod+alt+n` 在 macOS 上是 `Cmd+Option+N`，在 Windows 和 Linux 上是 `Ctrl+Alt+N`。
:::

每個沒有專案的 Thread 都在 `~/.t3/scratch`（也就是 T3 資料目錄裡的 `scratch` 資料夾）底下自己的資料夾裡工作。資料夾的名稱由日期、第一則訊息的前幾個字和一個短 id 組成，例如 `2026-09-25-convert-these-pngs-to-webp-a1b2c3d4`。刪除 Thread 時會保留它的資料夾，所以 agent 寫出來的檔案會一直留著，直到你自己刪掉為止。因為這些資料夾不是 Git repository，所以分支、worktree 和 diff 的控制項都會隱藏。如果資料目錄本身位於某個 Git checkout 裡面，就無法使用這個功能。

:::example 適合不使用專案的任務
和任何 repository 都無關的一次性工作，例如請 agent 把一批圖片轉檔、整理一份 CSV、寫一支用完就丟的小 script。agent 產生的檔案會出現在 `~/.t3/scratch` 底下那個 Thread 專屬的資料夾裡。因為那裡不是 Git repository，所以看不到 diff，也沒有 worktree 可以選；需要這些功能的話，請趁還是草稿的時候，在標題裡把它移進一個專案。
:::

### 在背景開始 {#start-in-the-background}

在桌面瀏覽器或桌面版 app 裡，按 macOS 的 `Cmd+Enter`，或 Windows 和 Linux 的 `Ctrl+Enter`，可以開始一個新 Thread，並立刻開啟另一份草稿。下一份草稿會沿用你選的 workspace 模式和 base branch。選了 **New worktree** 時，每一次背景送出都會建立它自己的 worktree。

要在網頁版或桌面版把同一則 prompt 送給好幾個模型，請在新 Thread 的模型選單裡用 **Shift-click** 加入或移除模型。一般的點擊會回到單一模型。選一個 base branch 然後送出。每個選取的模型都會開始一個獨立的 Thread 和 worktree，而你會留在新 Thread 的 composer。這需要專案是 Git 專案。

:::example 讓兩個模型各做一次，再比較結果
在新 Thread 的訊息輸入框（composer）寫好 prompt，打開模型選單，按住 Shift 點兩個模型，選好 base branch 之後送出。側邊欄會多出兩個 Thread，各自在自己的 worktree 裡工作，所以兩邊的修改不會混在一起。等它們做完，你可以分別打開來比較，留下比較好的那一個。
:::

## Pin 與重新排序 Thread {#pin-and-reorder-threads}

從 Thread 的選單把它 pin 起來，它就會固定在進行中的工作上方。

:::plain 側邊欄的幾個區段
這一節會反覆提到下面這些區段，先認識一下：

| 區段                | 放的是什麼                                                         |
| ------------------- | ------------------------------------------------------------------ |
| **Pinned**          | 你 pin 起來的 Thread，固定在進行中的工作上方。                     |
| **Active**          | 進行中的 Thread。新 Thread 會出現在這裡的最上面。                  |
| **Snoozed**         | 被 snooze（暫時擱置）的 Thread，到了喚醒時間才回來。               |
| **Settled**         | 已經 settle（結案）的 Thread。對話還在，只是移出了進行中的清單。   |
| **Working**（beta） | 開啟設定後才有：正在工作或監看中的 Thread 會收到側邊欄最下方。     |
:::

:::screenshot thread-sidebar-sections
側邊欄的 Thread 列表，可以看到 pinned 的 Thread 排在進行中的 Thread 上方，以及 Snoozed 與 Settled 收納區。
:::

在網頁版和桌面版，取消 pin、settle（結案）、snooze（暫時擱置）和封存 Thread 時，各會顯示一則帶有 **Undo** 的通知，持續五秒。Undo 會把 Thread 還原到先前的狀態，包括它在 pinned 區段裡的位置；如果你當時正在看的 Thread 被封存了，也會把它重新打開。沒有任何文字欄位取得焦點時，`mod+z` 會觸發最近一次的 Undo；見[快捷鍵](./keybindings.md#commands-with-special-behavior)。

在網頁版和桌面版，你也可以把電腦上的檔案拖到任何一列 Thread 上：那個 Thread 會打開，檔案會附加到它的 composer 裡，等你送出下一則訊息。這裡適用的每則訊息檔案上限，和直接附加檔案時相同；見[附加檔案](./composer.md#attach-files)。

在網頁版和桌面版，pin 或取消 pin 一個 Thread 時，側邊欄會停在你目前的捲動位置，而不會跟著那個 Thread 跳到它在清單裡的新位置。

Pin 不會阻止自動 settle。Settle 一個 Thread 會移除它的 pin。

在網頁版和桌面版，把 Thread 拖到不同的區段就可以改變它的狀態。把 Thread 往上拖進 pinned 區段，就會把它 pin 在你放下的位置；把 pinned 的 Thread 往下拖進 active 清單，就會取消 pin。把 Thread 拖到 **Settled** 標題上會 settle 它，把 settled 的 Thread 拖進 active 清單則會取消 settle。Snoozed 的 Thread 可以從 snoozed 收納區拖出來，這會喚醒它；但 Thread 不能拖進這個收納區，因為 snooze 需要一個喚醒時間。把 pinned 的 Thread 拖出 pinned 區段時，不會跳出取消 pin 的確認。Pinned 和 active 的分界標籤只在拖曳時出現，而且不會讓各列移位。其他列會往旁邊滑開，顯示 Thread 會落在哪裡。當你跨進另一個區段時，被拖曳的 Thread 會顯示放下後會執行的動作，並附上圖示：**Pin**、**Unpin**、**Settle**、**Un-settle** 或 **Wake**。拖曳期間它的狀態和滑鼠移入時才出現的動作按鈕會隱藏。Pinned 的 Thread 只有還留在 pinned 區段時才會保留它的 pin 圖示；一旦離開，就換成上述的動作標記。在同一個區段裡重新排序不會顯示標記。沒有任何 pin 時，把 Thread 拖到最上緣就可以 pin 它。整個拖曳過程中區段標籤都保持可讀，而 Thread 目前所在的區段會換成強調色。區段標籤也會標示出空的區段，以及收合起來的 settled 收納區。

在 pinned 或 active 區段裡拖曳，可以改變它的順序。其他列會往旁邊滑開，顯示 Thread 會落在哪個位置。放進這兩個區段的任何一個，都會保留你選的位置。在手機版，開啟某個 Thread 的選單，選擇 **Arrange threads**。在 **Pinned** 和 **Active** 之內或之間拖曳把手，就可以重新排序、pin 或取消 pin。放到 **Settled** 分隔線上會 settle 那個 Thread。被拖曳的卡片會在你放開之前顯示將執行的動作。展開 **Snoozed** 或 **Settled**，可以把停放在裡面的 Thread 拖回任何一個進行中的區段。每次放下都會儲存；**Done** 會回到 Thread 列表。Thread 選單裡也有 **Move up** 和 **Move down**。順序是由 server 儲存的，所以重新整理之後仍然保留，也會出現在你其他已連線的裝置上。

在網頁版和桌面版，用 **Pin**、**Settle**、**Snooze** 這類 Thread 動作造成的區段變動，列表也會以動畫呈現。這些轉場會遵循你系統的「減少動態效果」偏好設定。拖曳時，各列會跟著插入的空隙移動，放下之後不會再重播一次轉場。

新 Thread 會出現在你排好的 active Thread 上方。Settle 會清除 Thread 在 active 裡的位置，所以用 **Un-settle** 之後它會回到最上面。Pin 和 snooze 則會保留它在 active 裡的位置，直到你再次移動它。Thread 的活動不會改變順序。Settled 收納區仍然依照 settle 的時間排序。

如果某個 environment 無法拖曳，請更新在那個 environment 上執行的 T3 Code server。Pinned 和 active 的重新排序需要 server 支援。來自舊版 server 的 Thread 會維持它們的預設順序，直到 server 更新為止。

要依照對話內容產生一個新的標題，開啟 Thread 的選單，選擇 **Regenerate title**。標題正在產生時，或是連線的 environment 需要更新 server 時，這個動作無法使用。

透過 T3 Code 連接的 agent，可以使用同一套由 server 負責的 metadata 流程，來重新命名 Thread、重新產生標題，或是連結與取消連結 pull request。這些變更會出現在網頁版、桌面版和手機版，不需要發起操作的那個瀏覽器一直開著。

### 收合工作中的 Thread（beta） {#fold-working-threads-beta}

在網頁版和桌面版，開啟 **Settings → General → Working section (beta)**，就會把正在工作或監看中的 Thread，移到側邊欄最下方一個收合起來的 **Working** 區段。Thread 完成、失敗，或是需要你核准或回答時，會回到 active 清單的最上面。Pinned 的 Thread 仍然留在 pinned 區段。

開啟這個功能時，active 清單會依照每個 Thread 最近一次回到你手上的時間排序，所以不能用拖曳來重新排序。關掉之後，你儲存的順序就會回來。

## Settle 已完成的工作 {#settle-finished-work}

從 Thread 的選單選擇 **Settle thread**，可以把已完成的工作移出 active 清單，而不會刪除對話。**Un-settle thread** 會把它還原成進行中的工作，並且阻止自動 settle，直到有新的活動讓一般規則重新生效。手動 settle 一個閒置的 Thread，會把尚未回答的非同步提問關掉，但不會送出答案，也不會重新啟動 agent。Settle 也會關閉這個 Thread 裡停在閒置提示字元的終端機，並保留它們的輸出。正在執行指令的終端機（例如 dev server）則會繼續開著。

依照預設，environment 會在 Thread 閒置三天後 settle 它，也會 settle pull request 已經 merge 的 Thread。已關閉的 pull request 也可能讓閒置的 Thread 被 settle。進行中的工作、等待中的提問或核准請求，以及仍在執行的背景工作，都會阻止自動 settle。開啟中的 pull request 不會阻止因閒置而 settle；但如果你在 pull request 關閉之後又繼續了工作，一個早就關閉或 merge 的 pull request 並不會 settle 這些工作。

:::plain 自動 settle 的規則整理
會讓 Thread 被自動 settle 的情況（預設值）：

- 閒置滿三天。
- 它的 pull request 已經 merge。
- 它的 pull request 已經關閉，而且 Thread 是閒置的。

即使符合上面的條件，以下情況也不會被自動 settle：

- 還有工作正在進行，或有背景工作仍在執行。
- 有提問或核准請求在等你。
- 你對這個 Thread 按過 **Un-settle thread**，之後還沒有新的活動。
- 你把這個 Thread 的 **Auto-settle behavior** 設成了 **Disabled**（見下一段）。

Settle 不是刪除，對話還在，隨時可以用 **Un-settle thread** 把它拿回進行中的清單。
:::

如果想讓某一個 Thread 不論閒置多久都不進 settled 收納區，開啟它的選單，選擇 **Auto-settle behavior**，再選 **Disabled**。目前的選項會打勾。選 **Enabled** 可以回到一般規則。停用期間，手動 settle、snooze 和封存仍然可以使用。

這些規則可以在網頁版和桌面版的 **Settings → General**，或手機版的 **Settings → Thread behavior** 修改。即使你的 app 都關著，這些規則也會繼續執行。在網頁版和桌面版，在最上方選擇一個 environment 就只修改它的規則，選擇 **All environments** 則會一起更新已連線的 environment。出現 Mixed 的值，代表所選的 environment 在那一項上設定不一致。手機版會把這些規則套用到支援共用設定的已連線 environment。離線中的 environment 和舊版 server 會保留它們先前的值。修改規則不會把已經 settle 的 Thread 重新打開。

## 連結 pull request {#link-a-pull-request}

Server 會為每個尚未 settle 的 Thread 找出它儲存的分支所對應的 PR，即使你的 app 都關著也一樣。已經 settle 的 Thread 會保留它們儲存的連結。如果由分支自動產生的連結沒有出現，請更新 server。

在網頁版和桌面版，在 Thread 裡的 pull request 連結上按右鍵，選擇 **Link to thread**，可以改選另一個 PR。在同一個連結上使用 **Unlink from thread**，則會回到分支對應的 PR（如果有的話）。連結的 pull request 會被納入自動 settle 的判斷。

## 尋找與引用工作 {#find-and-reference-work}

在網頁版和桌面版，用 `Cmd/Ctrl+K` 開啟指令面板，可以搜尋所有已連線 environment 裡的 Thread。輸入兩個字元之後才會開始搜尋訊息，搜尋範圍包含你的訊息和 agent 的最終回覆。

用 **Settings → Keybindings** 可以找到或自訂搜尋檔案、複製 Thread 參照的快捷鍵。複製出來的參照在有 pull request 連結時會使用那個連結，否則使用 Thread ID。自訂設定的方式見[快捷鍵](./keybindings.md)。

## 檢視 agent 的工作 {#inspect-agent-work}

**Limited** 表示 Provider 因為用量或速率限制而停了下來。對話裡會保留 Provider 給的說明。請等限制重設之後再重試，或是換用另一個 Provider instance。在網頁版和桌面版，在空的 composer 裡按 **Resume**，可以手動接續被限制或被中斷的 turn。限制擋住 Thread 的期間，佇列裡的訊息仍然會保存著。它們會在接續的工作完成之後執行。如果佇列因為重新啟動而暫停，到那時再把它恢復。

當 Provider 有回報重設時間時，選擇 **Resume at reset** 可以排定一次接續。你可以從 Thread 裡取消它。在網頁版和桌面版的 **Settings → General**，或手機版的 **Settings → Thread behavior**，啟用 **Auto-resume limited threads**，就會預設為因限制而停下的 Thread 排定接續。重設時間到的時候，environment 必須正在執行；如果有逾期的接續，它會在重新啟動之後補上。送出新訊息、封存或 settle 那個 Thread，都會讓等待中的接續不再啟動。

選擇 **Snooze until reset** 可以把 Thread 藏起來，直到它的額度恢復為止。Snooze 和自動接續是各自獨立的：只有 snooze 的話，Thread 會被喚醒，但不會送出訊息；兩者都啟用，則會喚醒並接續。**Wake now** 會取消 snooze。在 Thread 行為的設定裡啟用 **Snooze limited threads**，就會預設把因限制而停下的 Thread snooze 起來。沒有提供重設時間的 Provider，則提供手動重試和一般的 snooze 選項。

:::plain 撞到用量上限時的四種組合
Thread 顯示 **Limited** 之後，「要不要先藏起來」和「額度回來時要不要自動繼續」是兩個獨立的選擇：

| Snooze | 自動接續 | 額度恢復時會發生什麼                             |
| ------ | -------- | ------------------------------------------------ |
| 沒有   | 沒有     | Thread 留在原地，等你自己按 **Resume** 或重試。  |
| 沒有   | 有       | Thread 留在原地，時間到自動接著做。              |
| 有     | 沒有     | Thread 先藏起來，時間到回到列表，但不會送出訊息。 |
| 有     | 有       | Thread 先藏起來，時間到回到列表並接著做。        |

自動接續要成立，environment 那台機器在重設時間必須開著；當時沒開的話，會在它重新啟動之後補上。
:::

在網頁版和桌面版，用 **Agents** 可以追蹤交給 subagent 的工作。

由 agent 啟動的 subagent Thread 不能接收訊息；請改為傳訊息給上層的 Thread。當這樣的 subagent 需要核准或回答時，會由上層的 Thread 來向你提出。

在對話裡展開一個工具呼叫，可以看到它完整的指令和輸出。摘要會把 shell 的包裝指令縮短，而且在呼叫結束之後，摘要仍然可能描述的是最近那一次呼叫；呼叫本身的結果才會顯示它的狀態。

## Snooze 到之後 {#snooze-until-later}

從 Thread 的選單選擇 **Snooze → Custom…**，可以挑一個你當地時區的日期和時間，或是一段以分鐘、小時或天為單位的時間長度。時間長度從你確認的那一刻開始算；一天就是 24 小時。在網頁版和桌面版，你也可以把選取的好幾個 Thread 一起 snooze。選擇 **Wake thread** 可以提早把 Thread 叫回來。

:::example 「一天」是從現在起算 24 小時
星期二下午 3 點，你在 **Custom…** 裡輸入時間長度 1 天並確認，這個 Thread 會在星期三下午 3 點回來，而不是星期三一早。想讓它在某個特定時刻回來（例如星期三早上 9 點），請改用日期和時間來設定。
:::
