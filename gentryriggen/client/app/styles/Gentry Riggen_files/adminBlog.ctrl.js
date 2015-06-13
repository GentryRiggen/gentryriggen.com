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
            AdminBlogCtrl.editMode = false;
            AlertService.showLoading("Fetching Posts...");
            BlogService.getAdminPaginated(1, 9999, true)
                .success(function (data) {
                    AdminBlogCtrl.blogPosts = data;
                    AlertService.hideLoading();
                }).error(function () {
                    AlertService.hideLoading();
                });
        };

        AdminBlogCtrl.createNew = function () {
            // TODO: Create new blog post and then go to edit page
        };

        AdminBlogCtrl.rowClicked = function (id) {
            AdminBlogCtrl.editMode = true;
            $state.go('admin.blog.edit', { 'id': id });
        };

        init();
    }
})();