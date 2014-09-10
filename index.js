#!/usr/bin/env node
/*jshint node:true */
'use strict';

var version = require('./package.json').version;
var request = require('request');
var program = require('commander');
var nextTime = require('next-time');
var spawn = require('child_process').spawn;
require('colors');

program
.version(version)
.usage('[options]')
.option('-s, --symbol <sym>', 'stock symbol')
.option('-u, --upper <n>', 'Upper limit', parseFloat)
.option('-l, --lower <n>', 'Lower limit', parseFloat)
.parse(process.argv);


var PERIOD = 5 * 60 * 1000;
var URL = 'https://finance.google.com/finance/info?client=ig&q={symbol}';
var MARKET_OPEN = '6:30'; // PDT
var MARKET_CLOSE = '13:00'; // PDT

var symbol = program.symbol;
var upper = program.upper || 100.0;
var lower = program.lower || 0.0;

if (!symbol) {
  return program.help();
}

var jar = request.jar();

function bail(err) {
  console.error(err.stack);
  return process.exit(1);
}

function say(message) {
  var opts = {
    detached: true,
    stdio: 'inherit', // stay attached to TTY
  };
  var sayProc = spawn('/usr/bin/say', [message], opts);
  sayProc.unref();
  process.stdout.write(message.bold + '\n');
}

function checkStock() {
  var symbolUrl = URL.replace('{symbol}', symbol);
  var opts = {
    method: 'GET',
    url: symbolUrl,
    json: false,
    jar: jar
  };
  request(opts, function(err, response, body) {
    if (err) {
      return bail(err);
    }

    var json = body.replace(/^\s*\/\/\s*/,'');
    try {
      var data = JSON.parse(json);
      doDisplay(data[0]);
    } catch(e) {
      return bail(e);
    }
  });
}

var limitSaid = 'nothing';
function doDisplay(data) {
  var str = data.lt_dts + ': ';
  var price = data.l;
  var priceFloat = parseFloat(price);

  if (priceFloat <= lower) {
    str += price.bold.red;
    if (limitSaid !== 'lower') {
      say('stop loss');
      limitSaid = 'lower';
    }

  } else if (priceFloat >= upper) {
    str += price.bold.green;
    if (limitSaid !== 'upper') {
      say('price target');
      limitSaid = 'upper';
    }

  } else {
    str += price;
    limitSaid = 'nothing';
  }

  var change = data.c;
  var changeFloat = parseFloat(change);
  var changeStr = change + ' / ' + data.cp + '%';
  str += ' (';
  if (changeFloat < 0.0) {
    str += changeStr.red;
  } else {
    str += changeStr.green;
  }
  str += ')\n';

  process.stdout.write(str);
}

function sayLimits() {
  process.stdout.write(symbol.blue.bold + ' -' +
                       ' Upper: ' + (upper+'').green +
                       ' Lower: ' + (lower+'').red +
                       '\n');
}

var marketSaid = 'nothing';
function checkState() {
  var today = (new Date().getDate());
  var nextOpen = nextTime(MARKET_OPEN).getDate();
  var nextClose = nextTime(MARKET_CLOSE).getDate();

  if (nextClose === today && nextOpen !== today) {
    // market open!
    if (marketSaid !== 'open') {
      say("Market is open!");
      sayLimits();
      marketSaid = 'open';
    }

    checkStock();

  } else {
    // market is closed
    if (marketSaid !== 'closed') {
      say("Market is closed!");
      sayLimits();
      checkStock(); // one last time
      marketSaid = 'closed';
    }
  }
}

setInterval(checkState, PERIOD);
checkState();

