(function () {
    'use strict';
    angular.module('gr').service('AlertService', AlertService);

    AlertService.$inject = ['$rootScope', '$timeout'];
    function AlertService($rootScope, $timeout) {
        var alertSvc = {};

        alertSvc.showLoading = function (message) {
            var msg = "Loading...";
            if (angular.isDefined(message)) {
                if (message === false) {
                    msg = "";
                } else {
                    msg = message;
                }
            }

            $rootScope.alert = {
                loading: {
                    message: msg,
                    show: true
                }
            }
        };

        alertSvc.hideLoading = function () {
            $timeout(function () {
                $rootScope.alert.loading.show = false;
            }, 500);
        }

        return alertSvc;
    }
})();