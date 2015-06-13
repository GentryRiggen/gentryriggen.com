(function () {
    'use strict';
    angular
        .module('gr')
        .controller('LogoutCtrl', LogoutCtrl);

    LogoutCtrl.$inject = ['$state', 'UserService'];
    function LogoutCtrl($state, UserService) {
        UserService.logout();
        $state.go('blog');
    }
})();