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
  "alerts_email": "********",
  "alerts_password": "********",
  "logoff_snitch": "********"
}

Those parameters should be mostly fairly self-explanitory, snitchlog is the location for all the logs, the alerts_ params relate to the email account for alerts and logoff_snitch is the name of the snitch to trigger the bot to log out if anyone gets too close. Make sure to use a non-obvious name for that last one or people could force your bot to logout by pm-ing it the name!
