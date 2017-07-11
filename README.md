# cesium-concierge

GitHub bot for [Cesium](https://github.com/AnalyticalGraphicsInc/cesium).

## Building

First, clone this repository:
```bash
$ git clone https://github.com/AnalyticalGraphicsInc/cesium-concierge
```
Install the dependencies:
```bash
$ cd cesium-concierge && npm install
```

To run:
```bash
$ npm start
```

## Setup
`cesium-concierge` requires a few settings before working. These can be set in three ways:
- As environment variables
- As arguments (`npm start -- --port 5000`)
- As keys in `./config.json`

The possible settings are:

| Name | Default | Description |
| --- | --- | --- |
| port | 5000 | Port on which to listen to incoming requests |
| secret | "" | Repository secret to verify incoming WebHook requests from GitHub |
| githubToken | "" | Token used to verify outgoing requests to GitHub repository |
| repository | "" | Repository to scan for outdated pull requests and bump them |
| listenPath | "/" | Path on which to listen for incoming requests |

Setup a [GitHub WebHook](https://developer.github.com/webhooks/creating/) on a repository, making sure to create a secret.
The secret verifies that all incoming requests to your server are from GitHub and not something else.

Next, get a [Personal Access Token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/), which verifies with GitHub that all requests to its API come from an account
with privileges. Set it locally by using any of the three ways listed above.

---

<p align="center">
  <a href="http://cesiumjs.org/"><img width="250px" src="https://cesiumjs.org/images/logos/cesium-black.png" /></a>
</p>
