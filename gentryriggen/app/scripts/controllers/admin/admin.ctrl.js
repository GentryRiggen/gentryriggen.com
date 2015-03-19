(function () {
    'use strict';
    angular
        .module('gr')
        .controller('adminCtrl', adminCtrl);

    adminCtrl.$inject = ['$state'];
    function adminCtrl($state) {
        var vm = this;
        vm.sections = [
            { title: "Blog Posts", state: "blogAdmin" },
            { title: "Files", state: "fileAdmin" },
            { title: "My Account", state: "account" }
        ];

        vm.goTo = function (state) {
            $state.go(state);
        };
    }
})();