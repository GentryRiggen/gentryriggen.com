(function () {
    'use strict';
    angular
        .module('gr')
        .controller('LoginCtrl', LoginCtrl);

    LoginCtrl.$inject = ['$http', '$state', 'UserService', 'AlertService'];
    function LoginCtrl($http, $state, UserService, AlertService) {
        var LoginCtrl = this;
        LoginCtrl.username = "";
        LoginCtrl.password = "";
        UserService.getCurrentUser().then(function () {
            AlertService.showAlert('success', 'Already Logged In!', '');
            $state.go('admin');
        });
        LoginCtrl.submit = function () {
            UserService.login(LoginCtrl.username, LoginCtrl.password).then(
                function () {
                    console.log("Successful login attempt");
                    AlertService.showAlert('success', 'Logged In!', '');
                    $state.go('blog');
                },
                function () {
                    AlertService.showAlert('warning', 'Uh Oh!', 'Could not log you in!');
                }
            );
        }
    }
})();