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
                    HeaderCtrl.currentUser = user;
                }, function () {
                    HeaderCtrl.currentUser = false;
                }
            );
        }

        HeaderCtrl.navigate = function (state) {
            $mdSidenav("sideNav").close();
            $state.go(state);
        };

        HeaderCtrl.toggleNav = function () {
            $mdSidenav("sideNav").toggle();
        };

        $scope.$on('gr.user.logout', function () {
            HeaderCtrl.currentUser = false;
        });

        $scope.$on('gr.user.login', function (event, authResponse) {
            HeaderCtrl.currentUser = authResponse.user;
        });
        
        checkUserAuth();
    }
})();