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

        AdminCtrl.selectedState = false;
        angular.forEach(AdminCtrl.sections, function (section) {
            if (!AdminCtrl.selectedState && section.state == $state.current.name) AdminCtrl.selectedState = section;
        });

        AdminCtrl.goTo = function (state) {
            $state.go(state);
        };
    }
})();