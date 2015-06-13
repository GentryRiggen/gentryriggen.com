(function () {
    'use strict';
    angular
        .module('gr')
        .controller('AdminCtrl', AdminCtrl);

    AdminCtrl.$inject = ['$state'];
    function AdminCtrl($state) {
        var AdminCtrl = this;
        AdminCtrl.sections = [
            { title: "Blog Posts", state: "admin.blog" },
            { title: "Files", state: "admin.files" },
            { title: "My Account", state: "admin.account" }
        ];

        AdminCtrl.selectedSection = -1;
        var count = 0;
        angular.forEach(AdminCtrl.sections, function (section) {
            count++;
            if (section.name == $state.current.name) {
                AdminCtrl.selectedSection = count;
            }
        });
        if (AdminCtrl.selectedSection == -1) {
            AdminCtrl.selectedSection = 0;
            $state.go(AdminCtrl.sections[0].state);
        }

        AdminCtrl.goTo = function (state) {
            $state.go(state);
        };
    }
})();