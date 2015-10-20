// 'Sentinel' mineflayer bot for CivCraft.
// Detects and logs snitch entries.
// TODO: Warn of expiring snitches
// Sends snitch alerts to slackchat channel.
// MonkeyWithAnAxe.

var math = require('mathjs');
var mineflayer = require('mineflayer');
var SlackBot = require('slackbots');
var bunyan = require('bunyan');
var CronJob = require('cron').CronJob;
var MessageQueue = require('./lib/message_q');
var argv = require('./config.json');
var safety_margin_hrs = 200.0;
var expiring_snitches =[];
var avatar_params = {
    icon_url: 'https://avatars.slack-edge.com/2015-10-20/12871644598_07ec975c60e7c6f38c0b_72.jpg'
  };
var snitch_coords = /(\-?\d{1,6})\s(\-?\d{1,6})\s(\-?\d{1,6})/;
var accuracy = 50; //blocks (50 means -/+ 50 blocks from real snitch).
var y_accuracy = 10;
  
//rolling file log for snitch alerts.
var snitchlog = bunyan.createLogger({
    name: 'snitches',
    streams: [{
        type: 'rotating-file',
        path: argv.snitchlog + '/snitches.log',
        period: '1d', // daily rotation at midnight.
        count: 30     // keep logs for a month
    }]
}); 

//normal log for everything else.
var log = bunyan.createLogger({
    name: 'log',
    streams: [{
        level: "debug",
        type: 'rotating-file',
        path: argv.snitchlog + '/system.log',
        period: '1d',   // daily rotation
        count: 3        // keep 3 back copies
    }]
});

log.info("Sentinel starting. Arguments:"+argv);
log.info("Bot will log if anyone hits snitch with regex:"+argv.logoff_snitch);

var slackchat = new SlackBot({
  token: argv.slack_api_key,
  name: argv.bot_name
});

slackchat.on('start', function() {
  log.info("connected to slack, sending welcome message"); 
});

//Mineflayer bot
var bot = mineflayer.createBot({
  host: argv.host,
  port: argv.port,
  username: argv.username,
  password: argv.password,
});

var mq = new MessageQueue(bot, log);

//Add out custom CivCraft chat regexes.
bot.chatAddPattern(/^([a-zA-Z0-9_]{1,16}):\s(.+)/, "chat", "CivCraft chat");
bot.chatAddPattern(/^From\s(.+):\s(.+)/, "whisper", "CivCraft pm");

//n.b. you can also add custom events to fire on certain chat patterns:
bot.chatAddPattern(/^\*\s([a-zA-Z0-9_]{1,16})\s(.+)]$/, "snitch",
 "CivCraft snitch alert");

//Regex for snitch list messages
bot.chatAddPattern(/^world\s+\[((?:\-?\d{1,7}\s?){3})\]\s+([\.\d]{1,6})/,
 "expires",
 "Civcraft /jalist command results.");
 
function relaychat(message) {
  slackchat.postMessageToChannel(argv.slack_channel, message, avatar_params);
}
 
function email_logs() {
  //TODO: email the files /var/log/civsentinel/snitches.log.0 (yesterdays log) and /var/log/civsentinel/snitches.log (current) to my inbox.
  log.debug("todo: emailer.");
};

 
function email_alert(alert) {
  console.error("alert follows:");
  console.error(alert);
};  
 
 
//run this job every day at 6am
var checkSnitches = new CronJob('0 0 6 * * *', function() {
  log.debug("running /jalist command.");
  console.log("running /jalist command.");
  mq.queueMessage("/jalist");
  expiring_snitches =[];
  
  setTimeout(function(snitches){
    email_alert(snitches);
  }, 10000, expiring_snitches);  
  
  email_logs();
}, null, true, argv.timezone);


bot.on('chat', function(username, message) {  
  if (username === bot.username) return;  
  log.debug("chat event:"+ username +" " + message);  
});


bot.on('whisper', function(username, message) {  
  if (username === bot.username) return;
  log.debug("whisper event:"+ username +" " + message);
  
  //TODO: respond to people who pm me but do so in a queue system
  //so people can't kick me by getting me to send multiple messages
  //at once, over the spam kick limit (which you *know* they will),
  //because: people, what a bunch of bastards.
  mq.queueMessage("/pm "+username+" I am a bot, beep boop.");
  relaychat(username+" said to snitchbot: '" +message+"'");
});


bot.on('snitch', function(username, message) {  
  if (username === bot.username) return;

  snitchlog.info(username + " " + message);
  
  var coords = snitch_coords.exec(message);  
  
  if(coords==null) {
    log.error("couldn't extract coords from snitch message. ");
    return;
  }  
  
  var redacted = message.substr(0, coords.index);
  //sanity check
  log.info("redacted: "+redacted);
  log.info("coords: "+coords);    
  var x = parseInt(coords[1], 10);
  var y = parseInt(coords[2], 10);
  var z = parseInt(coords[3], 10);
  
  x = math.randomInt(x - accuracy, x + accuracy);
  y = math.randomInt(y - y_accuracy, y + y_accuracy);
  z = math.randomInt(z - accuracy, z + accuracy);  
  
  //TODO: we could warn them in pm. Maybe if they're in our area,
  //send them links to the subreddit?
  
  //n.b. if the argument --logoff_regexp is passed to this program
  //and a snitch with that exact name is triggered, the bot logs off.  
  if(message.search(argv.logoff_snitch)>-1) {
    console.log("ALERT!");
    log.info(username + " entered logoff snitch location.");        
    relaychat("Oh crap! "+username + " just found my hiding spot. Please tell them to get lost!");
    
    mq.queueMessage("/pm "+username+" A bounty will be placed on your head for this. Get out of here!");
    
    setTimeout(function(){
      log.info("Disconnecting");
      bot.quit();
      mq.kill();
      checkSnitches.stop();      
    }, 16000);
  } else {
    console.log("snitch "+username+" msg: "+message);
    relaychat(username+ " "+ redacted + " "+x+","+z); 
  }
});


bot.on('error', function(error) {
  log.error(error.stack);
});


//Fired when the bot is ready to do stuff.
bot.on('spawn', function() {
  log.info("bot has spawned.");
   relaychat("Snitch sentinel has entered the game. It'll probably break, just watch.");
});


bot.on('kicked', function(reason) {
  log.error("Snitch sentinel kicked, because: " + reason);
  relaychat("Snitch sentinel kicked, because: " + reason);
});


//We can also monitor our bot's properties like health.
bot.on('health', function() {
  log.info("Health change: "+bot.health);
  relaychat("Snitch sentinel health change: " + bot.health);
});


bot.on('expires' , function(snitch_loc, snitch_info) {  
  log.debug("Snitch at "+snitch_loc+" expires:"+snitch_info);    
  var expires_in_hrs = parseFloat(snitch_info);
  if(expires_in_hrs<safety_margin_hrs) {
    log.debug("adding snitch to expiry list.");
    expiring_snitches.push("snitch at "+snitch_loc+" expires in "+
      expires_in_hrs+" hrs");
  }  
});

//Emitted for every server message, including chats.
bot.on('message', function(json) {
  //json is a json message but it's toString method creates a nice
  //printable result:
  log.debug("message:" + json);
  
  //console.log(json);
  
  //N.B. This catches things like commands and server messages.
  //We could possibly inspect the json to work out which is which.
});
