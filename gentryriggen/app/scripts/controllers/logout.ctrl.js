(function () {
    'use strict';
    angular
        .module('gr')
        .controller('logoutCtrl', ['$state', 'authToken', logoutCtrl]);

    function logoutCtrl($state, authToken) {
        authToken.removeToken();
        $state.go('blog');
    }
})();