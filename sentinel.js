// 'Sentinel' mineflayer bot for CivCraft.
// Detects and logs snitch entries.
// TODO: Warn of expiring snitches
// Sends snitch alerts to slackchat channel.
// MonkeyWithAnAxe.

var math = require('mathjs');
var queue = require('queue');
var mineflayer = require('mineflayer');
var SlackBot = require('slackbots');
var bunyan = require('bunyan');
var CronJob = require('cron').CronJob;
var argv = require('./config.json');

var safety_margin_hrs = 200.0;
var expiring_snitches =[];
var avatar_params = { icon_url: argv.slack_icon };
var snitch_coords = /(\-?\d{1,6})\s(\-?\d{1,6})\s(\-?\d{1,6})/;
var accuracy = 50; //blocks (50 means -/+ 50 blocks from real snitch).
var y_accuracy = 10;
var yaw_counter = 0;
var spin_timer;  
var mc_chat_q;
var place_bounty = /^(\d+d)\sbounty\s([a-zA-Z0-9_]{1,16})$/;
var where_is = /^where\s?is\s([a-zA-Z0-9_]{1,16})$/;
var drop_bounty = /^drop\s?bounty\s([a-zA-Z0-9_]{1,16})$/;
var claim_bounty = /^claim\s?capture\s([a-zA-Z0-9_]{1,16})$/;
var info = /^info\s([a-zA-Z0-9_]{1,16})$/;
var proof = /^proof\s([a-zA-Z0-9_]{1,16})$/;
var list = /^list\s?(all)?$/;
var help = /^help$/;
var bot =null;
var slackchat = null;
var db = null;
var checkSnitches_job = null;

var log = bunyan.createLogger({
    name: 'log',
    streams: [{
        level: "debug",
        type: 'rotating-file',
        path: argv.snitchlog + '/system.log',
        period: '1d',   // daily rotation
        count: 3        // keep 3 backup copies
    }]
});

var checksnitches_fn = function() {  
  log.debug("running /jalist command.");  
  mc_chat("/jalist");
  expiring_snitches =[];
  
  setTimeout(function(snitches){
    //TODO
  }, 10000, expiring_snitches);      
}



/////////////////////
init();
event_handlers();
////////////////////

function init() {
  //database
  db = ///

  //slackchat
  slackchat = new SlackBot({
    token: argv.slack_api_key,
    name: argv.bot_name
  });

  //Mineflayer bot
  bot = mineflayer.createBot({
    host: argv.host,
    port: argv.port,
    username: argv.username,
    password: argv.password,
  });
  
  init_mc_chat_queue();
  
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
  
  
  //run this job every day at 6am
  checkSnitches_job = new CronJob('0 0 6 * * *', checksnitches_fn , null, true, argv.timezone);
}

function event_handlers() {
  bot.on('chat', function(username, message) {  
    if (username === bot.username) return;  
    log.debug("chat event:"+ username +" " + message);  
  });

  bot.on('whisper', function(username, message) {  
    if (username === bot.username) return;
    log.debug(username +" : " + message);
    
    console.log(message);
    
    if(message.match(place_bounty)) {
        process_place_bounty(username, message);
    } else if(message.match(drop_bounty)) {
        process_drop_bounty(username, message);
    } else if(message.match(claim_bounty)) {
        process_claim_bounty(username, message);
    } else if (message.match(help)) {
        command_help(username);
    } else {
        no_command_match(username);
    }
    
    //relaychat(username+"  said to snitchbot: '" +message+"'");
  });

  
  bot.on('snitch', function(username, message) {  
    if (username === bot.username) return;

    log.info(username + " " + message);
    
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
      handle_logout_snitch();
    } else {      
      //relaychat(username+ " "+ redacted + " "+x+","+z); 
      //TODO: filter these sensibly so we only hear about criminals with bounties crossing snitches.
    }
  });

  bot.on('error', function(error) {
    log.error(error.stack);
  });

  //Fired when the bot is ready to do stuff.
  bot.on('spawn', function() {
    log.info("bot has spawned.");
     //relaychat("Snitch sentinel has entered the game. It'll probably break, just watch.");
     
     startSpinning();
  });

  bot.on('kicked', function(reason) {
    log.error("Snitch sentinel kicked, because: " + reason);
    relaychat("Snitch sentinel kicked, because: " + reason);
    back_off_and_retry();
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
}



function process_place_bounty(username, message) {
  //TODO
  var bounty = place_bounty.exec(message);
  console.log("amount:"+bounty[1]);
  console.log("who on:"+bounty[2]);
  
  mc_chat("/pm "+username+" Feature not implemented.");
  relaychat(username+" "+message);  
}

function process_drop_bounty(username, message) {
  //TODO
  mc_chat("/pm "+username+" Feature not implemented.");
  relaychat(username+" "+message);  
}

function process_claim_bounty(username, message) {
  //TODO
  mc_chat("/pm "+username+" Feature not implemented.");
  relaychat(username+" "+ message);  
}

function command_help(username) {
  console.log("help.");
  mc_chat("/pm "+username+" Bounty bot - beta. Not for public use yet. SOON (tm).");
}

function no_command_match(username) {
  console.log("unrecognised command.");
  mc_chat("/pm "+username+" Bounty bot - 'help' for command list.");
}






//Bot helper fns

function startSpinning() {
  console.log('Anti-AFK countermeasures started.');
  spin_timer = setInterval( function() {    
    yaw_counter+=20;
    if(yaw_counter>360) yaw_counter = 360 - yaw_counter;
    if (bot == null) {
      clearInterval(spin_timer);
    } else {
      bot.look(yaw_counter,0);
    }
  }, 5000);
}

function back_off_and_retry() {
  
}

function handle_logout_snitch() {
  log.info(username + " TRIGGERED LOGOUT!");        
  relaychat(username + " just entered my skybunker. They probably broke in. Please pearl them.");
  mc_chat.chat(
    "/pm "+username+
    " Criminal activity detected. A bounty will be placed on you.");  
  panic_after(16000);
}

function panic_after(delay) {
  setTimeout(function(){
    log.info("Bot panic. Disconnecting in "+delay);    
    cleanup();
  }, delay);
}

function cleanup() {
  mc_chat_q.end();  
  if (spin_timer != null) {
    clearInterval(spin_timer);
  }
  relaychat("Disconnected from server.");
  bot.quit();
  checkSnitches_job.stop();
  
  //indicate to watchdog that the process *should* die now.
  fs.closeSync(fs.openSync('.panic', 'w'));
}


//Slackchat stuff

slackchat.on('start', function() {
  log.info("connected to slack");
});

function relaychat(message) {
  
  //TODO: Clients should not send more than one message per second sustained.
  
  slackchat.postMessageToChannel(argv.slack_channel, message, avatar_params);
}



//MC chat queue stuff


function init_mc_chat_queue() {
  mc_chat_q = queue();
  mc_chat_q.concurrency = 1;
  mc_chat_q.timeout = 10000;//ms
  
}

//replace mq
function mc_chat(message) {
  mc_chat_q.push(function(cb){
    var chat_delay = setTimeout( function() {
      log.debug("mc send: " + message);
      bot.chat(message);
      cb();
    }, 6000, cb, message, bot);
  });
  
  //restart it if queue processor has stopped.
  if(mc_chat.length=1) {
    mc_chat_q.start(function(err){
      if(err) console.log(err);
    });
  }
}
