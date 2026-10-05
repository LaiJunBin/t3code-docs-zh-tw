---
title: 匯入瀏覽器的登入狀態
nav: 匯入瀏覽器登入
source: docs/user/browser-import.md
source_hash: 36581c2c7ed277404755d8c04edb9a31cf65fa2c
---

桌面 app 可以從另一個瀏覽器匯入 cookie，讓你在預覽瀏覽器裡沿用那邊已經登入的 session。

:::plain 匯入 cookie 是在做什麼
網站靠 cookie 記住「這個瀏覽器已經登入了」。把 cookie 從你平常用的瀏覽器複製到 T3 Code 的預覽瀏覽器，那些網站在預覽瀏覽器裡就會認得你，不必一個一個重新登入。
:::

開啟 **Settings → Integrations → Browser profiles → Add profile**，然後在 **Import from** 底下選擇一個瀏覽器。匯入之前先關閉來源瀏覽器；如果作業系統跳出解鎖 keyring（鑰匙圈）的提示，請允許它。

這是一次性的複製。之後兩個瀏覽器的登入狀態各自獨立變動，而且有些網站可能還是會要求你重新登入。

在 macOS 上，匯入 Safari 需要 Full Disk Access（完整磁碟取用權限）。選擇 **Allow**，把 T3 Code 拖進 System Settings 的權限清單，並把存取權打開。偵測到存取權之後，**Continue** 就會變成可以按。macOS 可能會要求你結束並重新開啟 T3 Code，授權才會生效；重開之後再重新開啟匯入精靈。匯入完成之後，就可以撤銷 Full Disk Access。

在 Windows 上，匯入功能支援使用標準 profile 加密的 Firefox 和 Helium profile。其他以 Chromium 為基礎的瀏覽器使用 app-bound encryption，無法匯入。Partitioned cookie 在所有平台上都會被略過。
