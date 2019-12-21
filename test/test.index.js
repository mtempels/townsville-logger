/**
 * @fileOverview Test main api
 * @name test.index.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Copyright Townsville.nl
 */

"use strict";

const assert = require('assert');
const async = require('async');
const fs = require('fs');
const logger = require('../lib/index');
const util = require('util');


// Log file to use
const LOG_FILE = '/tmp/cs_logger_test.log';


/**
 * Helper function to remove existing log files
 * (incl sequence 1-20)
 * @param {} callback
 */
function removeLogFiles(done) {
  var files = [];
  var parts = LOG_FILE.split('.');

  // Construct file paths
  for (let i = 0; i <= 20; i++) {
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
    (file, cb) => {
      fs.exists(file, (exists) => {
        if (exists) {
          fs.unlink(file, (err) => {
            if (err) {
              assert(err, "Unlink files failed");
            }
          });
        }
        cb();
      });
    },
    done
  );

}


describe('The cs logger', () => {

  // Ditch log file before
  beforeEach(removeLogFiles);

  // Ditch log file after
  afterEach(removeLogFiles);


  it('throws the proper error if not initialized', () => {

    /*jshint loopfunc: true*/
    const inst = logger.createLogger('aap');

    for (let i = 0; i < 5; i++) {
      assert.throws(() => {
        switch (i) {
          case 0:
            inst.fatal('fatal');
            break;
          case 1:
            inst.error('error');
            break;
          case 2:
            inst.warn('warn');
            break;
          case 3:
            inst.info('info');
            break;
          case 4:
            inst.debug('debug');
            break;
          case 5:
            inst.trace('trace');
            break;
        }
      }, (err) => {
        if ((err instanceof Error) &&
          /Log system is not initialized/.test(err)) {
          return true;
        }
        return false;
      });
    }
  });

  it('supports the required interface', () => {

    logger.deinit();
    logger.init({});

    const inst = logger.createLogger('aap');

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

  it('logs the expected results', (done) => {

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
    const inst = logger.createLogger('mymodule');
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
    inst.debug('test another append', 0);
    inst.debug('test object append', {
      teun: 1,
      toon: 'august',
    });

    // Another logger
    const inst2 = logger.createLogger('myother');
    inst2.debug('check');

    // Some time to flush
    setTimeout(
      () => {

        // Read file
        fs.readFile(LOG_FILE, 'utf8', (err, data) => {
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
            'debug: [mylog.mymodule] test another append 0\n' +
            'debug: [mylog.mymodule] test object append {"teun":1,"toon":"august"}\n' +
            'debug: [mylog.myother] check\n',
            'log file not as expected');
          done();
        });
      },
      500
    );
  });

  it('handles module levels properly', (done) => {

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
    const aap = logger.createLogger('aap');
    const noot = logger.createLogger('noot');
    const mies = logger.createLogger('mies');

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


  it('logs without prefixes', (done) => {

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
    const inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(() => {
      // Read file
      fs.readFile(LOG_FILE, (err, data) => {
        if (err) {
          throw err;
        }

        const str = data.toString('ascii');
        const expect = 'info: info\n';
        assert.equal(str, expect, 'log file not as expected');
        done();
      });
    }, 500);
  });


  it('logs with name prefix', (done) => {

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
    const inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(() => {
      // Read file
      fs.readFile(LOG_FILE, (err, data) => {
        if (err) {
          throw err;
        }

        const str = data.toString('ascii');
        const expect = 'info: [mymodule] info\n';
        assert.equal(str, expect, 'log file not as expected');
        done();
      });
    }, 500);
  });


  it('logs with pid prefix', (done) => {

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
    const inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(() => {
      // Read file
      fs.readFile(LOG_FILE, (err, data) => {
        if (err) {
          throw err;
        }

        const str = data.toString('ascii');
        const expect = util.format('info: [#%d] info\n', process.pid);
        assert.equal(str, expect, 'log file not as expected');
        done();
      });
    }, 500);
  });


  it('logs with pid and name prefix', (done) => {

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
    const inst = logger.createLogger('mymodule');
    inst.info('info');

    // Some time to flush
    setTimeout(() => {
      // Read file
      fs.readFile(LOG_FILE, (err, data) => {
        if (err) {
          throw err;
        }

        const str = data.toString('ascii');
        const expect = util.format('info: [#%d-mymodule] info\n', process.pid);
        assert.equal(str, expect, 'log file not as expected');
        done();
      });
    }, 500);
  });


  it('logs a timestamp properly', (done) => {

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
    const inst = logger.createLogger('mymodule');
    inst.info('test123');

    // Some time to flush
    setTimeout(() => {
      // Read file
      fs.readFile(LOG_FILE, (err, data) => {
        if (err) {
          throw err;
        }

        const str = data.toString('ascii');
        // Check with regex
        assert(str.match(/\d{8}-\d{6}[.]\d{3} - info: \[mymodule\] test123\n$/g),
          'log file not as expected');
        done();
      });
    }, 500);
  });

  it('handles rolling file correctly', (done) => {

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
    const inst = logger.createLogger('mymodule');

    let i = 0;
    const interval = setInterval(() => {
      if (i < 5) {
        inst.info('aap', i);
        i++;
      } else {
        clearInterval(interval);
        const files = [
          '/tmp/cs_logger_test.log',
          '/tmp/cs_logger_test1.log',
          '/tmp/cs_logger_test2.log',
          '/tmp/cs_logger_test3.log',
          '/tmp/cs_logger_test4.log',
        ];

        async.forEach(
          files,
          (file, cb) => {
            fs.exists(file, (exists) => {
              assert(exists, file + ' should exist');
              cb();
            });
          },
          done
        );
      }
    }, 10);
  });

});