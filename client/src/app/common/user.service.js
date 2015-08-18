(function () {
    'use strict';
    angular.module('gr').service('UserService', UserService);

    UserService.$inject = ['API_URL', '$http', '$rootScope', '$q'];
    function UserService(API_URL, $http, $rootScope, $q) {
        var userSvc = {};

        userSvc.getCurrentUser = function () {
            var deferred = $q.defer();
            if (angular.isUndefined($rootScope.currentUser)) {
                $http.get(API_URL + "/user").then(
                    function (userResponse) {
                        $rootScope.currentUser = userResponse.data;
                        deferred.resolve($rootScope.currentUser);
                    },
                    function (resp) {
                        deferred.reject();
                    }
                );
            } else {
                deferred.resolve($rootScope.currentUser);
            }

            return deferred.promise;
        };

        userSvc.logout = function () {
            // Clear out in mem items
            $rootScope.$broadcast('gr.user.logout');
            $rootScope.userToken = undefined;
            $rootScope.currentUser = undefined;
        };

        userSvc.login = function (username, password) {
            var deferred = $q.defer();
            $http.post(API_URL + "/auth", { username: username, password: password }).then(
                function (authResponse) {
                    // Set token on scope and store it
                    $rootScope.userToken = authResponse.data.token;
                    // Set user info on scope
                    console.log(authResponse.data);
                    $rootScope.currentUser = authResponse.data;
                    $rootScope.$broadcast('gr.user.login', authResponse.data);
                    deferred.resolve(authResponse.data);
                },
                function (resp) {
                    deferred.reject("Invalid Login Attempt");
                });

            return deferred.promise;
        };

        userSvc.isAuthenticated = function () {
            return angular.isDefined($rootScope.currentUser);
        },

        userSvc.userHasAccess = function (requestedRole) {
            // Search current claims
            angular.forEach($rootScope.currentUser.roles, function (role) {
                if (role === requestedRole)
                    return true;
            });

            // If we get this far, their claim is invalid
            return false;
        };

        return userSvc;
    }
})();
