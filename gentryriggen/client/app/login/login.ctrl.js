(function () {
    'use strict';
    angular
        .module('gr')
        .controller('LoginCtrl', LoginCtrl);

    LoginCtrl.$inject = ['$http', '$state', 'UserService'];
    function LoginCtrl($http, $state, UserService) {
        var LoginCtrl = this;
        LoginCtrl.username = "";
        LoginCtrl.password = "";
        LoginCtrl.submit = function () {
            UserService.login(LoginCtrl.username, LoginCtrl.password).then(
                function () {
                    $state.go('blog');
                },
                function () {
                    // Show Alert
                }
            );
        }
    }
})();