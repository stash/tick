#!/usr/bin/env node
/*jshint node:true */
'use strict';

var version = require('./package.json').version;
var request = require('request');
var program = require('commander');
var nextTime = require('next-time');
require('colors');

var SayState = require('./lib/say-state.js').SayState;

program
.version(version)
.usage('[options]')
.option('-s, --symbol <sym>', 'stock symbol')
.option('-u, --upper <n>', 'Upper limit', parseFloat)
.option('-l, --lower <n>', 'Lower limit', parseFloat)
.option('-p, --period <n>', 'Poll period, in minutes)', parseFloat, 5.0)
.parse(process.argv);


var DEFAULT_PERIOD = 5; // minutes
var URL = 'https://finance.google.com/finance/info?client=ig&q={symbol}';
var MARKET_OPEN = '6:30'; // PDT
var MARKET_CLOSE = '13:00'; // PDT

var symbol = program.symbol;
var upper = program.upper || 100.0;
var lower = program.lower || 0.0;
var period = program.period;

if (!symbol) {
  return program.help();
}

if (!period) {
  period = DEFAULT_PERIOD;
} else if (!period || period <= 1.0) {
  console.error("Refusing to poll faster than one minute, "+
                "setting to default "+DEFAULT_PERIOD+" minutes");
  period = DEFAULT_PERIOD;
}

var jar = request.jar();

function bail(err) {
  console.error(err.stack);
  return process.exit(1);
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

var limitState = new SayState({
  'lower': 'Lower Bound!',
  'upper': 'Upper Bound!',
  'middle': 'in the middle.',
});

function doDisplay(data) {
  var str = data.lt_dts + ': ';
  var price = data.l;
  var priceFloat = parseFloat(price);

  if (priceFloat <= lower) {
    str += price.bold.red;
    limitState.is('lower');

  } else if (priceFloat >= upper) {
    str += price.bold.green;
    limitState.is('upper');

  } else {
    str += price;
    limitState.is('middle');
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

var marketState = new SayState({
  'open':   'Market is open!',
  'closed': 'Market is closed.'
});
function checkState() {
  var today = (new Date().getDate());
  var nextOpen = nextTime(MARKET_OPEN).getDate();
  var nextClose = nextTime(MARKET_CLOSE).getDate();

  if (nextClose === today && nextOpen !== today) {
    var wasOpen = marketState.is('open');
    // market open!
    if (!wasOpen) {
      sayLimits();
    }

    checkStock();

  } else {
    // market is closed
    var wasClosed = marketState.is('closed');
    if (!wasClosed) {
      sayLimits();
      checkStock(); // one last time
    }
  }
}

setInterval(checkState, period * 60 * 1000);
checkState();

