# CivSentinel
AFK Bot with snitch logging, auto-logout and out-of-game alerts, based on mineflayer (https://github.com/andrewrk/mineflayer).

Now includes a Vagrant VM - to be closer to the deployment environment and for ease of getting started (MongoDB installation, node, etc). This lets you develop on windows and run on Linux.

All you should have to do is run the following (be patient, some of these may take a while):

Vagrant up
Vagrant ssh
cd /vagrant/
sudo chown -R $USER /vagrant/
npm install

You should now be ready to run the code or develop. Anything you edit in this project directory is mapped to the VM's Vagrant directory.

To configure the Sentinel Bot, you need a file called config.json that stores all your passwords and so on. Obviously, that's why it's not in this repo. Here's an example:

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
      "slack_channel": "snitch-alerts",
      "slack_icon": "url to image of your slack avatar for the bot"
    }

Those parameters should be mostly fairly self-explanitory, snitchlog is the location for all the logs, the alerts_ params relate to the email account for alerts and logoff_snitch is the name of the snitch to trigger the bot to log out if anyone gets too close. Make sure to use a non-obvious name for that last one or people could force your bot to logout by pm-ing it the name!

I've recently added a slack-chat bot to this, which sends to the slack channel (I don't recomend spamming everyone in general if it's a team slack) with the bot name specfied above. Make sure to add your api key (token) where it says 'slack_api_key'. You get this by going to:

    https://yournameofyourslack.slack.com/services/new/bot.

N.B. the bot seems to automatically join any channel it's invited to. If you @mention the bot by name and then click 'invite'. 

FYI: I aim to run this bot on this...

https://www.raspberrypi.org/products/raspberry-pi-2-model-b/
