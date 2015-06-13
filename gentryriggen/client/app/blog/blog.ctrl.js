(function () {
    'use strict';
    angular
        .module('gr')
        .controller('BlogCtrl', BlogCtrl);

    BlogCtrl.$inject = ['BlogService', 'AlertService'];
    function BlogCtrl(BlogService, AlertService) {
        var BlogCtrl = this;
        BlogCtrl.blogPosts = [];
        BlogCtrl.page = 1;
        BlogCtrl.pageSize = 5;
        BlogCtrl.pages = [];

        var init = function () {
            BlogCtrl.getNextPage(BlogCtrl.page);
        };

        BlogCtrl.getNextPage = function (page, alreadyOnThePage) {
            if (alreadyOnThePage === true) return;
            AlertService.showLoading("Fetching Posts...");
            BlogService.getPaginated(page, BlogCtrl.pageSize, true)
                .success(function (data) {
                    BlogCtrl.blogPosts = data.posts;
                    BlogCtrl.page = data.page;
                    BlogCtrl.pageSize = data.pageSize;
                    BlogCtrl.pages = [];
                    for (var i = 1; i <= data.numPages; i++) {
                        BlogCtrl.pages.push(i);
                    }
                    AlertService.hideLoading();
                }).error(function () {
                    AlertService.showAlert('error', 'Failure', 'Failed to get blog posts!');
                    AlertService.hideLoading();
                });
        };

        init();
    }
})();