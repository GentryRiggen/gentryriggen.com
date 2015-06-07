(function () {
    'use strict';
    angular
        .module('gr')
        .controller('LogoutCtrl', logoutCtrl);

    LogoutCtrl.$inject = ['$state', 'UserService'];
    function logoutCtrl($state, UserService) {
        UserService.logout();
        $state.go('blog');
    }
})();