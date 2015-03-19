using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(gentryriggen.Startup))]
namespace gentryriggen
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
        }
    }
}
