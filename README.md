# cesium-concierge

__Hello! I'm Cesium Conierge, a GitHub bot for [Cesium](https://github.com/AnalyticalGraphicsInc/cesium). I automate
common certain GitHub tasks, and can currently:__
- Post a reminder comment to closed issues that have Google Group links in them
- Post a suggestion to update `CHANGES.md` on newly-opened pull requests, and/or to update licenses if files in Third-party folders have changed.
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
- As keys in `./config.json`

> Note: These settings take effect hierarchically, with environment variables > arguments > `config.json`

The possible settings are:

| Name | Type | Description | Required? |
| --- | --- | --- | --- |
| `secret` | `string` | Repository secret to verify __incoming__ WebHook requests from GitHub | ✓
| `repositories:{full_name}` | `object` | Settings specific to the repository `{full_name}`. | ✓
| `repositories:{full_name}:gitHubToken` | `string` | Token used to verify __outgoing__ requests to GitHub repository | ✓
| `repositories:{full_name}:remindForum` | `boolean` | Enables the functionality to post a reminder message to a closed issue if it contains links to a Google Group forum. | X
| `repositories:{full_name}:thirdPartyFolders` | `string` | Comma-seperated list of folders in which to look for changed files in pull request to remind user to update License. | X
| `repositories:{full_name}:checkChangesMd` | `boolean` | If `true`, check if `CHANGES.md` has been updated in pull request. If not, post comment suggesting that it should be edited. | X
| `repositories:{full_name}:maxDaysSinceUpdate` | `number` | "Bump" pull requests older than this number of days ago | X
| `port` | `number: default 5000` | Port on which to listen to incoming requests | X
| `listenPath` | `string: default"/"` | Path on which to listen for incoming requests | X

> Note: `full_name` is the repository name in the form `{organization}/{repository}`. For example: `AnalyticalGraphicsInc/cesium`

`secret` and `repositories:{full_name}:gitHubToken` are the important settings; they verify that the communication between your server and
GitHub is safe.

### Setting `secret`
Enable a [GitHub WebHook](https://developer.github.com/webhooks/creating/) on a repository, making sure to create a secret.
The secret verifies that all incoming requests to your server are from GitHub and not something else.

### Setting `gitHubToken`
Next, get a [Personal Access Token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/), which verifies with GitHub that all requests to its API come from an account
with privileges. Set it locally by using any of the three ways listed above.

---

<p align="center">
  <a href="http://cesiumjs.org/"><img width="250px" src="https://cesiumjs.org/images/logos/cesium-black.png" /></a>
</p>
