(function () {
    'use strict';
    angular
        .module('gr')
        .controller('projectAdminCtrl', ['$state', 'alert', projectAdminCtrl]);

    function projectAdminCtrl($state, alert) {
        var vm = this;
        var originalProjects = [];

        var searchFunction = function (val) {
            val = val.toLowerCase();
            var filtered = _.filter(originalProjects, function (item) {
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
            alert.showMessage("info", "Fetching Projects...", "", false);
        };

        vm.createNew = function () {
            $state.go('projectAdminEdit');
        };

        vm.rowClicked = function (item) {
            $state.go('projectAdminEdit', { 'id': item.id });
        };

        main();
    }
})();