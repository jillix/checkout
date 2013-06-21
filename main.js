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

    var hash = window.location.hash.substring(1);

    // confirmation

    if (hash === "confirmation") {
        self.link("placeOrder", function (err, data) {
            console.log(err, data);
        });
    }

    // payment
    if (hash === "payment") {
        self.link("getPageData", { data: { page: "review" } }, function (err, data) {
            if (err || !data) { window.location = "/order#review"; return; }

            for (var i in data) {
                $("[data-field='" + data[i].name + "']", self.dom).text(data[i].value);
            }
        });
    }

    // review hash
    if (hash === "review") {

        // load cart review table in its container
        for (var container in config.modules) {
            $("#" + container).html("");
            M("#" + container, config.modules[container]);
        }

        self.link("getPageData", { data: { page: "address" } }, function (err, data) {
            if (err || !data) { window.location = "/order#address"; return; }

            for (var i in data) {
                $("[data-field='" + data[i].name + "']", self.dom).text(data[i].value);
            }
        });

        self.link("getPageData", { data: { page: "review" } }, function (err, data) {
            if (err || !data) { return; }

            var checkbox = data[0];

            $("[name='" + checkbox.name + "']").prop("checked", (checkbox.value === "on" ? true : false));
        });
    }

    // address hash
    if (hash === "address") {
        $(".notification").remove();
        self.link("getPageData", { data: { page: "address" } }, function (err, data) {
            if (err) {

                try { err = JSON.parse(err);
                } catch (e) { return; }

                data = err.data;
                for (var i in data) {
                    $("[data-name='" + data[i].name + "']", self.dom).val(data[i].value);
                }

                var errors = err.errors;

                // add the new notifications
                if (errors) {
                    showErrors(errors);
                    return;
                }

            }
            if (!data) { return; }
            for (var i in data) {
                $("[data-name='" + data[i].name + "']", self.dom).val(data[i].value);
            }

        });
    }

    // show current page
    var page = $('.page.' + hash, self.dom);
    $('.page', self.dom).hide();
    page.show();

    // find form in the page
    var formInPage = page.find("form");

    // form found
    if (formInPage.length) {

        formInPage.off("submit");

        // submit data
        formInPage.on("submit", function () {

            var data = {
                page: hash,
                alt: $(".showAlt").prop("checked"),
                form: formInPage.serializeArray()
            };

            // save and validate form data
            self.link("savePageData", { data: data }, function (errors, data) {

                try { errors = JSON.parse(errors);
                } catch (e) { return; }

                // add the new notifications
                if (errors) {
                    showErrors(errors);
                    return;
                }

                // data was validated and no erros found
                if (hash === "address") {
                    window.location = "/order#review";
                    return;
                }

                if (hash === "review") {
                    window.location = "/order#payment";
                    return;
                }
            });

            return false;
        });
    }
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
