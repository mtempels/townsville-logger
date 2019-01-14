Connection Systems logger library (based on Winston)
===

API for logging, hiding the actual implementation of Winston behind a generic
interface.
Offer logging of module names and setting of a level per module, to make
tracking issues easier.
If you want to use syslog over udp, note that this is typically not enabled
by default on Ubuntu. (alter /etc/rsyslog.conf and reload)

### Install
npm install ConnectionSystems/cs-logging

### Uninstall
npm remove cs-logging

### Usage

Use settings as follows in your config.json.
Currently supported: console, file and syslog logging.

```
{
    "logSettings":
    {
        "name": "name of the program",
        "showName": "true/false/full/simple/none",
        "showPid": "true/false",
        "level": "trace/debug/info/warn/error/fatal",
        "levels": {
             "module name": "trace/debug/info/warn/error/fatal",
        }
        "console":
        {
            "timestamp": "true/false",
            "colorize": "true/false"
        },
        "file":
        {
            "path": "file path",
            "timestamp": "true/false",
            "colorize": "true/false",
            "rollingFile": {
                "maxSize": 10000000;
                "maxFiles" 20
            }
        },
        "syslog":
        {
            "host": "syslog host (default localhost)",
            "port": "syslog port (default syslog port)",
            "protocol": "udp4, tcp4, unix, unix-connect (default udp4)",
            "path": "path to syslog dgram socket",
            "facility": "syslog facility (default local0)",
            "localhost": "source host (default current hostname)",
            "type": "syslog protocol BSD, RFC5425 (default RFC5425)"
        }
    }
}
```

Typical usage

```javascript
var logger = require('cs-logger');

// Init the underlying log system (only once)
// If you omit settings, you will get a console logger
logger.init();

// Create a log instance
var log = logger.createInstance('mymodule');

// Log something, optionally with formatting
log.debug('aap %d, mies %s', 123, 'noot');

// Check log level first, if constructing the log is expensive
if (log.isTrace()) {
   // do something expensive
   log.trace('whatever');
}
```

### Test
Either run:
 * mocha
 * npm test

### License
Copyright Connection Systems
