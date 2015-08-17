(function () {
    'use strict';
    angular.module('gr').service('AuthTokenService', AuthTokenService);

    AuthTokenService.$inject = ['$window', '$rootScope'];
    function AuthTokenService($window, $rootScope) {
        var tokenKeyName = 'gentryriggen-Token';
        var storage = $window.localStorage;
        var authTokenSvc = {};

        authTokenSvc.getToken = function () {
            if (!$rootScope.userToken)
                $rootScope.userToken = storage.getItem(tokenKeyName);

            return $rootScope.userToken;
        };

        authTokenSvc.setToken = function (token) {
            storage.setItem(tokenKeyName, token);
        };

        authTokenSvc.hasToken = function () {
            return !!authTokenSvc.getToken();
        };

        $rootScope.$on('gr.user.logout', function () {
            storage.removeItem(tokenKeyName);
        });

        $rootScope.$on('gr.user.login', function (event, user) {
            authTokenSvc.setToken(user.token);
        });

        return authTokenSvc;
    }
})();