var crypto = require('crypto');

exports.getPageData = function(link) {

    var data = link.data;

    if (!data) {
        link.send(400, "Missing data.");
        return;
    }

    if (!data.page) {
        link.send(400, "Missing page key of data.");
        return;
    }

    link.session.checkout = link.session.checkout || {};
    var response = link.session.checkout[data.page] || {};

    link.send(200, response);
};

exports.savePageData = function(link) {

    var data = link.data;

    if (!data) {
        link.send(400, "Missing data.");
        return;
    }

    if (!data.page) {
        link.send(400, "Missing page key of data.");
        return;
    }

    if (!data.page || !data.form) {
        link.send(400, "Missing form key of data.");
        return;
    }

    // TODO validate data

    var valid = true;
    var response = [];

    for (var i in data.form) {
        var input = data.form[i];

        if (!input.value) {
            // it is an Alt item
            if (input.name.indexOf("Alt") !== -1) {
                if (link.data.alt) {
                    // TODO is it required?
                    response.push({"name": input.name, "err": "This cannot be empty."});
                    valid = false;
                }
            }
            else {
                // TODO is it required?
                response.push({"name": input.name, "err": "This cannot be empty."});
                valid = false;
            }
        }
    }

    if (!valid) {
        link.send(400, response);
        return;
    }

    link.session.checkout = link.session.checkout || {};
    link.session.checkout[data.page] = data.form;

    link.send(200);
};

exports.placeOrder = function(link) {
    link.send(200);
};

