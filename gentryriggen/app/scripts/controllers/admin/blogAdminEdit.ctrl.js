(function () {
    'use strict';
    angular
        .module('gr')
        .controller('blogAdminEditCtrl', blogAdminEditCtrl);

    blogAdminEditCtrl.$inject = ['$state', '$stateParams', 'alert', 'blogService', 'blogPost'];
    function blogAdminEditCtrl($state, $stateParams, alert, blogService, blogPost) {
        var vm = this;
        vm.blogPost = blogPost;

        var main = function () {
            if (typeof $stateParams.id != 'undefined' && $stateParams.id != '') {
                alert.showMessage('info', 'Getting Blog Post', '', false);
                blogService.getById($stateParams.id)
                    .success(function (data, status, headers, config) {
                        alert.hideMessage();
                        vm.blogPost = data;
                    }).error(function (data, status, headers, config) {
                        alert.showMessage("danger", "Uh oh!", "Could not get that blog post...");
                    });
            }
        };

        vm.goBack = function () {
            $state.go('blogAdmin');
        };

        main();
    }
})();