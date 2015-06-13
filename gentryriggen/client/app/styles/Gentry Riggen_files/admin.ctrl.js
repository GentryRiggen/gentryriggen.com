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

        AdminCtrl.selectedSection = 0;
        var count = 0;
        angular.forEach(AdminCtrl.sections, function (section) {
            if (section.name == $state.current.name) {
                AdminCtrl.selectedSection = count;
            }
            count++;
        });

        AdminCtrl.goTo = function (state) {
            $state.go(state);
        };
    }
})();