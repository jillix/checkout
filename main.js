M.wrap('github/jillix/checkout/dev/main.js', function (require, module, exports) {
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
};

function showPageFromHash () {
    var page = $('.page.' + window.location.hash.substring(1), self.dom);
    $('.page', self.dom).hide();
    page.show();
}

return module; });
