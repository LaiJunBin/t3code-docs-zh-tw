---
title: Linux 視窗擷取
source: docs/internals/linux-snap-shot.md
source_hash: 81846c7a42b55cbcee82bb066adc55490997223a
---

只支援 Wayland。每一次擷取都會在 `LinuxSnapShot.ts` 裡挑選一個 backend（Hyprland helper、Niri IPC、KDE helper、以作用中視窗為目標的 Screenshot portal、GNOME extension，最後是 Electron picker），而且在失敗、取消或被拒絕時，絕對不會退而改用另一個。一個過期的 `NIRI_SOCKET`，或是一個連得上的 GNOME extension，都不可以讓程式選到另一個桌面環境的 backend；session 的偵測來自 `XDG_CURRENT_DESKTOP`，寫在 `linuxCaptureSession.ts` 裡。

:::plain 一次擷取只用一種方法
程式先看 `XDG_CURRENT_DESKTOP` 判斷你用的是哪一種桌面環境，再決定這次擷取要走哪一條路。選定之後就不換：就算失敗、使用者按了取消或拒絕授權，也不會偷偷改試另一種方法。環境裡殘留的其他線索（例如別的桌面留下的 socket 變數）不能拿來當判斷依據。
:::

## 模組界線 {#module-boundaries}

`dbus-next` 只能透過動態 import 來取用。`linuxCaptureSession.ts` 放的是純函式的 helper（session 偵測、Niri 綁定的文字、portal 按鍵對應、PNG 讀取），這樣 main process 就能回答「這是哪一種桌面」，而不必在 macOS 或 Windows 上載入 D-Bus client。

`patches/dbus-next@0.10.2.patch` 移除了 `usocket`（它選用的原生 Unix-FD 傳輸），並且透過 Node 的 `net` 連到 `unix:path=` 和 `unix:abstract=` 兩種 bus。我們從來不傳遞 Unix descriptor，而 upstream 對 abstract socket 沒有 `net` 的 fallback；`dbus-launch` 在 systemd 之外產生的正是 abstract socket。升級 `dbus-next` 時要保留這個 patch。

## 無障礙身分 {#accessibility-identity}

Screenshot portal 傳回的是一個 PNG URI，沒有視窗身分，所以 portal 和 picker 的擷取都不帶無障礙資料。不要從之後取得焦點的視窗、或是猜測的標題去推斷它。

原生 backend 會提供 PID、標題和 frame。AT-SPI 的比對方式是 PID，加上唯一的標題與大小相符。在 Wayland 上，即使 compositor 知道視窗真正的螢幕位置，AT-SPI 回報的仍然是 `(0, 0)`，所以只比較寬度和高度；而且只有在 AT-SPI 的 root 和 compositor 的 frame 一致、並且至少有一個子孫節點回報了不同的位置時，才信任子孫節點的座標。否則 bounds 會是 `null`，而不是原點為零的矩形。

標題比對會忽略開頭的單一個點字（Braille）CLI spinner 影格，因為終端機會在擷取和查詢之間改變它。KDE 同時提供 `frameGeometry` 和 `clientGeometry`；兩者之中任何一個通過驗證的大小都可以接受，但絕對不要用「裝飾高度的容許誤差」來放寬。

在 GNOME 上，瀏覽器的無障礙 bridge 需要在瀏覽器啟動之前，就先設好 `org.gnome.desktop.interface toolkit-accessibility`。不要在擷取的過程中切換它。

## KDE {#kde}

KWin 授權 `org.kde.KWin.ScreenShot2` 的方式，是把呼叫端 PID 的執行檔拿去對照它的應用程式登錄，所以 helper 是安裝在 XDG data home 底下的一個固定路徑，並搭配一個隱藏的 desktop entry，而不是從 AppImage 的掛載點執行。有兩個陷阱：

- `X-KDE-DBUS-Restricted-Interfaces` 使用的是 KConfig 以逗號分隔的清單語法。結尾多一個分號，會變成介面名稱的一部分，KWin 就會拒絕它。
- KService 的快取鍵包含搜尋路徑和 locale。要用 `kbuildsycoca6` 重新整理，直接執行一次，再透過 `systemd-run --user` 執行一次；如果只在 AppImage 的環境裡重新整理，KWin 可能還在讀取過期的權限。

就緒檢查的做法是：用一個無效的 ID 呼叫 `CaptureWindow`，並預期得到 `InvalidWindow`；這個結果是在 KWin 的授權檢查之後才會出現的。光是磁碟上有檔案，絕對不代表已經就緒。

Plasma 會把 Shift 用在「Shift 加數字鍵」上，產生一個標點符號的 keysym，所以一個成功綁定的 `Ctrl+Shift+2`，在某些鍵盤配置上可能永遠不會觸發。使用字母組合鍵可以繞過這個問題。通用的修法需要能感知鍵盤配置的編碼方式。

## Hyprland {#hyprland}

Helper 會先用 `hyprland-toplevel-mapping-v1` 把 foreign-toplevel handle 對應到完整的 64 位元視窗位址，再透過 `hyprland-toplevel-export-v1` 匯出。絕對不要截短這個位址，也不要依標題來挑選視窗。

在使用者拒絕同意、或是套用了 `no_screen_share` 規則時，Hyprland 0.56.2 不會讓匯出的影格失敗，而是繪製一張「存取被拒」的 texture。`ready` 並不代表取得了權限，也不可以靠檢查像素去猜測是否取得權限。參見 [ScreenshareFrame](https://github.com/hyprwm/Hyprland/blob/v0.56.2/src/managers/screenshare/ScreenshareFrame.cpp)。

Hyprland 的 GlobalShortcuts portal 註冊的是動作，不是按鍵組合。`shortcutActionRegistered` 和 `shortcutRegistered` 是不同的；UI 裡任何地方都不可以宣稱按鍵已經被保留。

隨附的 protocol XML 會跟著 helper 一起出貨，因為它的 BSD 授權要求附上聲明。

## Niri {#niri}

Niri 沒有實作 global-shortcut portal。擷取功能啟用期間，app 會在 session bus 上擁有 `<app-id>.SnapShot`，並匯出 `com.t3tools.SnapShot.Capture`；設定檔裡的綁定會啟動 `gdbus` 來呼叫它。開發版和打包版的 app ID 使用不同的名稱，這樣開發版 build 才不會搶走使用者的綁定。

Niri 不提供全域的螢幕截圖原點，所以 AT-SPI 的比對只使用邏輯大小和標題。

## 設定檔的編輯 {#config-edits}

`CaptureShortcutConfig` 會編輯使用者的 dotfile。不變條件如下：開啟設定畫面時絕對不讀取檔案；**Review changes** 才是讀取的同意；renderer 只會透過受信任的 desktop IPC 看到修改前與修改後的文字；**Save** 送出的是一個 proposal ID，而 desktop 在寫入之前，會對照它先前預覽時的 snapshot，重新驗證位元組內容、inode、mode 和 include。寫入的方式是先寫到一個暫存檔，再做原子性的 rename，並在原檔旁邊留一份備份。Niri 會先驗證那個暫存檔。

:::plain 為什麼改設定檔要這麼多道手續
這個功能會去改使用者自己的桌面設定檔，所以每一步都要經過使用者同意：沒按 **Review changes** 之前不讀檔；按 **Save** 時，程式會再確認檔案和剛才預覽時是同一份、沒有被別人改過，才動手寫入。寫入時先寫暫存檔再一次換過去，並留下備份，避免寫到一半出錯而留下壞掉的設定檔。
:::

修飾鍵的序列化會明確寫出 Linux 的 `Ctrl`，絕對不使用跨平台的 `mod` 別名。

## GNOME extension {#gnome-extension}

原始碼在 `apps/desktop/gnome-extension`，UUID 是 `snap-shot@t3.codes`。GNOME 只會在登入時發現新安裝的 extension，所以設定流程會區分「已安裝，需要登出」和「已被發現但停用中」，並比較已載入的版本和已安裝的版本。

這個 extension 信任在同一條連線上擁有 `com.t3tools.T3Code.SnapShot`（或 `.Development` 變體）的呼叫端。這是 GNOME 的 trusted-session-client 模式，不是用來對抗使用者 bus 上惡意行程的身分驗證。

Electron 在 Wayland 上不會定位 overlay 視窗，所以閃光（flash）和飛行（flight）效果是以 Shell actor 的形式在 extension 裡執行，座標相對於 T3 的內容區域。Electron 44 的「還原 session」路徑可能會跳過重新綁定，並在取消註冊時留下 callback，這就是為什麼 `PortalCaptureShortcut` 擁有自己的 portal session，而不使用 Electron 的 global-shortcut API。

GNOME 50 移除了 `Meta.is_wayland_compositor`。Shell 的內部實作會隨著主要版本改變；把某個版本加進 `metadata.json` 之前，要先逐一驗證。
