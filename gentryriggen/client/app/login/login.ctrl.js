(function () {
    'use strict';
    angular
        .module('gr')
        .controller('LoginCtrl', LoginCtrl);

    LoginCtrl.$inject = ['$http', '$state', 'UserService'];
    function LoginCtrl($http, $state, UserService) {
        var LoginCtrl = this;
        LoginCtrl.user = {
            username: "",
            password: ""
        };
        LoginCtrl.submit = function () {
            UserService.login(user.username, user.password).then(
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