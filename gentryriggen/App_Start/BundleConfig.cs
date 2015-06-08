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
                        
                        // APP Libraries
                        "~/client/app/app.js",
                        "~/client/app/app.config.js",

                        // APP Services
                        "~/client/app/common/user.service.js",
                        "~/client/app/common/authInterceptor.factory.js",
                        "~/client/app/common/authToken.service.js",
                        "~/client/app/common/alert.service.js",

                        "~/client/app/header/header.ctrl.js",

                        "~/client/app/login/login.ctrl.js",
                        "~/client/app/login/logout.ctrl.js",

                        "~/client/app/blog/blog.service.js",
                        "~/client/app/blog/blogPost.directive.js",
                        "~/client/app/blog/blog.ctrl.js",
                        "~/client/app/blog/blogDetail.ctrl.js",

                        "~/client/adminApp/admin.ctrl.js",
                        "~/client/adminApp/blog/adminBlog.ctrl.js"


                        //"~/app/scripts/services/dialogService.js",
                        //"~/app/scripts/services/authToken.js",
                        //"~/app/scripts/services/authInterceptor.js",
                        //"~/app/scripts/services/blogService.js",
                        //"~/app/scripts/services/fileService.js",
                        //// Angular Directives
                        //"~/app/scripts/directives/formInput.js",
                        //"~/app/scripts/directives/blogPostView.js",
                        //"~/app/scripts/directives/blogPostEditView.js",
                        //// Angular Controllers
                        //"~/app/scripts/controllers/header.ctrl.js",
                        //"~/app/scripts/controllers/login.ctrl.js",
                        //"~/app/scripts/controllers/logout.ctrl.js",
                        //"~/app/scripts/controllers/blog.ctrl.js",
                        //"~/app/scripts/controllers/blogPost.ctrl.js",
                        //"~/app/scripts/controllers/admin/admin.ctrl.js",
                        //"~/app/scripts/controllers/admin/blogAdmin.ctrl.js",
                        //"~/app/scripts/controllers/admin/blogAdminEdit.ctrl.js",
                        //"~/app/scripts/controllers/admin/fileAdmin.ctrl.js",
                        //"~/app/scripts/controllers/admin/account.ctrl.js"
                    ));

            bundles.Add(new StyleBundle("~/Content/css").Include(
                      "~/client/bower_components/bootstrap/dist/css/bootstrap.css",
                      "~/client/bower_components/toastr/toastr.css",
                      "~/client/bower_components/fontawesome/css/font-awesome.css",
                      "~/client/bower_components/angular-material/angular-material.css",
                      "~/client/app/styles/base.css"));
        }
    }
}
