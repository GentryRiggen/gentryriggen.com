(function () {
    'use strict';
    angular
        .module('gr')
        .factory('authInterceptor', ['$location', '$q', 'authToken', 'alert', authInterceptor]);

    function authInterceptor($location, $q, authToken, alert) {
        return {
            request: function (config) {
                var token = authToken.getToken();
                if (token)
                    config.headers.Authorization = 'Bearer ' + token;

                return config;
            },
            response: function (response) {
                return response;
            },
            responseError: function (rejection) {
                if (rejection.status === 401) {
                    alert.showMessage('danger', 'Big No No!', 'Hack me?!? Neva!!!', 5000);
                    $location.path('login');
                }
                return $q.reject(rejection);
            }
        }
    }
})();