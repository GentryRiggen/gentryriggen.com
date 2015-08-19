(function () {
  'use strict';
  angular
    .module('gr')
    .controller('BlogDetailCtrl', BlogDetailController);

  BlogDetailController.$inject = ['$stateParams', 'BlogService', 'AlertService', '$state'];
  function BlogDetailController($stateParams, BlogService, AlertService, $state) {
    var BlogDetailCtrl = this;

    function init() {
      if (angular.isDefined($stateParams.permalink)) {
        AlertService.showLoading("Fetching Blog Post...");
        BlogService.getByPermalink($stateParams.permalink)
          .success(function (response) {
            AlertService.hideLoading();
            BlogDetailCtrl.blogPost = response;
          }).error(function () {
            AlertService.hideLoading();
            // Show Alert
          });
      } else {
        // Show Alert
        $state.go('blog');
      }
    }

    init();
  }
})();
