// this will show you all the valid timezones
// you should set the argument --timezone to your local one.
// to run this do...

// npm install moment-timezone
// node timezone.js

var moment = require('moment-timezone');
console.log(moment.tz.names());
