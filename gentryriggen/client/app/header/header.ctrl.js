(function () {
    'use strict';
    angular
        .module('gr')
        .controller('HeaderCtrl', HeaderCtrl);

    HeaderCtrl.$inject = ['$scope', 'UserService'];
    function HeaderCtrl($scope, UserService) {
        var HeaderCtrl = this;

        function checkUserAuth() {
            UserService.getCurrentUser().then(
                function (user) {
                    HeaderCtrl.currentUserName = user.firstName + " " + user.lastName;
                }, function () {
                    HeaderCtrl.isAuthenticated = true;
                }
            );
        }
        
        checkUserAuth();

        $scope.$on('gr.user.login', function (event, authResponse) {
            HeaderCtrl.currentUserName = authResponse.user.firstName + " " + authResponse.user.lastName;
        });
    }
})();