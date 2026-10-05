---
title: 裝置
source: docs/user/devices.md
source_hash: a87770853a2d54d6db83b27bb8157a418f370147
---

Device 面板會在 Thread 旁邊顯示一台即時的 iOS Simulator 或 Android Emulator，讓你可以看著 agent 驗證行動裝置上的成果，也可以自己動手點那台裝置。agent 則是透過 `device_*` 工具和 `agent-device` 命令列工具操作同一台裝置，這些都由 T3 Code 替它們設定好。

## 開啟裝置 {#open-a-device}

在某個專案的 Thread 裡開啟右側面板，選擇 **Device**。第一次使用時，面板會帶你走過三個步驟：啟動 device hub、檢查 iOS 和 Android 的支援狀況，以及選擇是否允許 agent 控制裝置。光是開啟面板，不會下載或啟動任何東西。如果 hub 已經安裝過，設定畫面會告訴你，並直接沿用它。

:::screenshot device-panel
右側面板的 **Device** 分頁，顯示一台執行中的模擬器畫面，以及裝置的工具列。
:::

選擇一台執行中的裝置就可以觀看它；或是在已停止的裝置旁邊選 **Start** 把它開機。你或 agent 啟動裝置時，面板會顯示出來。每台裝置會開在自己的分頁裡。用 **+ → Device** 再開一台；要重新命名分頁，可以在分頁名稱上按兩下，或是從它的右鍵選單選 **Rename**。只有顯示中的分頁會串流影像；切換分頁時，兩台裝置都會繼續執行。在工具列選 **Float device over chat**，可以讓裝置留在一個小視窗裡繼續觀看和點按，右側面板則可以拿來顯示別的東西；拖曳小視窗的把手可以移動它，從任何一邊都可以調整大小，用 **Open in right panel** 則可以把它放回去。到 **Settings → Integrations → Devices** 關閉 device hub，可以停止那些 helper 行程；模擬器會繼續執行，直到你把它們關機。

模擬器是在執行 environment server 的那台機器上跑的。iOS 需要裝有 Xcode 的 macOS。Android 需要 SDK Platform-Tools、Android Emulator 和 Command-line Tools (latest)，另外還要在 Android Studio 的 Device Manager 裡建立一台虛擬裝置。T3 Code 會偵測標準的 SDK 位置；如果裝在自訂的位置，請設定 `ANDROID_HOME`。缺少哪些相依項目，面板會說明。安裝好之後，重新啟動 environment server，並重新整理裝置列表。

:::note 模擬器跑在 server 那台機器，不是你眼前這台
你在面板裡看到的是從 server 串流過來的畫面。所以 Xcode、Android SDK 要裝在實際跑模擬器的那台機器上，預設就是執行 environment server 的那一台。舉例來說，如果 server 跑在一台 Linux 遠端機器上，那台機器本身就沒辦法提供 iOS Simulator，即使你是用 Mac 連過去也一樣。這種情況可以另外加一台 Mac 當作裝置主機，見下方的 [SSH 裝置主機](#ssh-device-hosts)。
:::

螢幕是可以互動的：點擊和拖曳就是觸控，螢幕取得焦點時可以直接打字。工具列在 Android 上提供 Home、Back 和 Recents，在 iOS 上提供旋轉，另外還有關機。關閉分頁會停止觀看；除非你把裝置關機，否則它會繼續執行。關掉的分頁在重新載入之後仍然是關閉的。想再觀看那台裝置，從 **+ → Device** 選它即可。

選擇 **3D view**，可以檢視支援的裝置，同時即時螢幕仍然可以互動。在 iPhone Duo 上，用摺疊和擺放姿勢的控制項改變它的實體姿態，或是在裝置上用兩指縮放來調整轉軸。把模型轉到另一面螢幕，即時畫面和觸控輸入也會切換到那一面螢幕。**Restore 3D view** 會讓裝置回到螢幕朝前的位置。在支援的 Android 摺疊裝置上，用螢幕旁邊的 **Fold device** 和 **Unfold device**，可以在兩種檢視下改變它的姿態。

## 工具 {#tools}

工具列上的 **Tools** 按鈕會為目前開啟的裝置打開一個抽屜。它會顯示前景 app，並讓你切換淺色和深色模式、改變文字大小、切換無障礙設定、把無障礙元素的外框疊在螢幕上、設定假的位置，以及授予或撤銷 app 權限。iOS 另外提供 Liquid Glass、色彩濾鏡、VoiceOver，以及傳送測試用的推播通知；Android 則多了螢幕方向和網路開關。抽屜只會顯示該平台做得到的項目，而且每個控制項顯示的，都是變更之後從裝置讀回來的值。

## Agent 與裝置 {#agents-and-devices}

agent 開啟一台裝置時，在連到那個 Thread 的網頁版和桌面版 client 上，裝置會浮在對話上方，和 agent 操作的瀏覽器是同樣的呈現方式。到 **Settings → Integrations → Browser** 關閉 **Auto-show floating preview**，就會改成在右側面板開一個分頁。在手機 app 裡，開啟那個 agent 的 Thread，點一下訊息輸入框（composer）上方的裝置按鈕，就可以觀看即時螢幕並操作它。如果這個 Thread 開著好幾台裝置，在檢視器裡選擇其中一台。關閉檢視器會停止串流，但裝置仍然可以讓 agent 使用。裝置的活動也會出現在 Thread 的時間軸裡。

agent 是透過 `agent-device` 命令列工具來操作裝置的。只有在啟用 **Agent device access** 之後，T3 Code 才會安裝並啟動它。iOS 的點按操作在第一次使用時會建置一個小型的 test runner，每個 server 只需要做一次，要花幾分鐘。授予存取權之後，要重新啟動既有的 agent session，它才會取得裝置 CLI 的環境。

:::example 請 agent 在模擬器上驗證成果
先確認兩件事：**Settings → Integrations → Devices** 裡的 **Agent device access** 已經開啟；如果是在開啟之前就已經在跑的 agent session，要先重新啟動它。接著就可以直接交代：

```text
請在 iOS Simulator 上打開這個 app，走一遍登入流程，確認登入後會進到首頁。有問題的話截圖給我看。
```

agent 操作的時候，裝置畫面會浮在對話上方，你可以即時看它點了哪裡，也可以自己伸手進去點。要注意 T3 Code 只負責裝置的探索、串流和控制；app 要怎麼建置、怎麼裝進模擬器，仍然要由你或 agent 用專案自己的指令來處理。
:::

想讓 agent 不能碰模擬器，到 **Settings → Integrations → Devices** 關閉 **Agent device access**。這樣一來，從那之後才啟動的 agent 就看不到裝置工具；你自己的 Device 面板不受影響。

## 遠端連線 {#remote-connections}

裝置的串流會經過 environment server，所以在區域網路、Tailscale 和 T3 Connect 上都可以運作。即時影像需要安全的頁面（HTTPS 或 localhost）；如果是純 HTTP 的遠端來源，iOS 會退而使用比較慢的靜態圖片串流，Android 則無法顯示影像。

:::plain 用 http:// 加 IP 連線時，為什麼畫面卡卡的或看不到
即時影像只能在「安全的頁面」上使用，也就是網址以 `https://` 開頭，或是 `localhost`。如果你是用 `http://` 加上區域網路 IP 這種方式連到遠端 server，就不算安全的頁面：iOS 的畫面會變成一張一張更新的圖片，Android 則完全沒有畫面。改用有 HTTPS 的連線方式就能解決。
:::

## SSH 裝置主機 {#ssh-device-hosts}

在 Settings → Integrations → Devices 裡，選擇要使用這台主機的 environment，並把它加到 **Device hosts** 底下。輸入 SSH 別名或 `user@host`，identity file 和 port 可以選填。這些資訊是在 environment server 上解析的，所以要使用那台機器上可用的 SSH 設定和金鑰。不支援密碼提示。

:::note SSH 是從 server 連出去的
這裡填的別名、金鑰路徑，都是以 environment server 那台機器的角度來看的，不是你眼前這台裝置。所以金鑰要放在 server 上，別名要寫在 server 的 SSH 設定裡。另外因為不支援輸入密碼，那台主機必須能用金鑰登入。
:::

**Test connection** 會檢查 SSH、Node、npm 和平台工具，不會安裝任何東西，並針對每一個選定的 environment 各給一個結果。如果目標解析出來就是 environment 自己那台機器，會被跳過，因為它的裝置本來就是本機的。第一次列出裝置時，會在那台主機上安裝固定版本的裝置工具。非互動式的 SSH 指令必須能夠使用 Node 22 以上的版本和 npm。T3 會檢查常見的 Homebrew 和 Android SDK 位置；自訂的安裝位置，需要在主機上設定好對應的 PATH 和 ANDROID_HOME。

設定了多台主機時，選擇器會依主機來標示裝置。連線中斷之後會自行恢復。移除一台主機，會關閉它的裝置 session，並在連得上的情況下停止它的 T3 helper；模擬器會繼續執行。

T3 提供的是探索、串流和控制。app 的建置、安裝，以及連到 Metro 這類開發伺服器的連線，要另外安排。位在另一台機器上的模擬器，沒辦法透過你 environment 的 localhost 連到 Metro，除非有做轉送，或是有另一個連得到的位址。

:::plain 為什麼遠端的模擬器連不到 Metro
`localhost` 的意思永遠是「我自己這台機器」。Metro 跑在 environment 那台機器上，模擬器卻跑在另一台裝置主機上，所以模擬器裡的 app 去連 `localhost`，找到的是裝置主機自己，那裡並沒有 Metro。要讓它連得到，就得把連接埠轉送過去，或是讓 app 改連一個從裝置主機連得到的位址。
:::

## 裝置工具的更新 {#device-tool-updates}

已連線的 T3 server 會管理它自己那台機器上，以及已設定的 SSH 主機上的 device hub 和 agent 工具。下次用到這些工具時，會自動安裝所需的版本。Settings → Integrations → Check device tool versions 會讀取已安裝的版本，不會安裝工具，也不會啟動裝置。

想在遠端 environment 上取得較新的工具版本，要更新那個 environment 的 T3 server。只更新瀏覽器或手機 app，不會更新遠端的 server。離線的主機會保留已經安裝的檔案，但更新需要有網路連線，裝置支援才能啟動；T3 不會退回使用較舊的版本。如果安裝失敗，重新連上主機之後使用 Retry。既有的裝置設定和 agent 存取設定都會保留。
