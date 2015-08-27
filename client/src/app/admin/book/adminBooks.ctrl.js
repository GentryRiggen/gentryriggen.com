(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminBooksCtrl', AdminBooksController);

  AdminBooksController.$inject = ['BookService', '$state', 'AlertService'];
  function AdminBooksController(BookService, $state, AlertService) {
    var AdminBooksCtrl = this;
    AdminBooksCtrl.books = [];
    AdminBooksCtrl.blogPosts = [];
    AdminBooksCtrl.page = 1;
    AdminBooksCtrl.pageSize = 50;
    AdminBooksCtrl.pages = [];

    function init() {
      AdminBooksCtrl.getNextPage(AdminBooksCtrl.page);
    }

    AdminBooksCtrl.getNextPage = function (page, alreadyOnThePage) {
      if (alreadyOnThePage === true) return;
      AlertService.showLoading("Fetching Books...");
      BookService.getPaginated(page, AdminBooksCtrl.pageSize, true)
        .then(function (resp) {
          angular.forEach(resp.data.books, function (book) {
            switch (book.rating) {
              case 4:
                book.rowSpan = 2;
                book.colSpan = 2;
                break;
              case 5:
                book.rowSpan = 3;
                book.colSpan = 3;
                break;
              default :
                book.rowSpan = 1;
                book.colSpan = 1;
                break;
            }
          });
          AdminBooksCtrl.books = resp.data.books;
          console.log(resp.data.books);
          AdminBooksCtrl.page = resp.data.page;
          AdminBooksCtrl.pageSize = resp.data.pageSize;
          AdminBooksCtrl.pages = [];
          for (var i = 1; i <= resp.data.numPages; i++) {
            AdminBooksCtrl.pages.push(i);
          }
          AlertService.hideLoading();
        },function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get books!');
          AlertService.hideLoading();
        });
    };

    AdminBooksCtrl.rowClicked = function (id) {
      $state.go('admin.book', {'id': id});
    };

    AdminBooksCtrl.createNew = function () {
      AlertService.showLoading("Creating New Book...");
      BookService.createNew().then(
        function (resp) {
          $state.go('admin.book', {'id': resp.data.id});
          AlertService.hideLoading();
        }, function () {
          AlertService.showAlert('error', 'Failure', 'Failed to create new book');
          AlertService.hideLoading();
        });
    };

    init();
  }
})();
