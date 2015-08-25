(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminBookCtrl', AdminBookController);

  AdminBookController.$inject = ['BookService', '$stateParams', 'AlertService', 'AuthTokenService', 'FileUploader',
    '$sce', '$mdDialog', '$state', '$window', 'AuthorService'];
  function AdminBookController(BookService, $stateParams, AlertService, AuthTokenService, FileUploader, $sce, $mdDialog,
                               $state, $window, AuthorService) {
    var AdminBookCtrl = this;
    AdminBookCtrl.book = false;
    AdminBookCtrl.newAuthor = {
      firstName: '',
      lastName: ''
    };

    function init() {
      AlertService.showLoading('Fetching Book Details...');
      BookService.getById($stateParams.id).then(
        function (resp) {
          AdminBookCtrl.book = resp.data;
          AdminBookCtrl.book.publishDate = new Date(AdminBookCtrl.book.publishDate);

          // Get Authors
          AuthorService.getAll().then(
            function(resp) {
              AdminBookCtrl.authors = resp.data;
              setSelectedAuthor(AdminBookCtrl.book.authorId);
            });

          // Get Series
          AlertService.hideLoading();
        }, function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get book details!');
          AlertService.hideLoading();
        });
    }

    function setSelectedAuthor(authorId) {
      var authors = angular.copy(AdminBookCtrl.authors);
      angular.forEach(authors, function(author) {
        author.selected = author.id == authorId;
      });

      AdminBookCtrl.authors = authors;
    }

    AdminBookCtrl.bookUpdated = function () {
      var tempDate = AdminBookCtrl.book.publishDate,
        date = new Date(AdminBookCtrl.book.publishDate);
      AdminBookCtrl.book.publishDate = toMysqlFormat(date);

      BookService.updateBook($stateParams.id, AdminBookCtrl.book).then(
        function () {
          AdminBookCtrl.book.publishDate = tempDate;
          AlertService.showAlert('success', 'Success', 'Updated book details');
        }, function () {
          AlertService.showAlert('error', 'Failed', 'Failed to update book details');
        });
    };

    // UPLOADS
    function onAfterAddingFile() {
      AdminBookCtrl.loading = true;
      AlertService.showAlert('success', 'Success', 'Add file to queue');
    }

    function onErrorItem() {
      AdminBookCtrl.loading = false;
      AlertService.showAlert('error', 'Failed', 'Failed to upload file');
    }

    function onSuccessItem() {
      AdminBookCtrl.loading = false;
      AlertService.showAlert('success', 'Success!', 'File has been uploaded');
      init();
    }

    // ARTWORK UPLOAD
    AdminBookCtrl.artworkUploader = new FileUploader({
      url: BookService.getArtworkUploadUrl($stateParams.id),
      autoUpload: true,
      headers: {
        Authorization: 'bearer ' + AuthTokenService.getToken()
      }
    });
    AdminBookCtrl.artworkUploader.onAfterAddingFile = onAfterAddingFile;
    AdminBookCtrl.artworkUploader.onErrorItem = onErrorItem;
    AdminBookCtrl.artworkUploader.onSuccessItem = onSuccessItem;

    // FILE UPLOAD
    AdminBookCtrl.fileUploader = new FileUploader({
      url: BookService.getFileUploadUrl($stateParams.id),
      autoUpload: true,
      headers: {
        Authorization: 'bearer ' + AuthTokenService.getToken()
      }
    });
    AdminBookCtrl.fileUploader.onAfterAddingFile = onAfterAddingFile;
    AdminBookCtrl.fileUploader.onErrorItem = onErrorItem;
    AdminBookCtrl.fileUploader.onSuccessItem = onSuccessItem;

    AdminBookCtrl.delete = function (event) {
      var confirm = $mdDialog.confirm()
        .parent(angular.element($window.document.body))
        .title('Are you sure?')
        .content('Are you sure you want to delete this book?')
        .ariaLabel('Delete Book')
        .ok('OK')
        .cancel('Cancel')
        .targetEvent(event);
      $mdDialog.show(confirm).then(function () {
        BookService.deleteById(AdminBookCtrl.book.id).then(
          function () {
            AlertService.showAlert('success', 'Success!', 'Book has been deleted');
            $state.go('admin.books');
          }, function () {
            AlertService.showAlert('error', 'Failed', 'Failed to delete Blog Post');
          });
      });
    };

    AdminBookCtrl.authorSelected = function(author) {
      author.selected = !author.selected;
      AdminBookCtrl.book.authorId = author.id;
      AdminBookCtrl.bookUpdated();
      setSelectedAuthor(AdminBookCtrl.book.authorId);
    };

    AdminBookCtrl.addAuthor = function() {
      AuthorService.createNew().then(
        function(resp) {
          resp.data.firstName = AdminBookCtrl.newAuthor.firstName;
          resp.data.lastName = AdminBookCtrl.newAuthor.lastName;
          AuthorService.updateAuthor(resp.data.id, resp.data).then(
            function() {
              AdminBookCtrl.authors.unshift(AdminBookCtrl.newAuthor);
              AdminBookCtrl.authorSelected(AdminBookCtrl.newAuthor);
            });
        });
    };

    AdminBookCtrl.updateAuthor = function(author) {
      AuthorService.updateAuthor(author.id, author).then(
        function() {
          AlertService.showAlert('success', 'Success', 'Author Updated');
        }, function() {
          AlertService.showAlert('error', 'Failed', 'Failed to update author');
        });
    };

    // MISC
    function twoDigits(d) {
      if (0 <= d && d < 10) return "0" + d.toString();
      if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
      return d.toString();
    }

    function toMysqlFormat(date) {
      return date.getUTCFullYear() + "-" + twoDigits(1 + date.getUTCMonth()) + "-" + twoDigits(date.getUTCDate());
    }

    init();
  }
})();
