var Notification = {
    "new": function (message, type, classes) {
        var element = $("<p>");

        classes = classes || [];

        classes.push("alert");
        classes.push("alert-" + type);

        for (var i in classes) {
            element.addClass(classes[i]);
        }

        element.text(message);
        element.hide();
        return element;
    },
    "show": function (notificationElement) {
        notificationElement.fadeIn();
    },
    "hide": function (notificationElement, options) {
        var timeout = options.timeout || 0;

        setTimeout(function () {
            notificationElement.fadeOut(function () {
                if (options.remove) {
                    notificationElement.remove();
                }
            });
        }, timeout || 0);
    }
};
