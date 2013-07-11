var self;
var form;
var config;

module.exports = function init (conf) {

    self = this;
    config = conf;

    // Load the right content for hash
    if (window.location.hash) {
        showPageFromHash();
    }

    // hashchange handler
    $(window).on('hashchange', function () {
        showPageFromHash();
    });

    // click on the checkbox
    $('.showAlt', self.dom).on('change', function() {
        var show = $(this).prop('checked');
        if (show) {
            $('.alt', self.dom).show();
        } else {
            $('.alt', self.dom).hide();
        }
    });
};

function showPageFromHash () {

    $(".notification").remove();
    var hash = window.location.hash.substring(1);

    // the cart is outsourced to the bind-cart module
    if (hash === 'cart') {
        return;
    }

    self.link('getPageData', { data: { page: hash } }, function (err, data) {

        if (err) {
            alert(err);
            return;
        }

        if (hash !== data.page) {
            window.location.hash = data.page;
            return;
        }

        self.emit(data.page);

        // show current page
        var page = $('.page.' + data.page, self.dom);
        $('.page', self.dom).hide();
        page.show();

        // fill in the form data
        for (var i in data.data) {
            var elem = $('[data-name="' + data.data[i].name + '"]', page);
            switch (elem.prop('tagName')) {
                case 'INPUT':
                    if (elem.attr('type') === 'checkbox') {
                        elem.prop('checked', !!data.data[i].value);
                    }
                case 'SELECT':
                case 'TEXTAREA':
                    elem.val(data.data[i].value);
                    break;
                default:
                    elem.text(data.data[i].value);
                    break;
            }
        }

        // load cart review table in its container
        if (data.page === 'review') {

            for (var container in config.modules) {
                M("#" + container, config.modules[container]);
            }

            page.find('[name="accept"]').prop('checked', false);
        } else if (data.page === 'payment') {
            var form = page.find('form');
            for (var i in data.data) {
                var input = $('<input>')
                    .attr('type', 'hidden')
                    .attr('name', i)
                    .val(data.data[i]);
                input.appendTo(form);
            }
            form.submit();
        } else if (data.page === 'confirmation') {
            self.link('placeOrder', function (err, data) {
                console.log(err, data);
            });
        }

        // show the form errors if any
        if (data.errors && data.errors.length) {
            showErrors(data.errors);
        }

        // find form in the page
        var formInPage = page.find('form');
        formInPage.off('submit');

        // submit data
        formInPage.on('submit', function (e) {

            e.preventDefault();

            var data = {
                page: hash,
                form: formInPage.serializeArray()
            };

            // save and validate form data
            self.link("savePageData", { data: data }, function (err, data) {

                if (err) {
                    alert(err);
                    return;
                }

                if (hash !== data.page) {
                    window.location.hash = data.page;
                    return;
                }

                if (formInPage.attr("action") {
                    formInPage.off("submit");
                    formInPage.submit();
                }

                // show the form errors if any
                if (data.errors && data.errors.length) {
                    // show current page
                    var page = $('.page.' + data.page, self.dom);
                    $('.page', self.dom).hide();
                    page.show();

                    // fill in the form data
                    for (var i in data.data) {
                        var elem = $('[data-name="' + data.data[i].name + '"]', page);
                        elem.val(data.data[i].value);
                    }

                    showErrors(data.errors);
                } else {
                    var nextHash = {
                        address: 'review',
                        review: 'payment',
                        payment: 'confirmation'
                    };
                    // data was validated and no errors found
                    window.location.hash = nextHash[data.page];
                }
            });

            return false;
        });
    });
}

function showErrors (errors) {

    // remove all notifications
    $(".notification").remove();

    for (var i in errors) {
        var notification = Notification.new(errors[i].err, "error", ["notification"]);
        var input;

        input = $("[name='" + errors[i].name + "']", self.dom);

        if (input.attr("type") === "checkbox") {
            input = input.parent();
        }

        input.after(notification);
    }

    $(".notification").fadeIn();
}
