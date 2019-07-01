# Cesium Concierge

__Hello! I'm Cesium Concierge, a GitHub bot for [Cesium](https://github.com/AnalyticalGraphicsInc/cesium). I automate
common GitHub tasks such as welcoming first time contributors and reminding you to write tests. (I'm great fun at parties!)__

You'll find repository-specific settings in each repository I watch under a `.concierge` directory. For example, here's CesiumJS's concierge settings:

https://github.com/AnalyticalGraphicsInc/cesium/tree/master/.concierge 

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
| `repositories:{full_name}:contributorsPath` | `string` |  Relative path from the root of the repository to the `CONTRIBUTORS.md` file. | X | _Disabled if not set._
| `repositories:{full_name}:maxDaysSinceUpdate` | `number` | "Bump" pull requests older than this number of days ago. | X | `30`
| `repositories:{full_name}:unitTestPath` | `string` |  Relative path to the directory containing unit tests. _Example:`Specs/`_ | X | _Disabled if not set._
| `googleApiConfig` | `string` | Google API config for reading the list of CLA signers from Google Sheets. See [CLA checking](#cla-checking) for full instructions. | X | _Disabled if not set._
| `individualClaSheetID` | `string` | The ID of the Google Sheets storing the signed CLA information for individual contributors. See [CLA checking](#cla-checking) for full instructions. | X | _Disabled if not set._
| `corporateClaSheetID` | `string` | The ID of the Google Sheets storing the signed CLA information for corporate contributors. See [CLA checking](#cla-checking) for full instructions. | X | _Disabled if not set._
| `port` | `number` | Port on which to listen to incoming requests. | X | `5000`
| `listenPath` | `string` | Path on which to listen for incoming requests. | X | `"/"`
| `slackToken` | `string` | Slack API token for posting release reminders and fun stats to the Slack team. | X | _Disabled if not set._
| `slackConfigUrl` | `string` | The GitHub API URL to a YAML file containing the release schedule and other SlackBot config. | X | `""`

> Note: `full_name` is the repository name in the form `{organization}/{repository}`. For example: `AnalyticalGraphicsInc/cesium`

`secret` and `repositories:{full_name}:gitHubToken` are the important settings; they verify that the communication between your server and
GitHub is safe.

### Setting `secret`
Enable a [GitHub WebHook](https://developer.github.com/webhooks/creating/) on a repository, making sure to create a secret.
The secret verifies that all incoming requests to your server are from GitHub and not something else.

### Setting `gitHubToken`
Next, get a [Personal Access Token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/), which verifies with GitHub that all requests to its API come from an account
with privileges. Set it locally by using any of the three ways listed above.

### Setting `slackToken`
See "installing a bot" on Slack's [Enabling interactions with bots](https://api.slack.com/bot-users) guide.

### CLA Checking

Concierge can automate the CLA (contribute license agreement) process. Here's how it works:

* New contributor electronically signs agreement using a Google form.
* This form automatically outputs to a Google spreadsheet.
* Concierge checks this spreadsheet on every new pull request to see if that contributor's GitHub username is in the sheet.

Assuming you already have a Google form setup, all you need to do is configure:

* `individualClaSheetID` - this is the spreadsheet ID for form responses for the individual CLA agreement. Concierge expects **column D** to be the GitHub username.
  * You can find the spreadsheet ID from the URL, which is in the form of `https://docs.google.com/spreadsheets/d/<id>/edit`.
* `corporateClaSheetID` - same as above, but for the corporate CLA agreement. Concierge expects **column H** to be the Schedule A response, which is a list of names of employees along with their GitHub usernames. This is loosely formatted, so Concierge checks if the new PR author's username is a substring of that column.
* `googleApiConfig` - this is the JSON content of the credentials file from the Google service account, see [Google's authentication guide for getting this configuration](https://cloud.google.com/docs/authentication/getting-started).
  * When you set up a new Service account, you'll be able to download the key, which includes a project id, a private key, and some other metadata. The contents of this file can be supplied as the value of this environment variable.
  * Note that you must also allow this Service account to have view access to the two spreadsheets above. You can do this by inviting the Service account email to have access to the Google spreadsheet (you can find this email from the Google Cloud Platform console, which should look something like `account-name@project-name.iam.gserviceaccount.com`).

---

<p align="center">
  <a href="http://cesium.com/"><img width="250px" src="https://raw.githubusercontent.com/wiki/AnalyticalGraphicsInc/cesium/logos/Cesium_Logo_Color.jpg" /></a>
</p>
