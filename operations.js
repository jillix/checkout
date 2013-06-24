var crypto = require('crypto');

var ADDRESS_FIELD_VALIDATORS = {
    firstname: function(value) {
        if (!value.trim()) {
            return 'This is mandatory';
        }
    }
};

var REVIEW_FIELD_VALIDATORS = {
    accept: function(value) {
        if (!value) {
            return 'You must accept the Terms';
        }
    }
};

function validateAddress(dataArray) {
    var errors = [];
    for (var i in dataArray) {
        var validator = ADDRESS_FIELD_VALIDATORS[dataArray[i].name];
        if (typeof validator === 'function') {
            var error = validator(dataArray[i].value);
            if (error) {
                errors.push({ name: dataArray[i].name, err: error });
            }
        }
    }
    return errors;
}

function validateReview(dataArray) {

    var errors = [];

    var found = false;
    for (var i in dataArray) {
        if (dataArray[i].name === 'accept') {
            dataArray[i].value = dataArray[i].value === 'on' || dataArray[i].value ===  true;
            found = true;
        }
    }
    if (!found) {
        dataArray.push({ name: 'accept', value: false });
    }

    for (var i in dataArray) {
        var validator = REVIEW_FIELD_VALIDATORS[dataArray[i].name];
        if (typeof validator === 'function') {
            var error = validator(dataArray[i].value);
            if (error) {
                errors.push({ name: dataArray[i].name, err: error });
            }
        }
    }
    return errors;
}

var PAGE_FORM_VALIDATORS = {
    address: validateAddress,
    review: validateReview
};

function validatePage(page, dataArray) {
    var pageValidator = PAGE_FORM_VALIDATORS[page];
    var errors;
    if (typeof pageValidator === 'function') {
        errors = pageValidator(dataArray);
    }
    return errors;
}

/* =============================================== */

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

    var checkout = link.session.checkout || {};
    var pageData = validateFormNew(link, checkout, data.page);

    if (pageData.page === 'review') {
        pageData.data = pageData.data || [];
        pageData.data = pageData.data.concat(checkout.address);
    }

    link.send(200, pageData);
};

var PAGE_ORDER = ['address', 'review', 'payment', 'confirmation'];

function validateFormNew (link, checkout, page) {

    var result = {
        data: [],
        errors: [],
        page: page
    };

    for (var i in PAGE_ORDER) {
        result.page = PAGE_ORDER[i];
        result.data = checkout[PAGE_ORDER[i]];

        // if no data was saved so far for this page show no errors
        if (!result.data) {
            break;
        }

        // validate the up to the current page
        result.errors = validatePage(result.page, result.data);
        if (result.errors && result.errors.length) {
            break;
        }

        // we reached the desired page
        if (result.page === page) {
            break;
        }
    }

    return result;
}

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

    var errors = validatePage(data.page, data.form);

    // we found an error
    if (errors && errors.length) {
        link.send(200, { data: data.form, errors: errors, page: data.page });
        return;
    }

    var valid = true;

    var checkout = link.session.checkout || {};
    checkout[data.page] = data.form;

    link.session.set({ checkout: checkout }, function (err) {

        if (err) {
            link.send(400, err);
            return;
        }

        var formData = validateFormNew(link, checkout, data.page);

        // reset the accept field on every change
        if (checkout['review']) {
            checkout['review'].accept = false;
        }

        link.send(200, formData);
    });
};

exports.placeOrder = function(link) {

    // validate address
    if (!link.params || !link.params.orderFile) {
        link.send(400, "Missing orderFile from placeOrder operation parameters.");
        return;
    }

    var Order = require(M.app.getPath() + '/' + link.params.orderFile);
    Order.start(link.session, link.params, function (err, data) {
        if (err) {
            link.send(400, err);
            return;
        }

        link.send(200, data);
    });
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
