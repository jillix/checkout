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

    $('.showAlt', self.dom).on('change', function() {
        var show = $(this).prop('checked');
        if (show) {
            $('.alt', self.dom).show();
        } else {
            $('.alt', self.dom).hide();
        }
    });


    // load cart review table in its container
    for (var container in config.modules) {
        M("#" + container, config.modules[container]);
    }
};

function showPageFromHash () {
    var hash = window.location.hash.substring(1);
    var page = $('.page.' + hash, self.dom);
    $('.page', self.dom).hide();
    page.show();

    var formInPage = page.find("form");

    if (formInPage.length) {

        formInPage.off("submit");

        // submit data
        formInPage.on("submit", function () {

            var data = {
                page: hash,
                alt: $(".showAlt").prop("checked"),
                form: formInPage.serializeArray()
            };

            self.link("savePageData", { data: data }, function (errors, data) {

                try { errors = JSON.parse(errors);
                } catch (e) { return; }

                $(".notification").remove();

                if (errors) {
                    for (var i in errors) {
                        var notification = Notification.new(errors[i].err, "error", ["notification"]);
                        var input;

                        input = $("[name='" + errors[i].name + "']", self.dom);

                        input.after(notification);
                    }

                    $(".notification").fadeIn();

                    return;
                }

                window.location = "/order#review";
            });

            return false;
        });
    }
}
