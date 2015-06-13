(function () {
    'use strict';
    angular
        .module('gr')
        .controller('BlogCtrl', BlogCtrl);

    BlogCtrl.$inject = ['BlogService', 'AlertService'];
    function BlogCtrl(BlogService, AlertService) {
        var BlogCtrl = this;
        BlogCtrl.blogPosts = [];

        function init() {
            fetchBlogPosts();
        }

        function fetchBlogPosts() {
            AlertService.showLoading("Fetching Posts...");
            BlogService.getPaginated()
                .success(function (response) {
                    AlertService.hideLoading();
                    BlogCtrl.blogPosts = response;
                }).error(function (err) {
                    AlertService.hideLoading();
                    // Show Error Toast
                });
        }

        init();
    }
})();