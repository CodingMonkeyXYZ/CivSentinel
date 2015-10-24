//test the slack connection

var SlackBot = require('slackbots');
var avatar_params = {
    icon_url: 'https://avatars.slack-edge.com/2015-10-20/12871644598_07ec975c60e7c6f38c0b_72.jpg'
  };
var argv = require('./config.json');

var users, channels

var slackchat = new SlackBot({
  token: argv.slack_api_key,
  name: argv.bot_name
});

var toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

slackchat.on('start', function() {
  console.log('start');
  // slackchat.postMessageToUser('codingmonkey', "Testing.", avatar_params, function(){
    // console.log('done');
  // });  
  //users = JSON.stringify(slackchat.getUsers());
     
  var members = slackchat.getUsers()._value.members;
  console.log(toType(members));
     
  for(user in members) {
    console.log(toType(user));
    users[user.id] = user.name;
    console.log(user.name);
  }
  
});

slackchat.on('message', function(data) {
  var raw = JSON.stringify(data);
  console.log(raw);
  var json = JSON.parse(raw);  
  
  if(json['type']=='message') {
    console.log(channels[json['channel']]);
    console.log(users[json['user']]);
    console.log(json['text']);
  }
});

slackchat.on('open', function() {
  console.log("got open event");
});

slackchat.on('close', function() {
  console.log("got close event");
});
