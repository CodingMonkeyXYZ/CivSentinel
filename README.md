# CivSentinel
AFK Bot with snitch logging, auto-logout and out-of-game alerts.

To run this, you need a file called config.json that stores all your passwords and so on. Obviously, that's why it's not in this repo. Here's an example:

{
  "host": "mc.civcraft.vg",
  "port": "25565",
  "username": "********@****.com",
  "password": "********",
  "snitchlog": "../logs",
  "timezone": "Europe/London",  
  "logoff_snitch": "********",
  
  "slack_api_key": "**************",
  "bot_name": "my_bot",
  "slack_channel": "snitch-alerts"  
}

Those parameters should be mostly fairly self-explanitory, snitchlog is the location for all the logs, the alerts_ params relate to the email account for alerts and logoff_snitch is the name of the snitch to trigger the bot to log out if anyone gets too close. Make sure to use a non-obvious name for that last one or people could force your bot to logout by pm-ing it the name!

I've recently added a slack-chat bot to this, which sends to the slack channel (I don't recomend spamming everyone in general if it's a team slack) with the bot name specfied above. Make sure to add your api key (token) where it says 'slack_api_key'. You get this by going to https://yournameofyourslack.slack.com/services/new/bot.