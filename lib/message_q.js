// Message Queue - ensures that the bot doesn't try to send too many
// messages at once (and get kicked for spam).

module.exports = function MessageQueue(bot, log){
  this.bot = bot;  
  var messageQueue =[];
  var timer = null;
  
  MessageQueue.prototype.queueMessage = function(message) {
    messageQueue.push(message);    
    if (timer===null) {
      timer = setInterval(function(){        
        var message = messageQueue.shift();                
        if(message) {
          log.debug("MQ sending: "+message);
          bot.chat(message);
        }
      }      
      , 6000, messageQueue);
    }
  }
  
  
  MessageQueue.prototype.kill = function() {
    log.debug("MQ stopping delivery timer.");
    if (timer) {
      clearInterval(timer);
    }
  }
}



