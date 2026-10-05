---
title: 模型 manifest
source: docs/internals/model-manifest.md
source_hash: 7d3eadae7f58901f593cf181b48ec38bafe28132
---

[隨附的 manifest](../../apps/server/src/provider/model-manifest.json) 讓 server 可以離線啟動；從 `main` 抓取它，則讓模型的 metadata 可以在兩次發版之間變動。抓取失敗或資料無效時，會保留最後一份可用的 manifest。遠端資料必須同時通過 catalog 參照的驗證，以及所屬 Provider 的 adapter 驗證，才能取代快取。

較新的隨附版本會依 `updatedAt` 勝過快取的遠端 manifest，所以一次發版可以在下一次成功抓取之前，先修正模型資料。只要這個檔案有變動，就要更新 `updatedAt`。抓取時間並不能判斷哪一份包含較新的修改。

:::plain 兩份 manifest 怎麼選
Server 手上可能有兩份模型資料：一份是跟著這個版本一起打包的，一份是先前從網路抓下來存在快取裡的。選哪一份是看檔案裡的 `updatedAt` 誰比較新，不是看「哪一份比較晚拿到」。所以改了 `model-manifest.json` 卻忘記更新 `updatedAt`，這次修改就可能輸給快取裡的舊資料。
:::

通用的 catalog 資料描述的是呈現方式和能力。每個 Provider 擁有自己的 adapter schema 和 dispatch 對應。Claude 的整個內建 catalog 都使用這份 manifest。新增一個使用既有能力 profile 的模型，只需要改 JSON；只有出現新的能力組合時，才需要新的 profile。Codex 的模型清單仍然是從它的 app server 取得。

`currentModels.claudeAgent` 是給早於 catalog discovery 的版本使用的「目前模型」分類覆蓋層（overlay）；它不會把模型加進那些版本的 catalog。支援 catalog 的版本改用 `providers.claudeAgent.models[].status`。Codex 則把 `currentModels.codex` 當成舊式分類的覆蓋層，套用在探索到的模型上。

模型資料是經過 schema 驗證的設定。測試應該用虛構的模型名稱來涵蓋 resolver、快取和 adapter 的語意，這樣新增模型時，就永遠不需要寫一份重複設定內容的測試。
