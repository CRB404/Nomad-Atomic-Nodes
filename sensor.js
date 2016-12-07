const Nomad = require('nomad-stream')
const moment = require('moment')
const nomad = new Nomad()
const fetch = require('node-fetch')

var fs = require('fs');
var net = require('net')



function textDecoder () {
  var aisformat = JSON.parse(fs.readFileSync(__dirname + '/aisformat.json', 'utf8'));
  var payloadDict = {};
  var payloadChars = "0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVW`abcdefghijklmnopqrstuvw";
  var i;

  var queue = {};
  var sixbitAscii =
      '@ABCDEFGHIJKLMNO' +
      'PQRSTUVWXYZ[\]^_' +
      //' !"#$%&' + "'" + "()*+,-./" +
      '  "#$%&' + "'" + "()*+,-./" +
      '0123456789:;<=>?';
  var sixbitDict = {};

  var numToSixBitString = function(i) {
    var s = i.toString(2);
    while (s.length < 6) {
      s = "0" + s;
    }
    return s;
  };

  for (i = 0; i < sixbitAscii.length; i++) {
    sixbitDict[numToSixBitString(i)] = sixbitAscii[i];
  }

  for (i = 0; i < payloadChars.length; i++) {
    payloadDict[payloadChars[i]] = numToSixBitString(i);
  }

  var bitsToString = function(bits) {
    var i = 0;
    var s = "";
    var c;
    while (i < bits.length - 1) {
      c = sixbitDict[bits.substring(i, i + 6)];
      s += (c == '@' ? '' : c);
      i += 6;
    }
    return s;
  };

  var parseSigned = function(x) {
    if (x[0] == '0') {
      return parseInt(x, 2);
    }
    return parseInt(x, 2) - Math.pow(2, x.length);
  };

  this.decode = function(encoded) {
    var i, val;
    var parts = encoded.split(',');
    if (parts[0] != "!AIVDM") {
      console.error("ERR: not an !AIVDM message");
    }
    var numSegments = parts[1];
    var segmentIndex = parts[2];
    var id = parts[3];
    var payload = parts[5];
    var checksumList = encoded.substring(1).split('*');

    if (!testChecksum(checksumList[0], parseInt(checksumList[1], 16))) {
      console.error("ERR: checksum error");
    }


    if (!payload) {
      return;
    }
    if (numSegments > 1) {
      if (!queue[id]) {
        queue[id] = [];
      }
      queue[id][segmentIndex - 1] = payload;
      for (i = 0; i < numSegments; i++) {
        if (!queue[id][i]) {
          return;
        }
      }
      payload = queue[id].join("");
      delete queue[id];
    }

    var bits = "";
    for (i = 0; i < payload.length; i++) {
      bits += payloadDict[payload[i]];
    }
    var type = parseInt(bits.substring(0, 6), 2);
    var output = {};

    if ((type < 1) || (type > aisformat.length)) {
      console.error("ERR: type out of range");
      return;
    }
    for (i = 0; i < aisformat[type - 1].fields.length; i++) {
      var field = aisformat[type - 1].fields[i];
      var ss = bits.substring(field.start, field.start + field.length);
      switch (field.type[0]) {
        case 'u':
          val = parseInt(ss, 2);
          break;
        case 'U':
          val = parseInt(ss, 2) / Math.pow(10, parseInt(field.type[1]));
          break;
        case 'i':
          val = parseSigned(ss);
          break;
        case 'I':
          val = parseSigned(ss) / Math.pow(10, parseInt(field.type[1]));
          break;
        case 'b':
          val = (ss == '1');
          break;
        case 'e':
          val = field.enum[parseInt(ss, 2)];
          break;
        case 't':
          val = bitsToString(ss);
          break;
        case 'd':
          val = ss;
          break;
      }
      if (field.callback) {
        val = global[field.callback](val);
      }
      output[field.name] = val;
    }
    return output;
  };
}

function testChecksum(s, cs) {
  var checksum = 0;
  for(var i = 0; i < s.length; i++) {
    checksum = checksum ^ s.charCodeAt(i);
  }
  return (cs == checksum);
}

global.rot = function(x) {
  if (x == 0) {
    return "not turning";
  }
  if (x == 128) {
    return "no information available";
  }
  return 4.733 * Math.sqrt(Math.abs(x))* (x < 0 ? -1 : 1);
};

global.degrees = function(x) {
  return x / 60.0;
};

exports.textDecoder = textDecoder;

var TextDecoder = new textDecoder();

var pack = []

var client = new net.Socket();
client.connect(2999, 'bitway.com', function() {
  });
  var str = "";

  client.on('data', function(data) {
    for (var i = 0; i < data.length; i++) {
      str += String.fromCharCode(data[i]);
      var payload = (str.split(','))[5];
      if (data[i] == 10) {
        var decoded = TextDecoder.decode(str);
        if (decoded) {
            // console.log(TextDecoder.decode(str));
            if (instance) {

              // pack.push(decoded)
              console.log('fetched:', decoded)
              instance.publish(JSON.stringify(decoded))
            }
        }

        str = "";
        return str;
      }
    }
  });

var frequency = 60 * 10 //1 minute

// function startPoll(frequency) {
//   setInterval(() => {
//         console.log('fetched:', decoded)
//         instance.publish(JSON.stringify(decoded))
//         pack = []
//   }, frequency)
// }

nomad.prepareToPublish()
  .then((node) => {
    instance = node
    return instance.publishRoot('ais setup')
  })
  .then(() => startPoll(frequency))
  .catch(console.log)
