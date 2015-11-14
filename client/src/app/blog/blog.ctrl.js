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
    BlogCtrl.pages = [];

    function init() {
      BlogCtrl.getNextPage(BlogCtrl.page);
    }

    BlogCtrl.getNextPage = function (page, alreadyOnThePage) {
      if (alreadyOnThePage === true) return;
      AlertService.showLoading("Fetching Posts...");
      BlogService.getPaginated(page, BlogCtrl.pageSize, true).then(
        function (resp) {
          console.log(resp.data.posts);
          BlogCtrl.items = resp.data.posts;
          BlogCtrl.page = resp.data.page;
          BlogCtrl.pageSize = resp.data.pageSize;
          BlogCtrl.pages = [];
          for (var i = 1; i <= resp.data.numPages; i++) {
            BlogCtrl.pages.push(i);
          }
          AlertService.hideLoading();
        }, function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get blog posts!');
          AlertService.hideLoading();
        });
    };

    init();
  }
})();
