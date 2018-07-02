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
`cesium-concierge` requires a few configuration settings before working. These are loaded, in the following order of priority, from:

* The repository's `.concierge/config.json` file.
* Environment variables.
* Built-in defaults.

The table below describes all the possible configuration variables, as well as their default values if any. 

| Name | Type | Description | Required? | Default
| --- | --- | --- | --- | --- |
| `secret` | `string` | Repository secret to verify __incoming__ WebHook requests from GitHub | ✓ | 
| `repositories:{full_name}` | `object` | Settings specific to the repository `{full_name}`. | ✓ | 
| `repositories:{full_name}:gitHubToken` | `string` | Token used to verify __outgoing__ requests to GitHub repository | ✓ | 
| `repositories:{full_name}:thirdPartyFolders` | `string` | Comma-separated list of folders in which to look for changed files in pull request to remind user to update License. | X | `[]`
| `repositories:{full_name}:claUrl` | `string` | The GitHub API URL to the CLA file in JSON form. See [here](https://developer.github.com/v3/repos/contents/#get-contents) for what the URL should look like. _Example:_ https://api.github.com/repos/AnalyticalGraphicsInc/cesium-concierge/contents/specs/data/config/CLA.json | X | _Disabled if not set._
| `repositories:{full_name}:contributorsUrl` | `string` |  The GitHub API URL to `CONTRIBUTORS.md`. | X | _Disabled if not set._
| `repositories:{full_name}:maxDaysSinceUpdate` | `number` | "Bump" pull requests older than this number of days ago. | X | `30`
| `repositories:{full_name}:unitTestPath` | `string` |  Relative path to the directory containing unit tests. _Example:`Specs/`_ | X | _Disabled if not set._
| `port` | `number` | Port on which to listen to incoming requests | X | `5000`
| `listenPath` | `string` | Path on which to listen for incoming requests | X | `"/"`

> Note: `full_name` is the repository name in the form `{organization}/{repository}`. For example: `AnalyticalGraphicsInc/cesium`

`secret` and `repositories:{full_name}:gitHubToken` are the important settings; they verify that the communication between your server and
GitHub is safe.

### Setting `secret`
Enable a [GitHub WebHook](https://developer.github.com/webhooks/creating/) on a repository, making sure to create a secret.
The secret verifies that all incoming requests to your server are from GitHub and not something else.

### Setting `gitHubToken`
Next, get a [Personal Access Token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/), which verifies with GitHub that all requests to its API come from an account
with privileges. Set it locally by using any of the three ways listed above.

### CLA Format
The `repositories:{full_name}:claUrl` should point to a GitHub URL of a JSON file with the following format:
```json
[
  {
    "gitHub": "user1"
  },
  {
    "gitHub": "user2"
  }
]
```
The `gitHub` value is the only required field, but this format provides for storing more information alongside the GitHub name.

---

<p align="center">
  <a href="http://cesiumjs.org/"><img width="250px" src="https://cesiumjs.org/images/logos/cesium-black.png" /></a>
</p>
