(function () {
    'use strict';
    angular
        .module('gr')
        .directive('formInput', ['$compile', formInput]);

    function formInput($compile) {
        return {
            restrict: 'A',
            require: '^form',
            link: link($compile)
        };
    }

    function watcherFor (form, name) {
        return function () {
            if (name && form[name]) {
                return form[name].$invalid;
            }
        };
    };

    function updaterFor(element) {
        return function (hasError) {
            if (hasError) {
                element.removeClass('has-success').addClass('has-error');
            } else {
                element.removeClass('has-error').addClass('has-success');
            }
        };
    };


    function link ($compile) {
        return function (scope, element, attributes, form) {
            var name = setupDom(element[0]);
            addMessages(form, element, name, $compile, scope);
            scope.$watch(watcherFor(form, name), updaterFor(element));
        };
    };

    function setupDom(element) {
        var input = element.querySelector('input, textarea, select');
        var type = input.getAttribute('type');
        var name = input.getAttribute('name');
        if (type !== 'checkbox' && type !== 'radio') {
            input.classList.add('form-control');
        }

        var label = element.querySelector('label');
        label.classList.add('control-label');

        element.classList.add('form-group');

        return name;
    };

    function addMessages(form, element, name, $compile, scope) {
        var messages = "<div class='help-block' ng-messages='" +
            form.$name + "." + name + ".$error" + 
            "' ng-messages-include='app/templates/formValidationMessages.html'></div>";
        element.append($compile(messages)(scope));
    };
})();