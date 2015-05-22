var forever = require('forever-monitor');

var child = new (forever.Monitor)('sentinel.js', {  
  silent: false,  
  'uid': 'CivSentinel',
  'minUptime': 8000,     // Minimum time a child process has to be up. Forever will 'exit' otherwise.
  'spinSleepTime': 1200000, // Interval between restarts if a child is spinning (i.e. alive < minUptime).

});

child.on('error', function (err) {
  console.log('your-filename.js error:'+err);
});

child.on('exit', function () {
  console.log('your-filename.js has exited after 3 restarts');
});

child.on('exit:code', function(code) {
    console.error('Forever detected script exited with code ' + code);
});

child.start();