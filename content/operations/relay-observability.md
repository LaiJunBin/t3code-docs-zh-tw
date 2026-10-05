---
title: Relay 的可觀測性
nav: Relay 可觀測性
source: docs/operations/relay-observability.md
source_hash: c7f84d4ef8257b21ecc46f9ff3f2fb67652664ea
---

> 這一頁是寫給維護者的。如果你是 T3 Code 的使用者，請看 [docs/user](../user/)。

Relay 的 Alchemy stack 擁有一套共用的 Axiom trace 設定：

- `t3-code-relay-traces-prod`：OpenTelemetry trace dataset，由 Worker、手機 app 和第一方的 relay client 共用
- `t3-code-relay-otel-ingest-prod`：Worker 用的 ingest token，權限範圍限定在這個 dataset
- `t3-code-mobile-otel-ingest-prod`：手機 app 用的 ingest token，權限範圍限定在這個 dataset
- `t3-code-relay-client-otel-ingest-prod`：第一方 relay client 用的 ingest token，權限範圍限定在這個 dataset
- `t3-code-relay-recent-spans-prod`：一個 view，顯示最近的 request span 和 endpoint span

Alchemy 的各個 stage 會在資源名稱後面加上經過清理的 stage 名稱，藉此隔離資源，例如個人 stage 會是 `t3-code-relay-traces-dev-julius`。

在 `infra/relay` 底下用一般的 Alchemy 流程部署：

```sh
vp run deploy
```

Alchemy 透過它的 provider 解析帳號層級的 Axiom 部署憑證。在 runtime，Worker 只會收到它自己那個限定範圍的 ingest token。手機 app 和 relay client 使用各自另外佈建的限定範圍 ingest token。

Worker 會送出 Effect 內建的 HTTP server span，再加上 endpoint 和資料庫的 child span。Effect 的 OpenTelemetry exporter 把語意化的 HTTP 屬性存在 `attributes.` 前綴底下。例如：

```apl
['t3-code-relay-traces-prod']
| where name startswith 'http.server'
| extend endpoint = column_ifexists('attributes.http.route', ''),
    customAttributes = column_ifexists('attributes.custom', dynamic({}))
| project _time, name, trace_id, duration,
    ['attributes.http.request.method'],
    ['attributes.url.path'],
    ['attributes.http.response.status_code'],
    endpoint,
    relayOperation = customAttributes['relay']['operation']
| order by _time desc
| limit 200
```

佈建好的 view 同樣從 `attributes.http.route` 讀取 endpoint。Relay 專屬的 span annotation 存在 `attributes.custom` 底下；`relay.operation` 是其中一個會送出的自訂屬性。

調查已經結束的事故時，agent 應該優先使用佈建好的 view 或 APL 查詢，而不是去 tail Cloudflare Worker。這個 stack 沒有另外佈建查詢用的 token。需要用腳本查詢的事故處理人員，請使用已獲授權的帳號層級 `AXIOM_TOKEN`，搭配 `AXIOM_ORG_ID`；限定範圍的 ingest token 仍然只是給各個資料產生者用的唯寫憑證。

:::plain 哪個 token 能做什麼
Ingest token 只能把資料寫進 dataset，不能拿來查詢，而且 Worker、手機 app、relay client 各拿各的。這個 stack 沒有專門給查詢用的 token，所以要用腳本查資料時，用的是帳號層級的 `AXIOM_TOKEN`。
:::

DPoP proof 驗證失敗時，span 上會帶有穩定的 `relay.dpop.failure_code` 屬性。`time_window` 失敗代表某個已簽署的 proof 太舊，或是時間超前太多，落在 relay 允許的時間範圍之外。這可能表示其中一台裝置的日期或時間有問題，但也可能只是 request 被延遲了。Client 會根據這個分類，以及舊版 relay 沒有回傳分類這件事，來判斷時鐘偏差是已經確認的原因，還是只是其中一種可能的原因。
