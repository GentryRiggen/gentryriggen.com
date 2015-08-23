(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminBlogEditCtrl', AdminBlogEditController);

  AdminBlogEditController.$inject = ['$state', '$stateParams', 'AlertService', 'BlogService'];
  function AdminBlogEditController($state, $stateParams, AlertService, BlogService) {
    var AdminBlogEditCtrl = this;
    AdminBlogEditCtrl.blogPost = false;

    AdminBlogEditCtrl.close = function () {
      $state.go('admin.blog');
    };

    var init = function () {
      if (angular.isDefined($stateParams.id) && $stateParams.id !== '') {
        AlertService.showLoading("Fetching Blog Post...");
        BlogService.getById($stateParams.id)
          .success(function (data) {
            AlertService.hideLoading();
            AdminBlogEditCtrl.blogPost = data;
          }).error(function () {
            AlertService.hideLoading();
          });
      }
    };

    init();
  }
})();
