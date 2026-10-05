---
title: SnapShot
source: docs/user/snap-shot.md
source_hash: ec554b5161f6c312b60fef4e95643b3085b23fa2
---

SnapShot 會擷取你正在使用的那個視窗，並把它附加到你目前的草稿上。這個附件會帶著 app 名稱和視窗標題；如果取得得到，還會帶著 app 圖示，以及視窗的無障礙資料（accessibility data，也就是視窗裡的控制項、文字，以及它們在圖片中的位置）。agent 可以利用這些資料來理解這張截圖。

:::plain 無障礙資料是什麼，為什麼對 agent 有用
作業系統為了讓螢幕閱讀器這類輔助工具能運作，會提供一份「這個視窗裡有哪些按鈕、欄位和文字，各自在哪個位置」的結構化描述，這就是無障礙資料。只有圖片時，agent 得自己從像素去辨認畫面上有什麼；附上這份資料之後，它可以直接讀到控制項和文字的內容，以及它們對應到圖片的哪個位置。
:::

SnapShot 預設是關閉的，可以在桌面 app 上使用，支援 macOS、Windows，以及使用 Wayland 的 Linux。不支援 X11 session。

:::note 怎麼知道自己的 Linux 是 Wayland 還是 X11
在終端機執行下面這行。顯示 `wayland` 才能使用 SnapShot，顯示 `x11` 就不支援。

```bash
echo $XDG_SESSION_TYPE
```
:::

## 開啟功能 {#turning-it-on}

開啟 **Settings** > **SnapShots**，把這個功能打開。設定過程有兩個步驟：先允許擷取，再選擇快捷鍵。每個步驟只會顯示你的桌面環境需要的項目。**Finish later** 會把擷取功能關回去，但會保留你已經安裝的東西，所以之後可以從中斷的地方繼續。

- **macOS** 會在設定過程中要求 Screen Recording（螢幕錄製）權限。只有在 **Include app text** 開啟時，才會要求 Accessibility（輔助使用）權限。
- **Windows** 不需要任何設定或權限。
- **Linux** 要看你用的桌面環境。見 [Linux 桌面環境](#linux-desktops)。

關閉擷取功能會釋放快捷鍵。它不會解除安裝你裝過的 helper 或擴充套件。

:::screenshot snapshot-settings
**Settings** 裡的 **SnapShots** 頁面，功能已開啟，可以看到快捷鍵、**Include app text**，以及音效、閃光和動畫的開關。
:::

## 進行擷取 {#taking-a-capture}

切換到你想擷取的視窗，然後按下快捷鍵。macOS 和 Windows 的預設快捷鍵是同時按下兩個 Shift 鍵。T3 Code 會把圖片附加到你的草稿，並把自己帶到最前面。如果沒有開啟任何 Thread，它會在目前的專案裡開始一份草稿。

T3 Code 在最前面的時候按下快捷鍵，擷取到的就是 T3 Code 自己。

等待處理的擷取內容會保留在磁碟上，直到附件儲存到草稿為止，所以即使中途關閉 app，擷取內容也不會遺失，下次啟動時會附加上去。因為圖片太大而被拒絕的擷取內容則會被捨棄。

:::example 把瀏覽器裡的畫面問題交給 agent
1. 在 T3 Code 裡開著要處理這個問題的 Thread。
2. 切換到瀏覽器，停在出問題的那個畫面。
3. 同時按下兩個 Shift 鍵（macOS 和 Windows 的預設快捷鍵）。
4. T3 Code 會自己跳回最前面，截圖已經附在草稿上。補一句說明再送出即可。

順序很重要：要先切到目標視窗再按快捷鍵。如果按的時候最前面的是 T3 Code，擷取到的會是 T3 Code 自己。
:::

## 更改快捷鍵 {#changing-the-shortcut}

在 Settings 裡選取快捷鍵，按下新的按鍵，然後按 **Save**。在 macOS 和 Windows 上，可以使用一對修飾鍵（例如 Command+Command 或 Ctrl+Ctrl），或是一組按鍵組合。和 T3 Code 自己的快捷鍵衝突的，或是作業系統已經保留的快捷鍵，T3 Code 會拒絕。

在 Linux 上，請選擇一組按鍵組合；不支援修飾鍵成對的方式。在 Niri 和 Hyprland 上，快捷鍵是寫在你的 compositor 設定檔裡的，所以 **Change shortcut** 會重新開啟設定流程，讓你檢視這次的變更。

## Include app text {#include-app-text}

**Include app text** 控制擷取內容是否包含視窗的無障礙資料。關閉它就只會附加截圖。在 macOS 上，這也會讓 T3 Code 不再需要 Accessibility 權限。

能不能取得資料，要看各個 app。有些 app 只提供它們的視窗控制項，不提供文件或終端機的內容。如果某個 app 回應得很慢，T3 Code 會直接附上不含資料的截圖，不會一直等下去。

在 GNOME 上，瀏覽器可能需要先在桌面環境的無障礙設定裡啟用 app 無障礙功能，才會提供文字。啟用之後要重新啟動瀏覽器。

附件上 app 名稱旁邊的圖示，會顯示這次是否包含了無障礙資料。選取它可以檢視擷取到了什麼。

## 音效、閃光與動畫 {#sound-flash-and-animation}

Settings 可以控制擷取時的音效、被擷取視窗上短暫的閃光，以及圖片飛進草稿的動畫。每一項都可以單獨關閉。作業系統的「減少動態效果」設定也會停用這個動畫。

## Linux 桌面環境 {#linux-desktops}

SnapShot 可以在 Wayland session 上運作。每種桌面環境提供擷取功能的方式都不同，設定流程會顯示你目前桌面環境的名稱，並且只顯示它需要的項目。偏好設定在各個桌面環境之間是共用的，但每個桌面環境的 helper 和快捷鍵核准是分開的。

**GNOME。** 在設定過程中安裝內附的 **T3 Code SnapShots** 擴充套件。它是以個別使用者為單位、離線安裝的，不需要管理員密碼。第一次安裝之後要登出再登入，GNOME 才會找到它；接著從設定流程或 GNOME 的 Extensions app 啟用它。如果 GNOME 停用了所有使用者擴充套件，要先在那裡把它們打開。要撤銷存取權，在 GNOME 的 Extensions app 裡停用或移除這個擴充套件。

**KDE Plasma 6。** 在設定過程中安裝內附的擷取 helper；不需要登出。如果快捷鍵沒有反應，檢查 **System Settings** > **Keyboard** > **Shortcuts** 底下的 T3 Code。如果用到 Shift 加數字的快捷鍵在你的鍵盤配置上無法運作，請改用字母的按鍵組合。要移除 helper，到 **Manage capture** > **Access** > **Advanced**。

**Hyprland 與 Omarchy。** 在設定過程中安裝內附的 helper，然後選擇快捷鍵，再選 **Review changes**。T3 Code 會顯示它將對你的 Hyprland 設定檔做的確切變更。**Save shortcut** 只會寫入那一項變更、保留一份備份，並重新載入 Hyprland。如果出現 helper 的螢幕分享提示，請核准它。在 Omarchy 上，請綁定在你自己的設定檔裡，不要改隨附的預設檔。有些 Hyprland 版本在擷取被擋下時，會回傳一張「access denied」的圖片，而不是錯誤；這時請檢查 helper 的螢幕分享權限。

**Niri。** 選擇快捷鍵，再選 **Review changes**。T3 Code 會顯示它將加到你的 Niri 設定檔裡的確切綁定，驗證結果、保留一份備份，並在你核准之後儲存。Niri 會自己重新載入設定檔。這個綁定需要 `gdbus` 指令，它通常包含在你的發行版的 GLib 工具裡。要釋放這個按鍵，把那一行從設定檔裡移除即可。

**其他 Wayland 桌面環境。** 如果桌面環境的截圖 portal 能夠擷取使用中的視窗，T3 Code 就會使用它。否則 Settings 會顯示 **Manual capture only**，快捷鍵會開啟桌面環境的視窗選擇器。透過選擇器擷取的內容不包含無障礙資料。

在 Wayland session 裡透過 XWayland 執行的 app，仍然可以被擷取。
