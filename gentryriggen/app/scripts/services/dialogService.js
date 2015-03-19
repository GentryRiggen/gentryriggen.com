(function () {
    'use strict';
    angular
        .module('gr')
        .service('dialog', dialog);

    dialog.$inject = ['$modal'];
    function dialog($modal) {
        return {
            confirm: function (title, message) {
                var modalOptions = {
                    templateUrl: "/app/templates/confirmDialog.html",
                    controller: function () {
                        this.title = title;
                        this.message = message;
                    },
                    controllerAs: "model"
                }

                return $modal.open(modalOptions).result;
            }
        }
    }
})();