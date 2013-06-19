var self;
var form;
var config;

module.exports = function init (conf) {

    self = this;
    config = conf;

    // hashchange handler
    $(window).on('hashchange', function () {
        var page = $('.page.' + window.location.hash.substring(1), self.dom);
        $('.page', self.dom).hide();
        page.show();
    })

};

