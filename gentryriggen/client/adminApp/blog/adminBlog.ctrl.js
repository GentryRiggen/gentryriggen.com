(function () {
    'use strict';
    angular
        .module('gr')
        .controller('AdminBlogCtrl', AdminBlogCtrl);

    AdminBlogCtrl.$inject = ['$state', 'AlertService', 'BlogService'];
    function AdminBlogCtrl($state, AlertService, BlogService) {
        var AdminBlogCtrl = this;
        AdminBlogCtrl.blogPosts = [];

        var init = function () {
            AlertService.showLoading("Fetching Posts...");
            BlogService.getAdminPaginated(1, 100, true)
                .success(function (data) {
                    AdminBlogCtrl.blogPosts = data;
                    AlertService.hideLoading();
                }).error(function () {
                    AlertService.hideLoading();
                });
        };

        AdminBlogCtrl.createNew = function () {
            $state.go('admin.blog.edit');
        };

        AdminBlogCtrl.rowClicked = function (id) {
            $state.go('admin.blog.edit', { 'id': id });
        };

        init();
    }
})();