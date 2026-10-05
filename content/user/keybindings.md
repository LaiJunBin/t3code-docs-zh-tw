---
title: 快捷鍵
source: docs/user/keybindings.md
source_hash: e305b30510e188a2c6a6927eaed12946b7b2d405
---

在網頁版和桌面版的 **Settings → Keybindings** 可以自訂快捷鍵。那一頁也會列出你這個版本可用的 command ID 和預設值。

:::screenshot keybindings-settings
**Settings → Keybindings** 頁面，列出各個 command 和它目前綁定的按鍵。
:::

## Composer 的控制 {#composer-controls}

在 **Settings → General → Send shortcut** 裡，可以選擇：按 Enter 就送出、多行的訊息才需要 `mod+Enter`，或是一律需要 `mod+Enter`。`Shift+Enter` 會插入換行。這項設定適用於網頁版和桌面版在桌面寬度下的訊息輸入框（composer）。

**Follow-up behavior** 用來選擇 agent 執行中送出的訊息是 Queue 還是 Steer。用 `mod+Enter` 可以只針對這一則訊息採取相反的動作，即使送出快捷鍵本身就需要修飾鍵也一樣。`mod+Alt+Enter` 會送出訊息、讓那個 Thread 留在背景繼續執行，並開啟一個全新的新 Thread composer。在新 Thread 裡，`mod+Enter` 做的是同一件事。這些快捷鍵可以在 **Settings → Keybindings** 裡修改，項目名稱是 **Composer: Opposite Queue or Steer Action**、**Composer: Start in Background** 或 **Composer: Send and Start New Thread**。這些綁定的優先順序高於送出快捷鍵。點擊送出按鈕，則會使用你設定的 follow-up behavior。

:::plain Queue 和 Steer 是什麼
這兩個詞講的是「agent 還在忙的時候，你又送出一則訊息」要怎麼處理。Queue 是把訊息排進佇列，留到之後的 turn 再處理。Steer 是立刻把訊息送進正在執行的這個 turn，讓 agent 當下就調整方向。**Follow-up behavior** 決定預設用哪一種，`mod+Enter` 則是「這一則我要用另一種」。詳見[在 agent 工作時送出訊息](./composer.md#send-while-the-agent-is-working)。
:::

當進行中的 turn 有排在佇列裡的訊息時，`mod+Shift+Enter` 會把第一則以 steer 的方式送出。可以在 Keybindings 的 **Queue: Send First Queued Message as Steer** 修改。

用 `mod+shift+m` 選擇模型，用 `mod+shift+h` 選擇 host。`mod+shift+e` 是 effort，`mod+shift+a` 是存取模式（access mode），`mod+shift+x` 是 workspace，`mod+shift+g` 是 Git 分支。workspace 選單包含目前的 checkout、新的 worktree，以及（如果有的話）上一個 worktree。用 `mod+shift+l` 可以直接沿用上一個 worktree。

在模型選擇器裡，搜尋欄位是空的時候按 Left，或是按 Shift+Tab，可以移到 Provider 列表。用 Up/Down 移動，按 Enter 選擇。按 Right 會回到模型搜尋。`mod+shift+up` 和 `mod+shift+down` 會直接切換 Provider，並清空搜尋內容。這些切換 Provider 的快捷鍵也可以在 Settings 裡修改。

這些快捷鍵是在取得焦點的網頁版或桌面版 client 裡執行的。`mod` 在 macOS 上是 Command，在 Windows 和 Linux 上是 Ctrl，包括 GNOME、KDE Plasma、Niri 和 Hyprland。如果你在桌面環境自訂的快捷鍵佔用了相同的按鍵，請在 Settings 裡改用別的綁定。

## 複製 pull request 的參照 {#copy-pull-request-references}

在右側面板或 Pull Requests 頁面開著某個 PR 的時候，用 `mod+shift+c` 複製它的 URL，用 `mod+shift+k` 複製它的編號（前面帶 `#`）。這兩個快捷鍵都可以在 Settings 裡修改，搜尋「Copy Link or Thread ID」或「Copy Number」即可找到。它們複製的是選取中的 PR，而且不會干擾終端機的輸入。

## iPad {#ipad}

接上實體鍵盤時，用 `Cmd+1` 到 `Cmd+9` 開啟畫面上顯示的前九個 Thread。這些快捷鍵會依照目前列表的篩選條件和排序。`Cmd+K` 會開啟指令面板，可以搜尋指令、專案和 Thread。用方向鍵和 Return 選擇結果，或是用 `Cmd+1` 到 `Cmd+9` 直接選取。按 Escape 或 `Cmd+K` 關閉面板。搜尋內容以 `>` 開頭，就只會顯示動作。

在 composer 裡，Return 會送出，`Shift+Return` 會插入換行。`Cmd+Return` 也會送出。如果想讓 Return 改成插入換行，到 Settings → Keyboard 修改 Return 鍵的行為。

## 編輯設定檔 {#edit-the-configuration-file}

快捷鍵儲存在 environment 所在的那台機器上，預設位置是 `~/.t3/userdata/keybindings.json`。你可以直接編輯這個檔案。它是一個由規則組成的 JSON 陣列：

```json
[
  { "key": "mod+g", "command": "terminal.toggle" },
  { "key": "mod+shift+g", "command": "terminal.new", "when": "terminalFocus" }
]
```

T3 Code 會用它的預設值建立這個檔案，並在之後啟動時補上新增的預設值。新的預設值不會取代你自訂過的 command。如果某個新的預設值和你的快捷鍵重疊，由[規則的順序](#precedence)決定執行哪一個。無效的規則會被忽略；如果整個檔案無法解析，T3 Code 會使用預設值。

:::note 檔案在 server 那台機器上
快捷鍵雖然是在 client 上按的，設定檔卻存在 environment 那台機器。所以連到遠端 environment 時，要改的是遠端機器上的 `~/.t3/userdata/keybindings.json`，不是你眼前這台電腦上的。另外要分清楚兩種錯誤：單一規則寫錯，只有那一條會被忽略；但如果整個檔案的 JSON 格式壞掉而無法解析，T3 Code 會改用預設值，你自訂的綁定在修好之前都不會生效。
:::

## 規則的格式 {#rule-shape}

每一條規則都需要一個 `key`（快捷鍵）和一個 `command`（command ID）。選填的 `when` 運算式用來限制它在什麼情況下才執行。

專案 script 使用 `script.{id}.run` 的形式，例如 `script.test.run`。

## 按鍵的寫法 {#key-syntax}

用 `+` 把修飾鍵和一個按鍵接起來，例如 `mod+shift+d` 或 `ctrl+l`。`mod` 在 macOS 上代表 Command，在其他平台代表 Control。其他的修飾鍵有 `cmd` / `meta`、`ctrl` / `control`、`alt` / `option` 和 `shift`。

## When 條件 {#when-conditions}

可用的 context key 有 `terminalFocus`、`terminalOpen`、`previewFocus`、`previewOpen`、`modelPickerOpen`、`usagePageOpen`、`composerFocus`、`composerDraft`、`turnRunning`、`editableFocus`、`isWeb` 和 `isDesktop`。鍵盤焦點在文字欄位、composer 或其他編輯器上的時候，`editableFocus` 為 true。在瀏覽器分頁裡，`isWeb` 為 true。在桌面 app 裡，`isDesktop` 為 true。未知的 key 一律視為 `false`。

`mod+1` 到 `mod+9` 會跳到前九個 Thread；模型選擇器開著的時候，則是跳到對應的模型。這些預設值使用了 `isDesktop`，以免搶走瀏覽器切換分頁的快捷鍵。如果你想在瀏覽器裡也能這樣跳，在 Settings 裡把那個條件移除即可。

用 `!` 表示「非」、`&&` 表示「且」、`||` 表示「或」，再加上括號，就可以把多個 key 組合起來：

```json
{ "key": "mod+j", "command": "terminal.toggle", "when": "terminalOpen && !terminalFocus" }
```

:::plain 這條規則用白話怎麼讀
「按下 `mod+j` 時，如果終端機是開著的（`terminalOpen`），而且鍵盤焦點不在終端機裡（`!terminalFocus`），就執行 `terminal.toggle`。」兩個條件只要有一個不成立，這條規則就當作不存在，按鍵會交給其他符合的規則處理。
:::

## 優先順序 {#precedence}

按鍵和條件都符合的規則裡，最後一條勝出，即使它屬於另一個 command 也一樣。兩條規則共用同一個快捷鍵時，把比較特定的那條放在比較通用的那條後面。

:::example 同一個按鍵，兩條規則
```json
[
  { "key": "mod+g", "command": "terminal.toggle" },
  { "key": "mod+g", "command": "terminal.new", "when": "terminalFocus" }
]
```

焦點在終端機裡的時候，兩條都符合，排在後面的勝出，所以執行的是 `terminal.new`。焦點在別處的時候，第二條的條件不成立，只剩第一條符合，所以執行 `terminal.toggle`。

如果把兩條的順序對調，沒有條件的那條永遠排在最後、永遠符合，這個按鍵就再也不會執行 `terminal.new`。這就是「特定的放後面」的原因。
:::

## 行為特殊的 command {#commands-with-special-behavior}

`thread.stop` 會中斷目前焦點所在 Thread 裡正在執行的 turn。它沒有預設的快捷鍵；請到 **Settings → Keybindings** 指定一個。

`thread.undo`（預設是 `mod+z`）會復原側邊欄底部那則通知裡顯示的動作，例如 unpin、settle（結案）、snooze（暫時擱置）或封存。同一種類的連續動作會一起復原。最後一個動作之後，那則通知會保留五秒。預設的快捷鍵會避開文字欄位和終端機，讓那些地方原生的復原功能照常運作。

`navigation.back`（預設是 `mod+[`）和 `navigation.forward`（`mod+]`）會在你造訪過的頁面之間移動，就像瀏覽器的上一頁和下一頁按鈕。

專案不只一個的時候，`chat.new` 可能會請你選擇專案。`chat.newLocal` 會跳過那個選擇步驟。兩者都會使用你的[新 Thread 預設值](./thread-sidebar.md#start-a-thread)。`chat.newWithoutProject`（`mod+alt+n`）會開始一個[不屬於任何專案](./thread-sidebar.md#start-without-a-project)的 Thread。

## 保留的快捷鍵 {#reserved-shortcuts}

在桌面 app 裡，`mod+w` 會關閉取得焦點的終端機，或是右側面板目前的分頁。沒有東西可以關的時候，它會關閉視窗。在瀏覽器裡，`mod+w` 會關閉瀏覽器分頁；請把 `rightPanel.close` 和 `terminal.close` 重新綁定到一個可用的快捷鍵，例如 `alt+w`。

許多預設值都帶有 `!terminalFocus`，以免攔截終端機的輸入。重新綁定它們時，如果想維持相同的行為，就要保留這個條件。

:::example 在瀏覽器裡改用 alt+w 關閉面板和終端機
預設的兩條 `mod+w` 規則各自帶著條件：`terminal.close` 是 `terminalFocus`，`rightPanel.close` 是 `!terminalFocus`。換按鍵時把條件一起帶過去，行為才會和原本一樣：

```json
[
  { "key": "alt+w", "command": "terminal.close", "when": "terminalFocus" },
  { "key": "alt+w", "command": "rightPanel.close", "when": "!terminalFocus" }
]
```
:::

## 桌面版的結束快捷鍵 {#desktop-quit-shortcut}

在 macOS 用 `Cmd+Q`，在 Windows 和 Linux 用 `Ctrl+Q`。在預設的 **Hold** 模式下，要按住 1.2 秒，或是在 500 毫秒內按兩次。按住的方式需要鍵盤的按鍵重複功能；如果按鍵重複被停用了，請改用按兩次，或是使用應用程式選單。

把 **Settings → General → Confirmations → Quit shortcut** 改成 **Direct**，按一次就會結束；改成 **Double press**，則只接受按兩次。從應用程式選單選擇 **Quit**，一律會立即結束。
