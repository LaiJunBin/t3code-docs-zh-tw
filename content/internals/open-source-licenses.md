---
title: 開放原始碼授權聲明
nav: 開源授權聲明
source: docs/internals/open-source-licenses.md
source_hash: 8bac6010bfad17afdb232ee2b4f1ff397680d914
---

授權聲明是針對「實際隨附它的那個 client」各自獨立產生的：

- Web 的 build 會在 `index.html` 旁邊產生 `third-party-licenses.json`。Settings 頁面載入的就是這個靜態檔案，所以同一份產出物在託管的 web 版、隨 `npx t3` 附帶的 client，以及 desktop 上都能使用。
- 手機版的 Metro 設定會在每一次開發、原生或 over-the-air 的 JavaScript bundle 之前，產生一個被 ignore 的虛擬模組。手機版只有在開啟授權畫面時才載入並解碼那個模組，所以聲明的文字在一般的 app 啟動過程中不會佔用記憶體。它不需要發出網路請求。

這兩條路徑都不依賴已連線的 environment，也不依賴 RPC。

## Build 會收集什麼 {#what-the-build-collects}

產生器會沿著已安裝的 production 和 optional 相依套件一路追下去，包含 workspace package 的相依套件，並略過第一方的 `@t3tools/*` package。Web 的 manifest 從 web、server 和 desktop 的 package manifest 出發。手機版的 manifest 從 mobile 的 package manifest 出發。在 web bundle 的過程中，產生器還會檢查輸出的 module id，用來抓出「有被 bundle 進去、卻沒有列在 package manifest 裡」的 npm import。

手機版的 manifest 刻意沿用 Expo 和 React Native 所宣告的完整 production 相依閉包（dependency closure）。這是保守的做法，可能會把最終 JavaScript bundle 裡並不存在的建置工具也算進來，但可以避免在平台的 bundling 方式改變時漏掉某一則聲明。

只要收集到的 package 沒有可供散布的授權識別碼，或是不含任何授權或聲明文字，build 就會失敗。產生的聲明使用的是固定版本（pinned）的 SPDX License List 裡的授權範本。嚴格模式的 web build 和 EAS build 會把缺少的範本下載到被 gitignore 的 `.generated/` 快取；`pnpm licenses:sync` 可以明確地預先把這個快取準備好。本機的 web 和 Metro 開發不會發出網路請求，在快取存在之前會略過需要產生的資料列。這樣一來，開發時的啟動不必依賴它，同時也能避免正式發行的產出物不完整。

:::plain 開發時和發行時的差別
發行用的 build 很嚴格：少了授權資訊就直接失敗，缺範本就上網抓。本機開發則相反：不上網，手邊沒有範本的那幾列就先不顯示。所以開發時在授權頁面看到的清單比較短是正常的；想看完整的，可以先跑 `pnpm licenses:sync`。
:::

## 自訂聲明與 package 覆寫 {#custom-notices-and-package-overrides}

Repository 層級的 `third-party-licenses.config.json` 存放所有 client 共用、以人工維護的例外項目。改作過的圖示、字型、媒體、原生模組，或是其他不是來自 npm package 的素材，請在 `customNotices` 加一筆：

```json
{
  "name": "asset-name",
  "license": "CC-BY-4.0",
  "generatedNotices": [
    {
      "licenseId": "CC-BY-4.0",
      "preamble": ["Asset by Example Author. Changes: converted to MP3."]
    }
  ],
  "sourceUrl": "https://example.com/source",
  "bundles": ["assets", "web"]
}
```

每一個 `generatedNotices` 項目都會指定一個 SPDX 授權範本，並且可以加上 `copyrights` 或簡短的 `preamble`，用來標示姓名和來源。如果軟體裡內含（vendor）了另外授權的程式碼，多個項目會被合併成一列。只有在內含的原始碼目錄本來就帶著一份應該留在它旁邊的授權檔時，才保留 `noticeFile` 或 `noticeFiles`。路徑是相對於設定檔的。`bundles` 控制哪些產生出來的 manifest 會包含這一筆，同時也提供顯示給使用者看的標籤。當這兩者不一樣時，請使用 `includeInBundles`，例如某個選用的 server 工具應該出現在兩個 client 的 manifest 裡，但並沒有被 bundle 進任何一個 client。

只有在已安裝的 npm 封存檔漏掉它的聲明、或是 metadata 不正確時，才使用 `packageOverrides`：

```json
{
  "name": "package-name",
  "version": "1.2.3",
  "generatedNotice": {
    "licenseId": "MIT",
    "copyrights": ["Copyright (c) 2026 Example Author"]
  },
  "license": "MIT",
  "sourceUrl": "https://example.com/package-name"
}
```

如果 package 裡含有另外授權的程式碼，請改用 `generatedNotices` 並給它一個範本陣列，而不是 `generatedNotice`。產生器會把每一則聲明都放進該 package 的那一列。

`version`、`license` 和 `sourceUrl` 是選填的。省略 `version` 時，這個覆寫會套用到該 package 所有已安裝的版本。當同一個 monorepo 的好幾個 package 共用同一則聲明時，覆寫可以用 `repositoryUrl` 取代 `name`：

```json
{
  "repositoryUrl": "https://github.com/example/project",
  "generatedNotice": {
    "licenseId": "Apache-2.0"
  }
}
```

當兩個 package 宣告了相同的（正規化後的）repository 和授權時，產生器也會重複使用已安裝的同門（sibling）package 的聲明。指定名稱和版本的覆寫，一律優先於這些以 repository 為依據的 fallback。

`@react-grab/cli` 的覆寫使用的是 React Grab 根 repository 的 MIT 授權，因為這個 CLI 的 npm 封存檔既沒有 license 欄位，也沒有授權檔。在發佈出來的 CLI package 自己帶有這些 metadata 之前，請保留這個覆寫。

手機版產生的檔案放在 `apps/mobile/.generated/` 底下，抓下來的 SPDX 範本則放在 repository 的 `.generated/` 目錄底下。兩者都被 ignore。不要 commit 或編輯它們；只要更新相依套件或設定，下一次嚴格模式的 build 就會重新產生輸出。

:::plain 該用哪一個設定
- 東西不是從 npm 裝來的（圖示、字型、音效、原生模組）：加到 `customNotices`。
- 東西是 npm package，但它自己的授權資訊缺漏或寫錯：加到 `packageOverrides`。
:::
