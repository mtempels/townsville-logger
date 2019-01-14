/**
 * @fileOverview Test main api
 * @name test.index.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Copyright Townsville.nl
 */

"use strict";

var assert = require('assert');
var async = require('async');
var fs = require('fs');
var logger = require.main.require('lib/index');
var sinon = require('sinon');
var Syslog = require('winston-syslog').Syslog;
var util = require('util');


// Log file to use
var LOG_FILE = '/tmp/townsville_logger_test.log';


/**
 * Helper function to remove existing log files
 * (incl sequence 1-20)
 * @param {} callback
 */
function removeLogFiles(done) {
  var files = [];
  var parts = LOG_FILE.split('.');

  // Construct file paths
  for(var i = 0; i <= 20; i++) {
    if (i === 0) {
      files.push(LOG_FILE);
    } else {
      files.push(util.format(
        '%s%d.%s',
        parts[0], i, parts[1]));
    }
  }

  async.eachSeries(
    files,
    function(file, cb) {
      fs.exists(file, function(exists) {
        if (exists) {
          fs.unlink(file);
        }
        cb();
      });
    },
    done
  );

}


describe('The cs logger', function() {

  // Ditch log file before
  beforeEach(removeLogFiles);

  // Ditch log file after
  afterEach(removeLogFiles);


  it('throws the proper error if not initialized', function() {

    /*jshint loopfunc: true*/
    var inst = logger.createLogger('aap');

    for (var i = 0; i < 5; i++) {
      assert.throws(function() {
        switch(i) {
          case 0: inst.fatal('fatal'); break;
          case 1: inst.error('error'); break;
          case 2: inst.warn('warn'); break;
          case 3: inst.info('info'); break;
          case 4: inst.debug('debug'); break;
          case 5: inst.trace('trace'); break;
        }
      }, function(err) {
        if ((err instanceof Error) &&
            /Log system is not initialized/.test(err) ) {
          return true;
        }
        return false;
      });
    }
  });

  it('supports the required interface', function() {

    logger.deinit();
    logger.init({});

    var inst = logger.createLogger('aap');

    inst.fatal('fatal');
    inst.error('error');
    inst.warn('warn');
    inst.info('info');
    inst.debug('debug');
    inst.trace('trace');

    inst.isFatal();
    inst.isError();
    inst.isWarn();
    inst.isInfo();
    inst.isDebug();
    inst.isTrace();
  });

  it('logs the expected results', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'trace',
      levels: {
        whatever: 'info'
      },
      showName: 'full',
      file: {
        path: LOG_FILE,
        timestamp: false
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');
    assert(inst.isFatal(), 'Expected isFatal true');
    assert(inst.isError(), 'Expected isError true');
    assert(inst.isWarn(), 'Expected isWarn true');
    assert(inst.isInfo(), 'Expected isInfo true');
    assert(inst.isDebug(), 'Expected isDebug true');
    assert(inst.isTrace(), 'Expected isTrace true');

    // Test levels
    inst.fatal('fatal');
    inst.error('error');
    inst.warn('warn');
    inst.info('info');
    inst.debug('debug');
    inst.trace('trace');

    // Test formatting
    inst.debug('aap %s noot %d mies', 'test', 24);

    // Test appending
    inst.debug('test %d append', 123, '[some]');

    // Another logger
    var inst2 = logger.createLogger('myother');
    inst2.debug('check');

    // Some time to flush
    setTimeout(
      function() {

        // Read file
        fs.readFile(LOG_FILE, function(err, data) {
          if (err) {
            throw err;
          }

          assert.equal(
            data,
            'fatal: [mylog.mymodule] fatal\n' +
              'error: [mylog.mymodule] error\n' +
              'warn: [mylog.mymodule] warn\n' +
              'info: [mylog.mymodule] info\n' +
              'debug: [mylog.mymodule] debug\n' +
              'trace: [mylog.mymodule] trace\n' +
              'debug: [mylog.mymodule] aap test noot 24 mies\n' +
              'debug: [mylog.mymodule] test 123 append [some]\n' +
              'debug: [mylog.myother] check\n',
            'log file not as expected');
          done();
        });
      },
      500
    );
  });

  it('handles module levels properly', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'info',
      levels: {
        'aap': 'error',
        'noot': 'debug',
        'mies': 'trace'
      },
      showName: 'full',
      file: {
        path: LOG_FILE,
        timestamp: false
      }
    });

    // Create log instances
    var aap = logger.createLogger('aap');
    var noot = logger.createLogger('noot');
    var mies = logger.createLogger('mies');

    // Check aap levels
    assert(aap.isFatal());
    assert(aap.isError());
    assert(!aap.isWarn());
    assert(!aap.isInfo());
    assert(!aap.isDebug());
    assert(!aap.isTrace());

    // Check noot levels
    assert(noot.isFatal());
    assert(noot.isError());
    assert(noot.isWarn());
    assert(noot.isInfo());
    assert(noot.isDebug());
    assert(!noot.isTrace());

    // Check mies levels
    assert(mies.isFatal());
    assert(mies.isError());
    assert(mies.isWarn());
    assert(mies.isInfo());
    assert(mies.isDebug());
    assert(mies.isTrace());

    done();
  });


  it('logs without prefixes', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'trace',
      showName: false,
      showPid: false,
      file: {
        path: LOG_FILE,
        timestamp: false
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(
      function() {

        // Read file
        fs.readFile(LOG_FILE, function(err, data) {
          if (err) {
            throw err;
          }

          var str = data.toString('ascii');
          var expect = 'info: info\n';
          assert.equal(str, expect, 'log file not as expected');
          done();
        });
      },
      500
    );
  });


  it('logs with name prefix', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'trace',
      showName: true,
      showPid: false,
      file: {
        path: LOG_FILE,
        timestamp: false
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(
      function() {

        // Read file
        fs.readFile(LOG_FILE, function(err, data) {
          if (err) {
            throw err;
          }

          var str = data.toString('ascii');
          var expect = 'info: [mymodule] info\n';
          assert.equal(str, expect, 'log file not as expected');
          done();
        });
      },
      500
    );
  });


  it('logs with pid prefix', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'trace',
      showName: false,
      showPid: true,
      file: {
        path: LOG_FILE,
        timestamp: false
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(
      function() {

        // Read file
        fs.readFile(LOG_FILE, function(err, data) {
          if (err) {
            throw err;
          }

          var str = data.toString('ascii');
          var expect = util.format('info: [#%d] info\n', process.pid);
          assert.equal(str, expect, 'log file not as expected');
          done();
        });
      },
      500
    );
  });


  it('logs with pid and name prefix', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'trace',
      showName: true,
      showPid: true,
      file: {
        path: LOG_FILE,
        timestamp: false
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(
      function() {

        // Read file
        fs.readFile(LOG_FILE, function(err, data) {
          if (err) {
            throw err;
          }

          var str = data.toString('ascii');
          var expect = util.format('info: [#%d-mymodule] info\n', process.pid);
          assert.equal(str, expect, 'log file not as expected');
          done();
        });
      },
      500
    );
  });


  it('logs a timestamp properly', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'info',
      showName: true,
      file: {
        path: LOG_FILE
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');
    inst.info('test123');

    // Some time to flush
    setTimeout(
      function() {

        // Read file
        fs.readFile(LOG_FILE, function(err, data) {
          if (err) {
            throw err;
          }

          var str = data.toString('ascii');
          // Check with regex
          assert(str.match(/\d{8}-\d{6}[.]\d{3} - info: \[mymodule\] test123\n$/g),
                 'log file not as expected');
          done();
        });
      },
      500
    );
  });

  it('handles rolling file correctly', function(done) {

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'info',
      showName: true,
      file: {
        path: LOG_FILE,
        "rollingFile": {
          "maxSize": 45,
          "maxFiles": 5
        }
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');

    var i = 0;
    var interval = setInterval(
      function() {
        if (i < 5) {
          inst.info('aap', i);
          i++;
        } else {
          clearInterval(interval);
          var files = [
            '/tmp/cs_logger_test.log',
            '/tmp/cs_logger_test1.log',
            '/tmp/cs_logger_test2.log',
            '/tmp/cs_logger_test3.log',
            '/tmp/cs_logger_test4.log',
          ];

          async.forEach(
            files,
            function(file, cb) {
              fs.exists(file, function(exists) {
                assert(exists, file + ' should exist');
                cb();
              });
            },
            function() {
              done();
            }
          );
        }
      },
      10
    );
  });

  it('logs to syslog', function(done) {

    // Set spy on syslog transport log method
    var logSpy = sinon.spy(Syslog.prototype, 'log');

    // Create file logger
    logger.deinit();
    logger.init({
      name: 'mylog',
      level: 'trace',
      showName: true,
      syslog: {
      }
    });

    // Create log instance
    var inst = logger.createLogger('mymodule');

    inst.fatal('fatal');
    inst.error('error');
    inst.warn('warn');
    inst.info('info');
    inst.debug('debug');
    inst.trace('trace');

    setTimeout(
      function() {

        assert.equal(logSpy.callCount, 6, 'expected 6 log calls');
        assert.equal(logSpy.args[0][0], 'crit', 'expected "crit" level');
        assert.equal(logSpy.args[0][1], '[mymodule] fatal', 'expected fatal');
        assert.equal(logSpy.args[1][0], 'error', 'expected "error" level');
        assert.equal(logSpy.args[1][1], '[mymodule] error', 'expected error');
        assert.equal(logSpy.args[2][0], 'warning', 'expected "warning" level');
        assert.equal(logSpy.args[2][1], '[mymodule] warn', 'expected warn');
        assert.equal(logSpy.args[3][0], 'info', 'expected "info" level');
        assert.equal(logSpy.args[3][1], '[mymodule] info', 'expected info');
        assert.equal(logSpy.args[4][0], 'debug', 'expected "debug" level');
        assert.equal(logSpy.args[4][1], '[mymodule] debug', 'expected debug');
        assert.equal(logSpy.args[5][0], 'debug', 'expected "debug" level');
        assert.equal(logSpy.args[5][1], '[mymodule] trace', 'expected trace');
        done();
      },
      500
    );
  });

});
