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

        authTokenSvc.hasToken = function () {
            return !!authTokenSvc.getToken();
        };

        $rootScope.$on('gr.user.logout', function () {
            storage.removeItem(tokenKeyName);
        });

        return authTokenSvc;
    }
})();