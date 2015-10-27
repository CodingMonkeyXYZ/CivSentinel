var NeddbDataStore = require('nedb');
var db = {};

var Dao = function(log) {  
  this.log = log;
}


Dao.prototype.init = function() {  
  db.mc_players = new NeddbDataStore({filename:'players.db',autoload:true});
  db.bounties = new NeddbDataStore({filename:'bounties.db',autoload:true});
}


Dao.prototype.place_bounty = function( b_owner, b_criminal, b_reward,
                            ok_callback, err_cb ) {
  //Don't let people bounty themselves.
  if(b_owner == b_criminal) {
    err_cb("You can't bounty yourself.");
    return;
  }
  
  var doc = { owner:b_owner,
              bountied:b_criminal,
              reward:b_reward,
              raised:new Date(),
              evidence:'pending',
              status:'active'};
              
  db.bounties.insert(doc,function(err,newDoc){
    if(err) {
      console.log(err);
      log.error("Failed to create bounty on player. "+err+" "+doc+" "+newDoc);
      err_cb("Technical difficulties. Try again later.");
    } else {
      ok_callback(b_owner, b_criminal, b_reward);      
    }
  });
}


Dao.prototype.drop_bounty = function(b_dropper, b_dropee, ok_cb, err_cb) {
  db.bounties.update({
    owner:b_dropper,
    bountied:b_dropee,
  status:'active'},
  {$set:{status: 'dropped'}},
    {multi:false},
    function(err, replaced){
      if(err) {
        console.log(err);
        err_cb("Technical difficulties. What did you DO?");
      }
      if(replaced) {
        ok_cb("Bounty has been dropped on "+b_dropee);
      } else {
        err_cb("You don't have a bounty on "+b_dropee);
      }
    });
}


Dao.prototype.show_bounties=function(username, cb) {
  
  cb(" not implemented yet.");
  //TODO
}


Dao.prototype.claim_bounty=function(b_claimer, b_claimee, ok_cb, err_cb) {
  if(b_claimer == b_claimee) {
    err_cb("You can't claim your own bounty.");
    return;
  }
  
  db.bounties.update({$and: [{bountied: b_claimee}, {status:'active'}]},
    {$set:{status: 'claimed', claimed_by: b_claimer}},
      {multi:true},
      function(err, replaced){
        if(err) {
          err_cb("Technical difficulties. What did you DO?");
        } else if(replaced) {
          ok_cb("Claimed bounty on "+b_claimee);
        } else {
          err_cb("No bounty found on "+b_claimee);          
        }
      });
  
}


Dao.prototype.search_active_bounties_for=function(username, found_cb) {
  db.bounties.find(
    { $and: [{bountied: username}, {
      $or: [{status:'active'},{status:'claimed'}]      
      }]},
    function(err,docs) {
      if(err) {
        console.log(err);
      } else if(docs.length>0) {          
        found_cb();
      }
    });    
}


module.exports = Dao;

