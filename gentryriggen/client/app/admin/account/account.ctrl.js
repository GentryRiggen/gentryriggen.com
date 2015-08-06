(function () {
    'use strict';
    angular
        .module('gr')
        .controller('AccountCtrl', AccountCtrl);

    AccountCtrl.$inject = ['$http', '$state', 'AlertService'];
    function AccountCtrl($http, $state, AlertService) {
        var AccountCtrl = this;
        AccountCtrl.resetModel = {
            oldPassword: "",
            password: "",
            confirmPassword: ""
        };

        AccountCtrl.reset = function () {
            $http.post("/api/auth/passwordreset/", AccountCtrl.resetModel).
                success(function (data) {
                    AlertService.showAlert("success", "Success!", "Your password has been updated");
                }).
                error(function () {
                    AlertService.showAlert("error", "Oops!", "Could not update your password: " + data);
                });
        }
    }
})();