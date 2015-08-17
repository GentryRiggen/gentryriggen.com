(function () {
    'use strict';
    angular
        .module('gr')
        .controller('BlogDetailCtrl', BlogDetailCtrl);

    BlogDetailCtrl.$inject = ['$stateParams', 'BlogService', 'AlertService'];
    function BlogDetailCtrl($stateParams, BlogService, AlertService) {
        var BlogDetailCtrl = this;

        function init() {
            if (angular.isDefined($stateParams.permalink)) {
                AlertService.showLoading("Fetching Blog Post...");
                BlogService.getByPermalink($stateParams.permalink)
                    .success(function (response) {
                        AlertService.hideLoading();
                        BlogDetailCtrl.blogPost = response;
                    }).error(function (err) {
                        AlertService.hideLoading();
                        console.error("Could not get the blog post", err);
                        // Show Alert
                    });
            } else {
                // Show Alert
                $state.go('blog');
            }
        };

        init();
    }
})();