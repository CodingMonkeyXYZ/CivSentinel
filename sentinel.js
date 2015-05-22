// 'Sentinel' mineflayer bot for CivCraft.
// Detects and logs snitch entries.
// Warns of expiring snitches
// Sends a daily digest of snitch alerts to an email address.
// MonkeyWithAnAxe.

var mineflayer = require('mineflayer');
var argv = require('minimist')(process.argv.slice(2));
var bunyan = require('bunyan');
var CronJob = require('cron').CronJob;
var MessageQueue = require('./lib/message_q');


var safety_margin_hrs = 200.0;
var expiring_snitches =[];


//Mineflayer bot
var bot = mineflayer.createBot({
  host: argv.host,
  port: argv.port,
  username: argv.username,
  password: argv.password,
});

console.log("Bot will log if anyone hits snitch with regex:"+argv.logoff_snitch);


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
  mq.queueMessage("/pm "+username+" I am a bot.");
});


bot.on('snitch', function(username, message) {  
  if (username === bot.username) return;

  snitchlog.info(username + " " + message);
  
  //TODO: we could warn them in pm. Maybe send them links to the subreddit?  
  
  //n.b. if the argument --logoff_regexp is passed to this program
  //and a snitch with that exact name is triggered, the bot logs off.  
  if(message.search(argv.logoff_snitch)>-1) {
    console.log("ALERT!");
    log.info(username + " entered logoff snitch location.");        
    
    mq.queueMessage("/pm "+username+" A bounty will be placed on your head for this. Get out of here!");
    
    setTimeout(function(){
      log.info("Disconnecting");
      bot.quit();
      mq.kill();
      checkSnitches.stop();      
    }, 16000);
  } else {
    console.log("snitch "+username+" msg: "+message);
  }
});


bot.on('error', function(error) {
  log.error(error.stack);
});


//Fired when the bot is ready to do stuff.
bot.on('spawn', function() {
  log.info("bot has spawned.");
});


bot.on('kicked', function(reason) {
  log.error("We were kicked, because: " + reason);  
});


//We can also monitor our bot's properties like health.
bot.on('health', function() {
  log.info("Health change: "+bot.health);
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
