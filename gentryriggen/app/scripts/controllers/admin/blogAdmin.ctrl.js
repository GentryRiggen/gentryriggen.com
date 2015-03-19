(function () {
    'use strict';
    angular
        .module('gr')
        .controller('blogAdminCtrl', ['$state', 'alert', 'blogService', blogAdminCtrl]);

    function blogAdminCtrl($state, alert, blogService) {
        var vm = this;
        var originalPosts = [];

        var searchFunction = function (val) {
            val = val.toLowerCase();
            var filtered = _.filter(originalPosts, function (item) {
                var lowerCaseTitle = item.title.toLowerCase();
                return lowerCaseTitle.indexOf(val) > -1
            });

            return filtered;
        };

        vm.tableConfig = {
            columnDefs: [
                { title: 'Title', field: 'title', search: searchFunction },
                { title: 'Created On', field: 'createdOn' },
                { title: 'Visible', field: 'visible' }
            ],
            data: []
        }

        var main = function () {
            alert.showMessage("info", "Fetching Blog Posts...", "", false);
            blogService.getAdminPaginated(1, 100, true)
                .success(function (data, status, headers, config) {
                    vm.tableConfig.data = data;
                    originalPosts = angular.copy(data);
                    alert.hideMessage();
                }).error(function (data, status, headers, config) {
                    if (!status === 401)
                        alert.showMessage("warning", "Uh oh!", "Could not retrieve blog posts!");
                });
        };

        vm.createNew = function () {
            $state.go('blogAdminEdit');
        };

        vm.rowClicked = function (item) {
            $state.go('blogAdminEdit', { 'id': item.id });
        };

        main();
    }
})();