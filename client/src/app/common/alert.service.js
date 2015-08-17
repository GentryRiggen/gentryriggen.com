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

        toastr.options = {
            "closeButton": false,
            "debug": false,
            "newestOnTop": true,
            "progressBar": false,
            "positionClass": "toast-top-right",
            "preventDuplicates": false,
            "onclick": null,
            "showDuration": "300",
            "hideDuration": "1000",
            "timeOut": "5000",
            "extendedTimeOut": "1000",
            "showEasing": "swing",
            "hideEasing": "linear",
            "showMethod": "fadeIn",
            "hideMethod": "fadeOut"
        }

        alertSvc.showAlert = function (type, title, message) {
            switch (type) {
                case 'success':
                    toastr.success(title, message);
                    break;
                case 'info':
                    toastr.info(title, message);
                    break;
                case 'warning':
                    toastr.warning(title, message);
                    break;
                case 'error':
                    toastr.error(title, message);
                    break;
            }
        };

        return alertSvc;
    }
})();