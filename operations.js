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

        if (err || !settings) {
            link.send(500, "Error while accessing the settings");
            return;
        }

        // TODO add a mechanism to check all these default setting options to avoid multiple code checks
        settings.payments = settings.payments || {};

        var checkout = link.session.checkout || {};
        var pageData = validateFormNew(link, checkout, data.page);
        var urls = settings.payments.urls || {};

        getCart(link.params.dsCarts, link.session._sid, function (err, cart) {

            if (err) {
                link.send(400, err);
                return;
            }

            // cart is empty, redirect to shop page
            if (!cart || JSON.stringify(cart.items) === "{}") {
                var shopUrl = urls.shop || "/";
                link.res.headers["Location"] = shopUrl;

                var res = {
                    "redirect": shopUrl
                };

                link.send(200, res);
                return;
            }

            var paid = false;

            if (link.session && link.session.checkout && link.session.checkout.paid && link.session.checkout.paid.query) {
                paid = true;
            }

            // verify payment
            if (pageData.page === "payment" && paid) {
                pageData.page = "confirmation";
            }

            if (pageData.page === "confirmation" && !paid) {
                pageData.page = "payment";
            }

            switch (pageData.page) {

                case 'review':
                    pageData.data = pageData.data || [];
                    pageData.data = pageData.data.concat(checkout.address);
                    break;

                case 'payment':

                    var pspid = settings.payments.pspid;
                    var passphrase = settings.payments.passphrase;

                    checkout.costs = checkout.costs || {};

                    var orderid = new Date().getTime();

                    var payments = link.session.payments || {};
                    payments.orderid = orderid;

                    link.session.set({ payments: payments }, function (err) {

                        if (err) {
                            link.send(400, err);
                            return;
                        }

                        var formData = {
                            PSPID: pspid,
                            ORDERID: link.session.payments.orderid,
                            LANGUAGE: 'de_CH',
                            CURRENCY: 'CHF',
                            AMOUNT: checkout.costs.total
                        };

                        // user data
                        var fname, lname;
                        for (var i in checkout.address) {
                            switch (checkout.address[i].name) {
                                case 'invoice.firstname':
                                    fname = checkout.address[i].value;
                                    break;
                                case 'invoice.lastname':
                                    lname = checkout.address[i].value;
                                    break;
                                case 'invoice.email':
                                    formData.EMAIL = checkout.address[i].value;
                                    break;
                                case 'invoice.street':
                                    formData.OWNERADDRESS = checkout.address[i].value;
                                    break;
                                case 'invoice.city':
                                    formData.OWNERTOWN = checkout.address[i].value;
                                    break;
                                case 'invoice.region':
                                    formData.OWNERCTY = checkout.address[i].value;
                                    break;
                                case 'invoice.tel':
                                    formData.OWNERTELNO = checkout.address[i].value;
                                    break;
                            }
                        }

                        formData.CN = fname + ' ' + lname;

                        // redirect urls
                        var urls = settings.payments.urls || {};
                        var protocol = (link.req.connection.encrypted ? "https://" : "http://");
                        var operationLink = protocol + link.req.headers.host + "/@/" + link.operation.module + "/paymentResult";

                        formData.ACCEPTURL      = operationLink + "?s=a";
                        formData.DECLINEURL     = operationLink + "?s=d";
                        formData.EXCEPTIONURL   = operationLink + "?s=e";
                        formData.CANCELURL      = operationLink + "?s=c";

                        formData.CATALOGURL     = urls.shop;
                        formData.HOMEURL        = urls.home;

                        // look and feel
                        var lookAndFeel = settings.payments.lookAndFeel;
                        for (var prop in lookAndFeel) {
                            formData[prop.toUpperCase()] = lookAndFeel[prop];
                        }

                        // sign the form data object
                        formData = hash.sign(formData, passphrase);
                        pageData.data = formData;

                        link.send(200, pageData);
                    });
            }

            if (pageData.page !== "payment") {
                link.send(200, pageData);
            }
        });
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

exports.paymentResult = function (link) {

    var session = link.session || {};
    var checkout = session.checkout || {};

    if (!checkout.address) { return link.send(400, "Address array is required."); }
    if (!checkout.review) { return link.send(400, "Accept terms and conditions."); }
    if (!checkout.payment) { return link.send(400, "You have to pay, first."); }

    var query = link.query;
    if (!query.s) { return link.send(400, "Missing s key."); }

    getSettings(link.params.dsSettings, function (err, settings) {

        if (err) {
            link.send(400, err);
            return;
        }

        getCart(link.params.dsCarts, link.session._sid, function (err, cart) {

            if (err) {
                link.send(400, err);
                return;
            }

            // cart is empty, redirect
            if (!cart || JSON.stringify(cart.items) === "{}") {
                var shopUrl = (settings.payments.urls || {}).shop || "/";
                link.res.headers["Location"] = shopUrl;
                link.send(302);
                return;
            }

            var redirectLink;
            var payments = settings.payments = settings.payments || {};
            payments.urls = payments.urls || {};

            if (!payments.passphrase) { return link.send(400, "Message to admin: passphrase is undefined."); }
            if (!payments.pspid)      { return link.send(400, "Message to admin: pspid is undefined."); }

            var s = query.s;
            delete query.s;

            switch (s) {
                /////////////////////////
                // Accept
                /////////////////////////
                case "a":
                    var shasign = query.SHASIGN;
                    if (!shasign) { return link.send(400, "Missing SHASIGN."); }

                    delete query.SHASIGN;

                    var signedHash = hash.sign(link.query, payments.passphrase);

                    if (!signedHash || shasign !== signedHash.SHASIGN) {
                        return link.send(400, "Invalid SHASIGN.");
                    }

                    redirectLink = payments.urls.accepturl;
                    break;
                /////////////////////////
                // Decline
                /////////////////////////
                case "d":
                    redirectLink = payments.urls.declineurl;
                    break;
                /////////////////////////
                // Cancel
                /////////////////////////
                case "c":
                    redirectLink = payments.urls.cancelurl;
                    break;
                /////////////////////////
                // Cancel
                /////////////////////////
                case "e":
                    redirectLink = payments.urls.exceptionurl;
                    break;
            }

            if (s === "a") {

                var paid = {
                    query: link.query
                };

                var checkout = link.session.checkout || {};
                checkout.paid = paid;

                link.session.set({ checkout: checkout }, function (err) {

                    if (err) {
                        link.send(400, err);
                        return;
                    }

                    link.res.headers["Location"] = redirectLink;
                    link.send(302);
                });
                return;
            }

            link.res.headers["Location"] = redirectLink;
            link.send(302);
        });
    });
};

exports.placeOrder = function(link) {

    // validate address
    if (!link.params || !link.params.orderFile) {
        link.send(400, "Missing orderFile from placeOrder operation parameters.");
        return;
    }

    if (!link.session.checkout) {
        link.send(400, "The checkout object is missing.");
        return;
    }

    if (!link.session.checkout.costs) {
        link.send(400, "The checkout.costs object is missing.");
        return;
    }

    var checkout = link.session.checkout;

    if (!checkout.address || !checkout.address.length) {
        link.send(400, "The address array is missing.");
        return;
    }

    if (!checkout.address || !checkout.payment.length) {
        link.send(400, "The payment array is missing.");
        return;
    }

    if (!checkout.paid && !checkout.paid.query) {
        link.send(400, "Oh, you have to accept paying, first!");
        return;
    }

    // insert the the cart info, totals and user information in orders collection
    getCart(link.params.dsCarts, link.session._sid, function (err, cart) {

        if (err) {
            link.send(400, err);
            return;
        }

        getCollection(link.params.dsOrders, function (err, ordersCollection) {

            if (err) {
                link.send(400, err);
                return;
            }

            var costs = link.session.checkout.costs;

            var userInfo = {
                invoice: {},
                delivery: {}
            };

            // build the user info object
            for (var i in checkout.address) {
                var current = checkout.address[i];
                var info = current.name.split(".");

                userInfo[info[0]][info[1]] = current.value;
            }

            var newDocument = {
                _id: link.session.payments.orderid,
                cart: cart,
                totals: costs,
                userInfo: userInfo
            };

            ordersCollection.insert(newDocument, function (err, doc) {

                if (err) {
                    link.send(400, err);
                    return;
                }

                var Order;

                try {
                    Order = require(M.app.getPath() + '/' + link.params.orderFile);
                } catch (e) {
                    link.send(400, e.message);
                    return;
                }

                Order.start(link.session, link.params, function (err, data) {

                    if (err) {
                        link.send(400, err);
                        return;
                    }

                    link.session.end(true, function() {
                        link.send(200, data);
                    });
                });
            });
        });
    });

};

function getCollection (dataSourceName, callback) {

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

            db.collection(ds.collection, callback);
        });
    });
}

function getSettings(dataSourceName, callback) {
    getCollection(dataSourceName, function (err, collection) {
        if (err) { return callback(err); }

        collection.findOne({}, callback);
    });
}

/*
 *  Get the cart
 *
 *  Returns in the callback:
 *   - error: first parameter or
 *   - the document that contains the items from the cart
 *
 * */
function getCart (dsCart, sid, callback) {

    getCollection(dsCart, function (err, collection ) {

        if (err) {
            callback(err);
            return;
        }

        collection.findOne({ _id: sid }, function(err, cart) {

            if (err) { return callback(err); }
            callback(null, cart);
        });
    });
}
