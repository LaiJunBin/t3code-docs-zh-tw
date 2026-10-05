---
title: 助理回覆的引用（Assistant citations）
nav: 助理回覆引用
source: docs/internals/assistant-citations.md
source_hash: ec830f75bc0313f1385f0851e3968da4544eaadb
---

引用（citation）把選取的摘錄內容和來源的身分，直接放在一般的訊息文字裡。草稿、剪貼簿複本、stash 和已送出的訊息都沿用這種表示方式，不需要另外一個存放引用的地方。就算來源消失或被改動，已儲存的引文仍然可以使用。[共用格式](../../packages/shared/src/assistantCitations.ts)使用穩定的 environment ID，不含瀏覽器的 origin，所以在本機、遠端和 tunnel 連線之間切換時，引用的身分不會改變。

:::plain 引用其實就是一個連結
一則引用在訊息文字裡是一個 Markdown 連結，連結文字固定是 `Assistant quote`，網址以 `t3-citation://v1/` 開頭。網址裡帶著 environment、Thread、訊息三個 ID，以及被引用的那段文字本身、它的起訖位置、前後文，還有使用者選填的評語。因為需要的東西全都寫在這個連結裡，訊息被複製到哪裡，引用就跟到哪裡。
:::

回到來源的導覽是盡力而為（best effort）。[文字選取器](../../apps/web/src/lib/assistantTextSelection.ts)指向的是「空白正規化之後、實際呈現出來的文字」，以 UTF-16 單位計算。它們不能套用在原始的 Markdown 上。原本的摘錄會保留它的空白；正規化只用來定位。重複出現的文字需要有一個不含糊的前後文比對，即使其中一處仍然剛好位在儲存的位移上也一樣。用猜的可能會標示到錯誤的那句話。

在虛擬列（virtual row）重新掛載的過程中，標示（highlight）的生命週期由導覽流程負責。來源那一列必須先被抓取、展開、掛載並量測完成，引文定位才會從一般的時間軸捲動手上接手。重新掛載不可以讓已經被關掉的標示又出現。[導覽用的 hash](../../apps/web/src/lib/assistantCitationNavigation.ts)使用 base64url，因為不這樣做的話，router 的正規化會把引用 URI 裡的空白和來源 ID 解碼掉。

送交給 Provider adapter 之前，要先用[共用的 formatter](../../packages/shared/src/assistantCitations.ts)把引用展開。送出的是已儲存的摘錄，不去查詢來源；要把「被引用的參考內容」和「使用者的評語」區分開來；已持久化的訊息則保持原本的形式。輸入長度限制在展開之前要檢查，展開之後也要檢查。一份草稿以編碼後的連結形式放得下，展開之後卻可能超過 Provider 的上限。

:::plain 為什麼要「展開」
使用者訊息裡存的是連結。送給 Provider 之前，formatter 會把每個連結換成一個像 `[assistant-quote-1]` 的短編號，並在訊息最後附上一段 `<assistant_citations>` 區塊，列出每個編號對應的引文內容，同時說明這些是被引用的參考資料、不是新的指示。這樣處理之後訊息的長度會改變，因此要再檢查一次。已儲存的訊息維持連結的形式，不會被改寫。
:::
