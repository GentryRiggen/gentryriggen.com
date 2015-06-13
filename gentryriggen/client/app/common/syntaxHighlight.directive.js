(function () {
    'use strict';
    angular
        .module('gr')
        .directive('syntaxHighlight', syntaxHighlight);

    syntaxHighlight.$inject = [];
    function syntaxHighlight() {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                element.ready(function () {
                    Prism.highlightElement(element[0]);
                });
            }
        }
    };
})();