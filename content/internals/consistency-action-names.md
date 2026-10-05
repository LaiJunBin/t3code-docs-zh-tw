---
title: 動作名稱在各種呈現方式之間保持一致
nav: 動作名稱一致性
source: docs/internals/consistency-action-names.md
source_hash: 7277c1bbf74f743a9d0b26d26a42852dd72fa70f
---

提議的不變條件（invariant）：一個 command 的可見標籤、tooltip、選單用字和無障礙名稱（accessible name），描述的是「對同一個對象做的同一個動作」。只有圖示的呈現方式也必須保有這個意思。這適用於 web / Electron 共用的控制項，以及對應的 React Native iOS / Android 動作，只要是這些動作可用的地方都算。

分開維護的字串可能各自漂移，而每一種呈現方式單獨看起來仍然合理。一個複製訊息的動作如果叫做「Copy link」，對使用螢幕閱讀器的人來說，承諾的就是另一種剪貼簿內容。用字要能指出實際的對象，訊息裡包含連結或結構化 context 時也一樣。多提供幾種剪貼簿格式，並不會讓「複製訊息」變成「複製連結」。

:::plain 這條規則在防什麼
同一顆按鈕的名稱通常寫在好幾個地方：畫面上的字、滑鼠停留的提示、選單、給螢幕閱讀器念的名稱。它們是各自獨立的字串，改了一處很容易漏掉另一處。結果是看畫面的人以為在複製訊息，聽螢幕閱讀器的人卻聽到「複製連結」。這條規則要求這幾個地方講的是同一件事。
:::

這個提議參考了 Apple 的 [Writing](https://developer.apple.com/design/human-interface-guidelines/writing) 與 [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 指引。它是一項產品上的限制，並不是宣稱取得了 Apple 的認證，也不是宣稱整個應用程式都完全符合規範。

## 界線 {#boundaries}

原生選單和輔助技術可能使用不同的用字，或是省略 tooltip。標籤需要的是語意上一致，而不是各平台的字串完全相同。當對象很明確時，依情境顯示的「Copy」就夠了；不要全面把它擴寫。暫時的「Copied」回饋可以取代動作標籤，而不暗示對象有所不同。剪貼簿的傳輸方式、成功的時機和錯誤回報，是另外的議題。

## 可觀察的案例 {#observable-cases}

- 使用者訊息和助理訊息的複製控制項，在 tooltip 和無障礙名稱裡都要指明是「訊息」。把長訊息收合起來，不會改變這個動作的意思。
- 複製一則帶有結構化 context 的訊息時，仍然要指明是訊息；它不會承諾只複製一個 context 連結。
- 程式碼和計畫（plan）的複製動作保有它們各自的對象。依情境顯示的計畫選單可以寫「Copy to clipboard」；程式碼的控制項則不可以被念成是在複製訊息。
- 對等的 command 不論以圖示、有標籤的按鈕或原生選單呈現，傳達的都是同一個操作。完成後的回饋絕對不會說出另一個對象的名稱。

驗證時，要把可見的用字、執行期的無障礙名稱，以及實際產生的動作放在一起檢查。只看原始碼和截圖，並不能確立 accessibility tree 的行為。
