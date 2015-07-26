using System.Web;
using System.Web.Optimization;

namespace gentryriggen
{
    public class BundleConfig
    {
        // For more information on bundling, visit http://go.microsoft.com/fwlink/?LinkId=301862
        public static void RegisterBundles(BundleCollection bundles)
        {

            bundles.Add(new ScriptBundle("~/bundles/scripts").Include(
                        "~/client/bower_components/jquery/dist/jquery.js",
                        "~/client/bower_components/bootstrap/dist/js/bootstrap.js",
                        "~/client/bower_components/toastr/toastr.js",
                        "~/client/bower_components/underscore/underscore.js",
                        "~/client/bower_components/angular/angular.js",
                        "~/client/bower_components/angular-animate/angular-animate.js",
                        "~/client/bower_components/angular-aria/angular-aria.js",
                        "~/client/bower_components/angular-sanitize/angular-sanitize.js",
                        "~/client/bower_components/angular-material/angular-material.js",
                        "~/client/bower_components/angular-messages/angular-messages.js",
                        "~/client/bower_components/angular-ui-router/release/angular-ui-router.js",
                        "~/client/bower_components/angular-utils-disqus/dirDisqus.js",
                        "~/client/bower_components/textAngular/dist/textAngular-rangy.min.js",
                        "~/client/bower_components/textAngular/dist/textAngular-sanitize.min.js",
                        "~/client/bower_components/textAngular/dist/textAngularSetup.js",
                        "~/client/bower_components/textAngular/dist/textAngular.js",
                        
                        // APP
                        "~/client/app/app.js",
                        "~/client/app/app.config.js",

                        // COMMON
                        "~/client/app/common/user.service.js",
                        "~/client/app/common/authInterceptor.factory.js",
                        "~/client/app/common/authToken.service.js",
                        "~/client/app/common/alert.service.js",
                        "~/client/app/common/syntaxHighlight.directive.js",
                        "~/client/app/common/compileTemplate.directive.js",

                        // LAYOUT
                        "~/client/app/header/header.ctrl.js",

                        // LOGIN/LOGOUT
                        "~/client/app/login/login.ctrl.js",
                        "~/client/app/login/logout.ctrl.js",

                        // BLOG
                        "~/client/app/blog/blog.service.js",
                        "~/client/app/blog/blogPost.directive.js",
                        "~/client/app/blog/blog.ctrl.js",
                        "~/client/app/blog/blogDetail.ctrl.js",

                        // ADMIN
                        "~/client/adminApp/admin.ctrl.js",

                        "~/client/adminApp/blog/adminBlog.ctrl.js",
                        "~/client/adminApp/blog/adminBlogEdit.ctrl.js",
                        "~/client/adminApp/blog/blogPostEditor.directive.js",

                        "~/client/adminApp/files/files.ctrl.js",
                        "~/client/adminApp/files/files.service.js",

                        "~/client/adminApp/account/account.ctrl.js"
                    ));

            bundles.Add(new StyleBundle("~/Content/css").Include(
                      "~/client/bower_components/bootstrap/dist/css/bootstrap.css",
                      "~/client/bower_components/toastr/toastr.css",
                      "~/client/bower_components/fontawesome/css/font-awesome.css",
                      "~/client/bower_components/angular-material/angular-material.css",
                      "~/client/bower_components/textAngular/dist/textAngular.css",
                      "~/client/app/styles/base.css"));
        }
    }
}
