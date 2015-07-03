(function () {
    'use strict';
    angular
        .module('gr')
        .controller('HeaderCtrl', HeaderCtrl);

    HeaderCtrl.$inject = ['$scope', 'UserService', '$state', '$mdSidenav'];
    function HeaderCtrl($scope, UserService, $state, $mdSidenav) {
        var HeaderCtrl = this;

        function checkUserAuth() {
            UserService.getCurrentUser().then(
                function (user) {
                    updatePermissions(user);
                }, function () {
                    updatePermissions();
                }
            );
        }
        
        function updatePermissions(data) {
            console.log("Updating permissions: ", data);
            if (angular.isDefined(data)) {
                HeaderCtrl.currentUser = angular.isDefined(data.user) ? data.user : data;
                console.log("ROLES: ", HeaderCtrl.currentUser, data.roles);
                 angular.forEach(HeaderCtrl.currentUser, function (property) {
                   console.log("Current User Property: ", property); 
                });
                angular.forEach(HeaderCtrl.currentUser.roles, function(role) {
                    console.log("role: ", role);
                    if (role == "Admin" || role == "Editor") HeaderCtrl.showModerator = true;
                });
            } else {
                HeaderCtrl.currentUser = false;
                HeaderCtrl.showModerator = false;
            }
        }

        HeaderCtrl.navigate = function (state) {
            $mdSidenav("sideNav").close();
            $state.go(state);
        };

        HeaderCtrl.toggleNav = function () {
            $mdSidenav("sideNav").toggle();
        };

        $scope.$on('gr.user.logout', function () {
            updatePermissions();
        });

        $scope.$on('gr.user.login', function (event, authResponse) {
            console.log("Login event! ", authResponse);
            updatePermissions(authResponse);
        });
        
        checkUserAuth();
    }
})();