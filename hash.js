var crypto = require('crypto');

/////////////////////////////////////
//  Sign
/////////////////////////////////////
exports.sign = function (obj, pass) {

    // uppercase object
    var uObj = {};

    // keys to uppercase
    for (var key in obj) {
        var keyToUpper = key.toUpperCase();
        var value = obj[key];
        delete obj[key];

        obj[keyToUpper] = value;
        uObj[keyToUpper] = value;
    }

    // sort array of keys alphabetically
    var keys = Object.keys(uObj);
    keys.sort();

    // create the text
    var text = "";
    for (var i in keys) {
        text += keys[i] + "=" + uObj[keys[i]] + pass;
    }

    // create the hash to upper case
    uObj.SHASIGN = crypto.createHmac("sha1", pass).update(text).digest("hex").toUpperCase();

    return uObj;
};

