(function () {
    'use strict';
    angular.module('gr').service('UserService', UserService);

    UserService.$inject = ['API_URL', '$http', '$rootScope', '$q'];
    function UserService(API_URL, $http, $rootScope, $q) {
        var userSvc = {};

        userSvc.getCurrentUser = function () {
            var deferred = $q.defer();
            if (angular.isUndefined($rootScope.currentUser)) {
                $http.get(API_URL + "/auth/user").then(
                    function (userResponse) {
                        $rootScope.currentUser = userResponse.data;
                        $rootScope.currentUser.roles = userResponse.data.roles;
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
            $rootScope.currentUser.claims = undefined;
        };

        userSvc.login = function (username, password) {
            var deferred = $q.defer();
            $http.post(API_URL + "/auth", { username: username, password: password }).then(
                function (authResponse) {
                    // Set token on scope and store it
                    $rootScope.userToken = authResponse.data.token;
                    console.log(authResponse);
                    $rootScope.$broadcast('gr.user.login', authResponse.data);

                    // Set user info on scope
                    $rootScope.currentUser = authResponse.data.user;
                    $rootScope.currentUser.roles = authResponse.data.roles;

                    deferred.resolve(authResponse.data);
                },
                function (resp) {
                    console.debug("Unsuccessful Login Attempt");
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