(function () {
  'use strict';

  var app = angular.module('gr');

  app.constant('API_URL', '/api');

  // Handle Auth on every navigation
  app.run(['$rootScope', '$state', 'UserService', '$window', '$location', '_',
    function ($rootScope, $state, UserService, $window, $location, _) {
      $rootScope.$on('$viewContentLoaded', function () {
        $window.ga('send', 'pageview', {page: $location.url()});
      });

      $rootScope.$on('$stateChangeStart', function (event, toState) {
        console.log('STATE: ', toState.name);
        if (angular.isDefined(toState.data) &&
          angular.isDefined(toState.data.requireLogin) &&
          toState.data.requireLogin === false) {
          return;
        }

        UserService.getCurrentUser().then(
          function (currentUser) {
            var userIsAdmin = _.contains(currentUser.roles, "Admin");
            // Check if state requires user to be in certain role (Admin trumps everything)
            if (!userIsAdmin &&
              angular.isDefined(toState.data) &&
              angular.isDefined(toState.data.allowedRoles) &&
              toState.data.allowedRoles.length > 0) {

              var allowedThrough = false;
              angular.forEach(toState.data.allowedRoles, function (role) {
                if (_.contains(currentUser.roles, role)) {
                  allowedThrough = true;
                }
              });

              if (!allowedThrough) {
                // If we get this far, they don't have access
                event.preventDefault();
                $state.go('login');
              }
            }
          },
          function () {
            event.preventDefault();
            // Route to login
            $state.go('login');
          }
        );
      });
    }]);

  app.config(['$urlRouterProvider', '$stateProvider', '$httpProvider', '$locationProvider', '$mdThemingProvider',
    function ($urlRouterProvider, $stateProvider, $httpProvider, $locationProvider, $mdThemingProvider) {
      $locationProvider.hashPrefix('!');
      $urlRouterProvider.otherwise('/');

      $stateProvider
        .state('login', {
          url: '/login',
          templateUrl: '/src/app/login/login.tmpl.html',
          controller: 'LoginCtrl',
          controllerAs: 'LoginCtrl',
          data: {requireLogin: false}
        })
        .state('logout', {
          url: '/logout',
          controller: 'LogoutCtrl',
          data: {requireLogin: false}
        })
        .state('blog', {
          url: '/',
          templateUrl: '/src/app/blog/blog.tmpl.html',
          controller: 'BlogCtrl',
          controllerAs: 'BlogCtrl',
          data: {requireLogin: false}
        })
        .state('blogDetail', {
          url: '/blog/:permalink',
          templateUrl: '/src/app/blog/blogDetail.tmpl.html',
          controller: 'BlogDetailCtrl',
          controllerAs: 'BlogDetailCtrl',
          data: {requireLogin: false}
        })
        .state('books', {
          url: '/books',
          templateUrl: '/src/app/books/books.tmpl.html',
          controller: 'BooksCtrl',
          controllerAs: 'BooksCtrl',
          data: {requireLogin: false}
        })
        .state('book', {
          url: '/books/:id',
          templateUrl: '/src/app/books/book.tmpl.html',
          controller: 'BookCtrl',
          controllerAs: 'BookCtrl',
          data: {requireLogin: false}
        })
        .state('about', {
          url: '/about',
          templateUrl: '/src/app/about/about.tmpl.html',
          controller: 'AboutCtrl',
          data: {requireLogin: false}
        })

        // ADMIN STATE
        .state('admin', {
          url: '/admin',
          templateUrl: '/src/app/admin/adminWrapper.tmpl.html',
          controller: 'AdminCtrl',
          controllerAs: 'AdminCtrl',
          data: {
            allowedRoles: ["Admin", "Editor"]
          }
        })
        .state('admin.blog', {
          url: '/blog',
          templateUrl: '/src/app/admin/blog/adminBlog.tmpl.html',
          controller: 'AdminBlogCtrl',
          controllerAs: 'AdminBlogCtrl'
        })
        .state('admin.blogEdit', {
          url: '/blog/edit/:id',
          templateUrl: '/src/app/admin/blog/adminBlogEdit.tmpl.html',
          controller: 'AdminBlogEditCtrl',
          controllerAs: 'AdminBlogEditCtrl'
        })
        .state('admin.files', {
          url: '/files',
          templateUrl: '/src/app/admin/files/files.tmpl.html',
          controller: 'FilesCtrl',
          controllerAs: 'FilesCtrl'
        })
        .state('admin.accounts', {
          url: '/accounts',
          templateUrl: '/src/app/admin/account/accounts.tmpl.html',
          controller: 'AccountsCtrl',
          controllerAs: 'AccountsCtrl'
        })
        .state('admin.account', {
          url: '/accounts/:id',
          templateUrl: '/src/app/admin/account/account.tmpl.html',
          controller: 'AccountCtrl',
          controllerAs: 'AccountCtrl'
        })
        .state('admin.books', {
          url: '/books',
          templateUrl: '/src/app/admin/book/adminBooks.tmpl.html',
          controller: 'AdminBooksCtrl',
          controllerAs: 'AdminBooksCtrl'
        })
        .state('admin.book', {
          url: '/books/:id',
          templateUrl: '/src/app/admin/book/adminBook.tmpl.html',
          controller: 'AdminBookCtrl',
          controllerAs: 'AdminBookCtrl'
        });

      $httpProvider.interceptors.push('AuthInterceptor');

      $mdThemingProvider.definePalette('theme', {
        "50": "#e6f7fd",
        "100": "#b3e7fa",
        "200": "#80d7f7",
        "300": "#55c9f4",
        "400": "#2abbf1",
        "500": "#00aeee",
        "600": "#0098d0",
        "700": "#0083b3",
        "800": "#006d95",
        "900": "#005777",
        "A100": "#b3e7fa",
        "A200": "#80d7f7",
        "A400": "#2abbf1",
        "A700": "#0083b3"
      });

      $mdThemingProvider.theme('default')
        .primaryPalette('theme')
        .accentPalette('blue');
    }]);
})();
