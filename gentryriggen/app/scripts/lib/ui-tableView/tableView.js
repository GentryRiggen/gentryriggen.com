(function () {
    'use strict';
    angular.module('ui.tableView', ['ngSanitize'])
        .directive('tableView', ['$sce', '$compile', tableViewDirective]);

    function tableViewDirective($sce, $compile) {
        return {
            restrict: 'E',
            scope: {
                config: '=',
                tableClass: '@',
                color: '@',
                rowClick: '&'
            },
            templateUrl: 'app/templates/tableView.html',
            controller: function ($scope) {
                $scope.rowClicked = function (data) {
                    $scope.rowClick({item: data});
                };

                $scope.searchByCol = function (col, val) {
                    $scope.config.data = col.search(val);
                };
            }
        }
    }
})();