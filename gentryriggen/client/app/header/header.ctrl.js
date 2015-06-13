(function () {
    'use strict';
    angular
        .module('gr')
        .controller('HeaderCtrl', HeaderCtrl);

    HeaderCtrl.$inject = ['$scope', 'UserService', '$state'];
    function HeaderCtrl($scope, UserService, $state) {
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
            $state.go(state);
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