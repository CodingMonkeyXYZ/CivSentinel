//test the slack connection

var SlackBot = require('slackbots');
var avatar_params = {
    icon_url: 'https://avatars.slack-edge.com/2015-10-20/12871644598_07ec975c60e7c6f38c0b_72.jpg'
  };
var argv = require('./config.json');

var slackchat = new SlackBot({
  token: argv.slack_api_key,
  name: argv.bot_name
});

slackchat.on('start', function() {
  slackchat.postMessageToChannel(argv.slack_channel, "Testing.", avatar_params);
});

slackchat.on('message', function(data) {
  console.log(JSON.stringify(data));  
});

slackchat.on('open', function() {
  console.log("got open event");
});

slackchat.on('close', function() {
  console.log("got close event");
});
