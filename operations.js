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
    var formArray = link.session.checkout[data.page];

    var res = validateForm(data.page, formArray, data.alt);

    if (!res.value && res.errors.length) {
        link.send(400, { "errors": res.errors, "data": formArray });
        return;
    }

    link.send(200, formArray);
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

    var checkout = link.session.checkout || {};
    checkout[data.page] = data.form;

    link.session.set({ checkout: checkout }, function (err) {

        if (err) {
            link.send(400, err);
            return;
        }

        var response = validateForm(data.page, data.form, data.alt);
        valid = response.value;

        if (!valid) {
            link.send(400, response.errors);
            return;
        }

        link.send(200);
    });
};

exports.placeOrder = function(link) {
    link.send(200);
};

function validateForm (page, formArray, alt) {

    var res = {
        value: null,
        errors: []
    }

    if (!formArray) {
        return res;
    }

    var valid = true;
    var response = [];

    // review form and checkbox not checked
    if (page === "review" && !formArray.length) {
        valid = false;
        response.push({"name": "accept", "err": "You must agree the terms."});
    }

    for (var i in formArray) {

        var input = formArray[i];

        if (!input.value) {
            // it is an Alt item
            if (input.name.indexOf("Alt") !== -1) {
                if (alt) {
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

    res.value = valid;
    res.errors = response
    return res;
}
