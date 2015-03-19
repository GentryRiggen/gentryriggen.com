using gentryriggen.models;
using Microsoft.AspNet.Identity.EntityFramework;
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.data
{
    public class AppDbContext : IdentityDbContext<User>
    {
        public DbSet<BlogPost> BlogPosts { get; set; }

        public AppDbContext()
            : base("DefaultConnection", throwIfV1Schema: false)
        {
        }

        public static AppDbContext Create()
        {
            return new AppDbContext();
        }

        private void ApplyRules()
        {
            foreach (var entry in this.ChangeTracker.Entries().Where(
                        e => e.Entity is IAutoDates || e.Entity is IPermalink &&
                        ((e.State == EntityState.Added) || (e.State == EntityState.Modified))
                    ))
            {
                if (entry.Entity is IAutoDates)
                {
                    IAutoDates e = (IAutoDates)entry.Entity;
                    if (entry.State == EntityState.Added)
                        e.CreatedOn = DateTime.Now;

                    e.ModifiedOn = DateTime.Now;
                }
            }
        }

        public override int SaveChanges()
        {
            this.ApplyRules();
            return base.SaveChanges();
        }
    }
}
