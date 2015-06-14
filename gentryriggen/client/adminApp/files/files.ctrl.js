(function () {
    'use strict';
    angular
        .module('gr')
        .controller('FilesCtrl', FilesCtrl);

    FilesCtrl.$inject = ['$state', 'AlertService', 'FilesService', '$mdDialog'];
    function FilesCtrl($state, AlertService, FilesService, $mdDialog) {
        var FilesCtrl = this;
        FilesCtrl.files = [];
        FilesCtrl.page = 1;
        FilesCtrl.pageSize = 25;
        FilesCtrl.numPages = 0;
        FilesCtrl.pages = [];

        var init = function () {
            FilesCtrl.getNextPage(FilesCtrl.page);
        };

        FilesCtrl.getNextPage = function (page, alreadyOnThePage) {
            if (alreadyOnThePage === true) return;
            AlertService.showLoading("Fetching Files...");
            FilesService.getFilesPaginate(page, FilesCtrl.pageSize)
                .success(function (data) {
                    FilesCtrl.files = data.files;
                    FilesCtrl.numPages = data.numPages;
                    FilesCtrl.page = data.page;
                    FilesCtrl.pageSize = data.pageSize;
                    FilesCtrl.pages = [];
                    for (var i = 1; i <= FilesCtrl.numPages; i++) {
                        FilesCtrl.pages.push(i);
                    }
                    AlertService.hideLoading();
                }).error(function () {
                    AlertService.showAlert('error', 'Failure', 'Failed to get files!');
                    AlertService.hideLoading();
                });
        };

        FilesCtrl.refresh = function (callback) {
            FilesCtrl.getNextPage(FilesCtrl.page);
        };

        FilesCtrl.search = function (q) {
            FilesService.getFilesPaginate(FilesCtrl.page, FilesCtrl.pageSize, q)
                .success(function (data) {
                    console.log("Search Results", data);
                    FilesCtrl.files = data.files;
                }).error(function () {
                    AlertService.showAlert('error', 'Uh oh!', 'Failed to search files');
                });
        };

        FilesCtrl.delete = function (path) {
            var confirm = $mdDialog.confirm()
                      .parent(angular.element(document.body))
                      .title('Are you sure?')
                      .content('Are you sure you want to delete this file?')
                      .ariaLabel('Delete File')
                      .ok('OK')
                      .cancel('Cancel')
                      .targetEvent(event);
            $mdDialog.show(confirm).then(function () {
                FilesService.deleteFile(path)
                    .success(function () {
                        AlertService.showAlert('success', 'Success!', 'File has been deleted');
                        FilesCtrl.refresh();
                    })
                    .error(function (err) {
                        AlertService.showAlert('error', 'Failed', 'Failed to delete file');
                    });
            });
        };

        FilesCtrl.uploadFile = function (files) {
            AlertService.showAlert('info', 'Upload Started', '');
            FilesService.uploadFile(files[0])
                .success(function (data) {
                    AlertService.showAlert('success', 'Success!', 'File has been uploaded');
                    FilesCtrl.refresh();
                }).error(function (data, status, headers, config) {
                    AlertService.showAlert('error', 'Failed', 'Failed to upload file');
                });
        };

        init();
    }
})();