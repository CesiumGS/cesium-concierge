# cesium-concierge

GitHub bot for [Cesium](https://github.com/AnalyticalGraphicsInc/cesium).

## Building

Clone this repository:
```bash
$ git clone https://github.com/AnalyticalGraphicsInc/cesium-concierge
```
Install the dependencies:
```bash
$ cd cesium-concierge && npm install
```

And run:
```bash
$ npm start
```

## Setup
`cesium-concierge` requires a few settings before working. These can be set in three ways:
- As environment variables
- As arguments (`npm start -- --port 5000`)
- As keys in `./config.json`

> Note: These settings take effect hierarchically, with environment variables > arguments > `config.json`

The possible settings are:

| Name | Default | Description |
| --- | --- | --- |
| `port` | `5000` | Port on which to listen to incoming requests |
| `secret` | `""` | Repository secret to verify __incoming__ WebHook requests from GitHub |
| `gitHubToken` | `""` | Token used to verify __outgoing__ requests to GitHub repository |
| `repository` | `""` | Repository to scan for outdated pull requests and bump them |
| `listenPath` | `"/"` | Path on which to listen for incoming requests |

`secret` and `gitHubToken` are the important settings; they verify that the communication between your server and
GitHub is safe.

### Setting `secret`
Setup a [GitHub WebHook](https://developer.github.com/webhooks/creating/) on a repository, making sure to create a secret.
The secret verifies that all incoming requests to your server are from GitHub and not something else.

### Setting `gitHubToken`
Next, get a [Personal Access Token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/), which verifies with GitHub that all requests to its API come from an account
with privileges. Set it locally by using any of the three ways listed above.

---

<p align="center">
  <a href="http://cesiumjs.org/"><img width="250px" src="https://cesiumjs.org/images/logos/cesium-black.png" /></a>
</p>
