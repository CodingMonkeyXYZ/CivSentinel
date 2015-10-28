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
var DaoObj = require('./lib/dao');
var dao = null;
var MINECRAFT_CHAT_DELAY = 6000; //ms
var SLACK_CHAT_DELAY = 1000; //ms
var MESSAGE_Q_TIMEOUT = 60000; //ms

var safety_margin_hrs = 200.0;
var expiring_snitches =[];
var avatar_params = { icon_url: argv.slack_icon };
var snitch_coords = /(\-?\d{1,6})\s(\-?\d{1,6})\s(\-?\d{1,6})/;
var accuracy = 50; //blocks (50 means -/+ 50 blocks from real snitch).
var y_accuracy = 10;
var yaw_counter = 0;
var spin_timer;  
var mc_chat_q;
var slack_chat_q;
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
var checkSnitches_job = null;
var reconnect_timer = null;
var reconnect_interval = 60000; //ms


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
////////////////////

function init() {
  //database
  dao = new DaoObj(log);
  dao.init();

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
    viewDistance: 'tiny'
  });
  
  event_handlers();
  
  init_chat_queues();
  
  //Add custom CivCraft chat regexes.
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
  
  //TODO: whilst highly unlikely you could do any kind of
  //injection attack, because the regexes only allow certain input,
  //we really should check and maybe sanitise again.  
  
  bot.on('login', function() {
    if(reconnect_timer) {
      reconnect_timer.clearInterval();
      reconnect_timer=null;
    }
  });
  
  
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

    //log.debug(username + " " + message);
    console.log("DEBUG " + username + " " + message);
    
    var coords = snitch_coords.exec(message);  
    
    if(coords==null) {
      log.error("couldn't extract coords from snitch message. ");
      return;
    }  
    
    var redacted = message.substr(0, coords.index);
    var x = parseInt(coords[1], 10);
    var y = parseInt(coords[2], 10);
    var z = parseInt(coords[3], 10);
    
    x = math.randomInt(x - accuracy, x + accuracy);
    y = math.randomInt(y - y_accuracy, y + y_accuracy);
    z = math.randomInt(z - accuracy, z + accuracy);  
    
    //TODO: we could warn them in pm. Maybe if they're in our area,
    //send them links to the subreddit?
    //TODO: search database for snitch-specific message triggers
    //send if not already sent within say 24hrs?
  
    //if user is a wanted criminal, alert the slack chat.
    dao.search_active_bounties_for(username, function(){
      //found 'em
      //TODO: introduce a random delay for slackchat, to help obsfucate snitch location.
      relaychat(username+ " (wanted) "+ redacted + " "+x+","+z);          
      log.info(username+ " (wanted) "+ redacted + " "+x+","+z);      
    });    
    
    //Handle someone entering the bot's snitch.
    if(message.search(argv.logoff_snitch)>-1) {    
      handle_logout_snitch();
    }
  });

  
  bot.on('error', function(error) {
    console.log(error);
    log.error(error.stack);
  });
  
  
  //Fired when the bot is ready to do stuff.
  bot.on('spawn', function() {
    log.info("bot has spawned.");
     relaychat("Snitch sentinel has entered the game.");     
     startSpinning();
  });

  
  //End is fired when you're no longer connected to the server.
  bot.on('end', function() {
    log.error("Snitch sentinel got 'end' event.");
    relaychat("Snitch sentinel disconnected. Will retry in "+(reconnect_interval / 1000) + "s.");
    back_off_and_retry();
  });
  
  
  //TODO playerJoined, playerLeft
  
  //explicitly kicked off the server for some reason.
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
    log.debug("message:" + json);   
    //console.log(json);
    
    //TODO This catches things like commands and server messages.
    //We could possibly inspect the json to work out which is which.
  });
}


function process_place_bounty(username, message) {  
  var bounty = place_bounty.exec(message);
  
  dao.place_bounty(username,bounty[2],bounty[1],
    function(bountier, bountied, reward){
      mc_chat("/pm "+bountier+" Bounty on "+bountied+" created.");
      relaychat(bountier+" placed a "+reward+" bounty on "+message);
    },
    function(err){
      mc_chat("/pm "+username+" Failed, error: "+err);
    });
}


function process_drop_bounty(username, message) {
  var bounty = drop_bounty.exec(message);
  var who_on = bounty[1];
  dao.drop_bounty(username, who_on,
    function(reply){
      mc_chat("/pm "+username+" "+reply);
      relaychat(reply + " by "+username);
    },
    function(err){
      mc_chat("/pm "+username+" "+err);
    });
}


function process_show_bounties(username, message) {

  //TODO
  
  //Get a list of players who'd be interested in owning this pokemon.  
  dao.show_bounties(username,
    function(reply){
      mc_chat("/pm "+username+" "+reply);
    });
}


function process_claim_bounty(username, message) {
  var bounty = claim_bounty.exec(message);
  var who_on = bounty[1];
  dao.claim_bounty(username, who_on,
    function(ok_msg){
      mc_chat("/pm "+username+" "+ok_msg+". Talk to the claimant(s) to arrange payment.");
      relaychat(username+" "+ok_msg); 
    },
    function(err){
      mc_chat("/pm "+username+" "+err);
    });
}


function command_help(username) {
  mc_chat("/pm "+username+" Bot's manual and TOS: https://goo.gl/Zfj2Ux");
}


function no_command_match(username) {  
  mc_chat("/pm "+username+" unrecognised command.");
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
  
  cleanup();
  
  reconnect_timer = setInterval( function() {
    log.info("attempting to reconnect to server.");
    init();
  }, reconnect_interval);
  
  reconnect_interval = reconnect_interval * 2;
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
    //indicate to watchdog that the process *should* die now.
    fs.closeSync(fs.openSync('.panic', 'w'));
  }, delay);
}

function cleanup() {
  try {
    if(bot) bot.quit();
  } catch (e) {
    //not to worry, probably just means we didn't connect in the first place.
    log.warn(e);
  }
  mc_chat_q.end();
  
  //TODO should we clear the queue?
  
  //There is not neat slackchat disconnect function in the node module I'm using.
  //TODO: test that recreating slack works as expected.
  
  if (spin_timer != null) {
    clearInterval(spin_timer);
  }  
  checkSnitches_job.stop();
}


//Slackchat stuff

slackchat.on('start', function() {
  log.info("connected to slack");
});

slackchat.on('close', function() {
  log.info("connection to slack closed!");
});

//MC chat queue stuff

function init_chat_queues() {
  mc_chat_q = queue();
  mc_chat_q.concurrency = 1;
  mc_chat_q.timeout = MESSAGE_Q_TIMEOUT;
  slack_chat_q = queue();
  slack_chat_q.concurrency = 1;
  slack_chat_q.timeout = MESSAGE_Q_TIMEOUT;
}

//send queued messages to slack chat (with 1s delay to avoid TOS breach).
function relaychat(message) {
  slack_chat_q.push(function(cb){
    var chat_delay = setTimeout( function() {
      log.debug("slack send: " + message);
      slackchat.postMessageToChannel(argv.slack_channel, message, avatar_params);
      cb();
    }, SLACK_CHAT_DELAY, cb, message, slackchat);
  });
  
  //restart it if queue processor has stopped.
  if(slack_chat_q.length=1) {
    slack_chat_q.start(function(err){
      if(err) console.log(err);
    });
  }
}


//send queued messages to a minecraft players (with anti-spam-kick delay).
function mc_chat(message) {
  mc_chat_q.push(function(cb){
    var chat_delay = setTimeout( function() {
      log.debug("mc send: " + message);
      bot.chat(message);
      cb();
    }, MINECRAFT_CHAT_DELAY, cb, message, bot);
  });
  
  //restart it if queue processor has stopped.
  if(mc_chat.length=1) {
    mc_chat_q.start(function(err){
      if(err) console.log(err);
    });
  }
}
