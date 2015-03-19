(function () {
    'use strict';
    angular
        .module('gr')
        .controller('loginCtrl', loginCtrl);

    loginCtrl.$inject = ['$http', '$state', 'alert', 'authToken'];
    function loginCtrl($http, $state, alert, authToken) {
        var vm = this;
        vm.user = {
            username: "",
            password: ""
        };
        vm.submit = function () {
            $http.post("/api/auth", vm.user).
                success(function (data, status, headers, config) {
                    authToken.setToken(data);
                    alert.showMessage("success", "Success!", "You are now logged in " + authToken.getUsersName());
                    
                    $state.go('blog');
                }).
                error(function (data, status, headers, config) {
                    alert.showMessage("warning", "Oops!", "Wrong username/password");
                });
        }
    }
})();