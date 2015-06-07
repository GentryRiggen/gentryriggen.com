(function () {
    'use strict';
    angular
        .module('gr')
        .controller('HeaderCtrl', HeaderCtrl);

    HeaderCtrl.$inject = ['AuthTokenService', 'UserService'];
    function HeaderCtrl(AuthTokenService, UserService) {
        var HeaderCtrl = this;

        HeaderCtrl.isAuthenticated = AuthTokenService.isAuthenticated;
        console.log("HeaderCtrl.isAuthenticated", HeaderCtrl.isAuthenticated);

        UserService.getCurrentUser().then(
            function (user) {
                HeaderCtrl.currentUserName = user.firstName + " " + user.lastName;
            }, function () {
                console.log("HeaderCtrl get current user failed");
                HeaderCtrl.currentUserName = false;;
            }
        );
    }
})();