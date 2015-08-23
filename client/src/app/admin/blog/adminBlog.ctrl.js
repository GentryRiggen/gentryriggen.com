(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminBlogCtrl', AdminBlogController);

  AdminBlogController.$inject = ['$state', 'AlertService', 'BlogService'];
  function AdminBlogController($state, AlertService, BlogService) {
    var AdminBlogCtrl = this;
    AdminBlogCtrl.blogPosts = [];
    AdminBlogCtrl.page = 1;
    AdminBlogCtrl.pageSize = 25;
    AdminBlogCtrl.numPages = 0;
    AdminBlogCtrl.pages = [];

    var init = function () {
      AdminBlogCtrl.getNextPage(AdminBlogCtrl.page);
    };

    AdminBlogCtrl.getNextPage = function (page, alreadyOnThePage) {
      if (alreadyOnThePage === true) return;
      AlertService.showLoading("Fetching Posts...");
      BlogService.getAdminPaginated(page, AdminBlogCtrl.pageSize, true)
        .success(function (data) {
          AdminBlogCtrl.blogPosts = data.posts;
          AdminBlogCtrl.numPages = data.numPages;
          AdminBlogCtrl.page = data.page;
          AdminBlogCtrl.pageSize = data.pageSize;
          AdminBlogCtrl.pages = [];
          for (var i = 1; i <= AdminBlogCtrl.numPages; i++) {
            AdminBlogCtrl.pages.push(i);
          }
          AlertService.hideLoading();
        }).error(function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get blog posts!');
          AlertService.hideLoading();
        });
    };

    AdminBlogCtrl.search = function (q) {
      BlogService.search(q)
        .success(function (data) {
          AdminBlogCtrl.blogPosts = data;
        })
        .error(function () {
          AlertService.showAlert('warning', 'Not Found', 'Could not find any posts');
        });
    };

    AdminBlogCtrl.createNew = function () {
      BlogService.createNew().success(
        function (newPost) {
          AdminBlogCtrl.rowClicked(newPost.id);
        }).error(function () {
          AlertService.showAlert('error', 'Failed', 'Could not create new blog post!');
        });
    };

    AdminBlogCtrl.rowClicked = function (id) {
      $state.go('admin.blogEdit', {'id': id});
    };

    init();
  }
})();
