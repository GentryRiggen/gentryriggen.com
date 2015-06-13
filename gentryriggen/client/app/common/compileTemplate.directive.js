(function () {
    'use strict';
    angular
        .module('gr')
        .directive('compileTemplate', compileTemplate);

    compileTemplate.$inject = ['$compile', '$parse'];
    function compileTemplate($compile, $parse) {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                var parsed = $parse(attr.ngBindHtml);
                function getStringValue() { return (parsed(scope) || '').toString(); }

                scope.$watch(getStringValue, function () {
                    $compile(element, null, -9999)(scope); 
                });
            }
        }
    };
})();