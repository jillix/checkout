var hash = require('./hash');


function nonEmpty40(value) {
    if (!value.trim()) {
        return 'This is mandatory';
    }

    if (value.length > 40) {
        return 'This must be shorter than 40 characters';
    }
};

var ADDRESS_FIELD_VALIDATORS = {
    firstname: nonEmpty40,
    lastname: nonEmpty40,
    street: nonEmpty40,
    city: nonEmpty40,
    tel: nonEmpty40,
    zip: function(value) {
        var zip = parseInt(value);
        if (isNaN(zip) || zip > 9999 || zip < 1000 || value.length != 4) {
            return 'This is not a valid zip code';
        }
    },
    email: function (value) {
        if (value.length > 50) {
            return 'You have a pretty long email address';
        }
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (!re.test(value)) {
            return 'This is not a valid email address';
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

function validateAddress(dataArray, hasAlt) {
    var errors = [];
    for (var i in dataArray) {

        var name = dataArray[i].name;

        if (name.indexOf("delivery") !== -1 && !hasAlt) {
            return errors;
        }

        name = name.substring(name.lastIndexOf(".") + 1);

        var validator = ADDRESS_FIELD_VALIDATORS[name];
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

function validatePage(page, dataArray, hasAlt) {
    var pageValidator = PAGE_FORM_VALIDATORS[page];
    var errors;
    if (typeof pageValidator === 'function') {
        errors = pageValidator(dataArray, hasAlt);
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

    getSettings(link.params.dsSettings, function(err, settings) {

        if (err) {
            link.send(500, "Error while accessing the settings");
            return;
        }

        var checkout = link.session.checkout || {};
        var pageData = validateFormNew(link, checkout, data.page);

        switch (pageData.page) {

            case 'review':
                pageData.data = pageData.data || [];
                pageData.data = pageData.data.concat(checkout.address);
                break;

            case 'payment':

                settings = settings || {};
                settings.payments = settings.payment || {};

                var pspid = settings.payments.pspid;
                var passphrase = settings.payments.passphrase;

                var formData = {
                    PSPID: pspid
                };

                var checkout = link.session.checkout || {};
                // TODO add more data to the form data object

                // sign the form data object
                formData = hash.sign(formData, passphrase);
                pageData.data = formData;
                break;
        }

        link.send(200, pageData);
    });
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

    if (!data.form) {
        link.send(400, "Missing form key of data.");
        return;
    }

    var hasAlt = false;
    for (var i in data.form) {
        if (data.form[i].name === "hasAlt") {
            hasAlt = true;
            break;
        }
    }

    var errors = validatePage(data.page, data.form, hasAlt);


    // we found an error
    if (errors && errors.length) {
        link.send(200, { data: data.form, errors: errors, page: data.page });
        return;
    }

    var valid = true;

    if (!hasAlt) {
        for (var i = 0; i < data.form.length; ++i) {

            var info = data.form[i].name.split(".");

            if (info[0] === "delivery") {
                for (var j = 0; j < data.form.length; ++j) {
                    var secundInfo = data.form[j].name.split(".");

                    if (secundInfo[1] === info[1]) {
                        data.form[i].value = data.form[j].value;
                        break;
                    }
                }
            }
        }
    }

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

function getSettings (dataSourceName, callback) {

    M.datasource.resolve(dataSourceName, function(err, ds) {

        if (err) {
            callback(err);
            return;
        }

        M.database.open(ds, function(err, db) {

            if (err) {
                callback(err);
                return;
            }

            db.collection(ds.collection, function(err, collection) {

                if (err) {
                    callback(err);
                    return;
                }

                collection.findOne({}, callback);
            });
        });
    });
}

