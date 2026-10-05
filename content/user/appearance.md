---
title: 外觀與主題
source: docs/user/appearance.md
source_hash: ec02a28ed787ab2c18799b38ffd573eecc753433
---

在網頁版和桌面版，開啟 **Settings → Appearance** 可以選擇主題，並決定要跟隨系統的外觀，還是固定使用淺色或深色模式。如果想讓淺色和深色模式使用不同的主題，在各個主題裡選取對應的預覽圖即可。外觀偏好設定是每一台裝置、每一個瀏覽器分開儲存的。

:::screenshot appearance-settings
**Settings → Appearance** 頁面，可以看到主題列表，每個主題各有淺色與深色的預覽圖。
:::

在網頁版和桌面版，可以用指令面板裡的 **Change theme** 來選主題，不必離開對話。在 macOS 按 **Cmd+Option+A**，或在 Windows/Linux 按 **Ctrl+Alt+A**，可以直接開啟主題選擇器。用指令面板裡的 **Change appearance**，可以選擇 System、Light 或 Dark，這和主題是分開的兩件事。macOS 的 **Cmd+Option+Shift+A**，或 Windows/Linux 的 **Ctrl+Alt+Shift+A**，會在這幾個模式之間循環切換。這些快捷鍵可以在 **Settings → Keybindings** 裡自訂。

:::plain 「主題」和「外觀」差在哪裡
外觀（appearance）只有三個選項：跟隨系統、淺色、深色，決定的是現在要亮還是要暗。主題（theme）是一整組配色。兩者分開設定，所以你可以替淺色模式挑一個主題、替深色模式挑另一個，之後切換外觀時，就會自動換成對應的那個主題。
:::

在手機上，開啟 **Settings → Appearance**。手機版有自己的主題，以及自己的文字、程式碼和終端機偏好設定。它不會跟隨 environment 的主題或預設值。

在 Android 12 以上的版本，可以在 Appearance 裡選擇 **Material You** 主題，使用從你的桌布取出的顏色。選擇其他主題就會換掉那些顏色。和其他主題一樣，Material You 也可以分別為淺色和深色外觀選用。Android 預設會使用 **Material You Layout**，除非你在 Appearance 裡把它關掉。它改變的是形狀、間距和控制項，和選用哪個主題無關。

## Composer context {#composer-context}

以 Git 管理的專案，在你建立 Thread 的時候，訊息輸入框（composer）下方會顯示分支和 worktree 的控制項。送出第一則訊息之後，composer 會停靠到定位，這些控制項也會跟著收起來。

開啟 **Composer context**，可以讓這些控制項在 Thread 開始之後繼續顯示。這個偏好設定適用於網頁版和桌面版 client。

## 動態效果 {#motion}

主側邊欄、右側面板和終端機抽屜，預設是立即開啟和關閉的。把 **Panel animations** 滑桿調到 0 ms 以上就會加入動態效果，最高 400 ms；但如果作業系統啟用了「減少動態效果」，就不會有動態。在 Thread 之間切換時，畫面一律直接跳到所選 Thread 的面板狀態，不會重播它的轉場。

## 自訂主題 {#custom-themes}

在網頁版和桌面版，選擇 **Create theme** 可以調整一組配色，或是匯入 T3 Code 或 VS Code 的主題。主題編輯器的選色工具可以讓你直接點選 app 裡的某個區域，找出要改的是哪個顏色。把主題匯出成 JSON 就可以分享給別人。

## Environment 主題 {#environment-themes}

Environment 的主題和預設值，來自提供你網頁 app 的那個 server，或是桌面 app 的主要本機 environment。app.t3.codes 和另外新增的連線不會使用它們。

:::plain 誰會吃到 environment 主題
這個功能讓 server 那一端可以發布主題，並指定一個預設主題給連上來的 client。會套用的只有兩種情況：你用瀏覽器直接打開那個 server 提供的網頁，或是桌面 app 內建的那個本機 environment。如果你是從 app.t3.codes 連過去，或那只是你額外加進來的一條連線，它的主題設定就跟你無關。
:::

在 **Settings → Appearance** 選擇一個已發布的主題，之後 server 更新它的配色時，你這邊也會跟著變。**Duplicate** 會建立一份獨立的複本，可以自行編輯。如果有一個已儲存的自訂主題用了相同的 ID，會以自訂主題為優先。如果 server 不再發布你選的那個主題，T3 Code 會退回它的標準主題。

在 server 上執行這個指令，可以設定預設主題，並把已連線的 client 切換過去：

```bash
t3 theme set nightfall
```

離線中的 client 會在重新連線時套用。每個 client 只會套用這個設定一次；之後自己選了別的主題，就會一直維持，直到下一次 `t3 theme set` 為止。即使名稱沒變，再執行一次這個指令也會重新套用。

`t3 theme clear` 會移除預設主題，但不會改變任何人目前使用的主題。`t3 theme show` 會列出預設主題和已發布的主題。

### 發布主題 {#publish-a-theme}

把從 T3 Code 匯出的主題，存到 server 上的 `~/.t3/userdata/themes/`；如果你用的是自訂的 state 目錄，就存到它底下的 `themes` 目錄。檔名就是主題的 ID：`nightfall.json` 可以用 `t3 theme set nightfall` 選用。更新配色時，檔名要保持不變。不要使用 `system`、`light`、`dark`，或是內建主題的 ID。

如果是由某個整合工具來產生配色，也可以用這種比較短的格式：

```json
{
  "name": "Nightfall",
  "appearance": "dark",
  "canvas": "#1a1b26",
  "accent": "#7aa2f7",
  "colors": {
    "terminalSelection": "#292e42",
    "error": "#f7768e"
  }
}
```

把 `appearance` 設成 `light` 或 `dark`，並為 `canvas` 和 `accent` 提供十六進位色碼。其餘的顏色由 T3 Code 產生。選填的 `colors` 用來覆寫個別顏色，使用的名稱和主題編輯器進階檢視裡的相同。

更新時，先寫到一個暫存檔，再把它改名到正式位置，這樣 client 就絕對不會讀到寫到一半的主題。無效的檔案不會被發布。

:::example 發布並套用一個主題的完整流程
假設新的配色已經產生在 `/tmp/nightfall.json`。在 server 那台機器上：

```bash
cp /tmp/nightfall.json ~/.t3/userdata/themes/nightfall.json.tmp
mv ~/.t3/userdata/themes/nightfall.json.tmp ~/.t3/userdata/themes/nightfall.json
t3 theme show            # 確認 nightfall 出現在已發布的主題裡
t3 theme set nightfall   # 設為預設，並把已連線的 client 切過去
```

先複製成 `.tmp` 再用 `mv` 改名，就是上面說的「暫存檔再改名」。T3 Code 只會讀取檔名結尾是 `.json` 的檔案，所以複製到一半的 `.tmp` 檔不會被當成主題。
:::
