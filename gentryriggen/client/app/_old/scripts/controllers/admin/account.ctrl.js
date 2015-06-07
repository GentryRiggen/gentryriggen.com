(function () {
    'use strict';
    angular
        .module('gr')
        .controller('accountCtrl', accountCtrl);

    accountCtrl.$inject = ['$http', '$state', 'alert', 'authToken'];
    function accountCtrl($http, $state, alert, authToken) {
        var vm = this;
        vm.resetModel = {
            oldPassword: "",
            password: "",
            confirmPassword: ""
        };
        vm.reset = function () {
            $http.post("/api/auth/passwordreset/", vm.resetModel).
                success(function (data, status, headers, config) {
                    alert.showMessage("success", "Success!", "Your password has been updated");
                }).
                error(function (data, status, headers, config) {
                    alert.showMessage("warning", "Oops!", "Could not update your password: " + data);
                });
        }
    }
})();