// Message Queue - ensures that the bot doesn't try to send too many
// messages at once (and get kicked for spam).

var messageQueue =[];
var timer = null;
var delay = 6000; //ms
var sender = null;

var sender = function(){
  console.log(messageQueue);  
  var message = messageQueue.shift();
  sender.chat(message);  
};


exports.setbot(bot) {
  sender = bot;
}


exports.queueMessage = function(message) {
  messageQueue.push(message);
  
  if (timer===null) {
    timer = setInterval(sender, delay, messageQueue);
  }
}
