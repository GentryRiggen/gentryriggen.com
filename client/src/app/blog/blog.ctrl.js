(function () {
  'use strict';
  angular
    .module('gr')
    .controller('BlogCtrl', BlogController);

  BlogController.$inject = ['BlogService', 'AlertService'];
  function BlogController(BlogService, AlertService) {
    var BlogCtrl = this;
    BlogCtrl.items = [];
    BlogCtrl.page = 1;
    BlogCtrl.pageSize = 5;
    BlogCtrl.busy = false;
    BlogCtrl.numPages = 1;

    function init() {
      BlogCtrl.getNextPage(BlogCtrl.page);
    }

    BlogCtrl.getNextPage = function (page) {
      if (BlogCtrl.busy || page > BlogCtrl.numPages) return;
      else BlogCtrl.busy = true;

      AlertService.showLoading("Fetching Posts...");
      BlogService.getPaginated(page, BlogCtrl.pageSize, true).then(
        function (resp) {
          angular.forEach(resp.data.posts, function(item) {
            BlogCtrl.items.push(item);
          });
          BlogCtrl.page = resp.data.page + 1;
          BlogCtrl.pageSize = resp.data.pageSize;
          BlogCtrl.numPages = resp.data.numPages;
          BlogCtrl.busy = false;
          AlertService.hideLoading();
        }, function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get blog posts!');
          AlertService.hideLoading();
        });
    };

    init();
  }
})();
