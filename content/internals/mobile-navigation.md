---
title: 手機版導覽
source: docs/internals/mobile-navigation.md
source_hash: 94bd550d142daad57796252e3057db2ddd483dd9
---

Home 和 Thread 的 route 共用同一個 [root native stack](../../apps/mobile/src/Stack.tsx)，這樣 UIKit 才能在同一個 navigation controller 裡為 header 做動畫。iPad 的側邊欄有它自己的 stack。把 Home 和 Thread 拆到不同的 controller，就會失去這個連續的轉場效果。

## UIKit 的限制 {#uikit-constraints}

[react-native-screens patch](../../patches/react-native-screens@4.26.2.patch) 保留了一些在修改原生 header 時很容易弄壞的行為：

- 品牌標誌要放在 `headerTitle`。在 iOS 26.5 上，UIKit 會把一個沒有背景的 leading toolbar item 的矩形，變形成下一個畫面的玻璃質感返回按鈕，即使這些 item 的 identifier 不同也一樣。
- UIKit 的 scroll-edge 淡出效果不認得 Fabric 的 text view。一個空的原生 label 提供了自訂標題的幾何資訊。移除這個看起來沒在用的 view，會改變淡出效果。
- Leading、trailing 和 center 這三組 item 需要各自獨立的快取。一個按鈕只能屬於一個群組；重建一個沒有變動的群組，可能會把它的按鈕從 UIKit 還在做動畫的群組裡拉出來。快取的所有權也包含 header config，它的 event emitter 會在重新掛載時改變。
- 位在 leading 邊緣的水平 ScrollView，必須讓位給全螢幕的返回手勢。Upstream 讓每一個水平 ScrollView 都有優先權，所以在程式碼區塊或表格上往回滑，只會讓它的內容彈一下。

:::note 動原生 header 之前
上面每一條都是「看起來多餘、拿掉就會壞」的東西：一個空的 label、三份分開的快取、標誌放的位置。這些都是為了配合 UIKit 的行為而刻意保留的，不要因為看不出用途就清掉。
:::

這個 patch 新增了原生的 header prop，需要重新產生程式碼並建置新的 binary。重建 patch 的說明放在[手機版開發 README](../../apps/mobile/README.md#development)。

## 原生媒體呈現 {#native-media-presentations}

iOS 把全螢幕影片交給 [AVKit](../../apps/mobile/modules/t3-native-controls/ios/T3NativeVideoPresentation.swift)，把圖片和文件交給 [Quick Look](../../apps/mobile/modules/t3-native-controls/ios/T3NativeFilePresentation.swift)。這兩個 framework 各自擁有自己的控制項和轉場。另外加一個 UIKit 的 zoom 轉場，會讓 AVKit 原生的 Close 動作無法離開全螢幕，也會干擾 Quick Look 以互動方式回到縮圖的過程。AVKit 的進入點 selector 有做防護，退路是標準的 modal 呈現方式。

[縮圖註冊](../../apps/mobile/modules/t3-native-controls/ios/T3NativePresentation.swift)持有 view 的弱參考，用來當作轉場和分享面板（share sheet）的錨點。它並不擁有預覽；原生呈現還開著的時候，來源那一列可能會消失。Identifier 必須能區分同時可見的多個附件。原生的 promise 會在關閉之後才完成，這樣呼叫端就會一直持有本機檔案的 lease，直到預覽或分享流程結束為止。

關閉的請求要視為「等待中」，直到 UIKit 完成它目前的轉場。在呈現動作或互動式關閉還沒塵埃落定時，又啟動另一次關閉，可能會讓 controller 卡住。影片的清理工作只有在音訊設定仍然和預覽當時的設定相符時，才會還原先前的音訊設定。它不可以停用共用的 audio session，因為那個 session 可能屬於另一個播放器或錄音程式。

影片播放會在整個預覽期間，一直持有第一個簽署過的 asset URL。如果隨著憑證更新而反應式地跟著換，會讓播放重新開始。Quick Look 會把原始的位元組複製到它自己的暫存目錄，這樣預覽和分享就不可能改動到草稿或 workspace 裡的檔案。
