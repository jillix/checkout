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
    })

};

function showPageFromHash () {
    var page = $('.page.' + window.location.hash.substring(1), self.dom);
    $('.page', self.dom).hide();
    page.show();
}
