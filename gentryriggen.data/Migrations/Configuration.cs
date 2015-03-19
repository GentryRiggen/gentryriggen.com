namespace gentryriggen.data.Migrations
{
    using System;
    using System.Data.Entity;
    using System.Data.Entity.Migrations;
    using System.Linq;
    using Microsoft.AspNet.Identity;
    using Microsoft.AspNet.Identity.EntityFramework;
    using gentryriggen.models;

    internal sealed class Configuration : DbMigrationsConfiguration<gentryriggen.data.AppDbContext>
    {
        public Configuration()
        {
            AutomaticMigrationsEnabled = true;
        }

        protected override void Seed(gentryriggen.data.AppDbContext context)
        {
            #region USER AND ROLES
            var UserManager = new UserManager<User>(
                new UserStore<User>(context));
            var RoleManager = new RoleManager<IdentityRole>(
                new RoleStore<IdentityRole>(context));

            string defaultUser = "gentry";
            string initialPassword = "Admin123";
            string adminRole = "Admin";
            string moderatorRole = "Editor";
            string userRole = "User";

            if (!RoleManager.RoleExists(adminRole)) { RoleManager.Create(new IdentityRole(adminRole)); }
            if (!RoleManager.RoleExists(moderatorRole)) { RoleManager.Create(new IdentityRole(moderatorRole)); }
            if (!RoleManager.RoleExists(userRole)) { RoleManager.Create(new IdentityRole(userRole)); }

            if (UserManager.FindByName(defaultUser) == null)
            {
                User u = new User()
                {
                    UserName = "gentry",
                    FirstName = "Gentry",
                    LastName = "Riggen",
                    BioSnippet = "Super Good Looking",
                    Email = "gentry@gentryriggen.com",
                    CreatedOn = DateTime.UtcNow,
                    ModifiedOn = DateTime.UtcNow
                };
                var result = UserManager.Create(u, initialPassword);
                if (result.Succeeded)
                {
                    UserManager.AddToRole(u.Id, adminRole);
                    UserManager.AddToRole(u.Id, moderatorRole);
                    UserManager.AddToRole(u.Id, userRole);
                }
            }
            #endregion
        }
    }
}
