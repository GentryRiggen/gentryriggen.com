using gentryriggen.models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Data.Entity;

namespace gentryriggen.data.Repositories
{
    public class BlogPostRepository : GenericRepository<BlogPost>
    {
        public BlogPostRepository(AppDbContext context) : base(context) { }

        public override BlogPost Find(int id)
        {
            return base.DbSet
                .Where(bp => bp.Id == id)
                .Include(bp => bp.Author)
                .FirstOrDefault();
        }

        public IQueryable<BlogPost> GetAll(bool adminRequest = false)
        {
            IQueryable<BlogPost> posts = base.GetAll()
                .Include(bp => bp.Author)
                .OrderByDescending(bp => bp.CreatedOn);

            if (!adminRequest)
            {
                posts = posts.Where(bp => bp.Visible);
            }
            return posts;
        }

        public BlogPost GetByPermalink(string permalink)
        {
            BlogPost post = base.DbSet
                .Where(bp => bp.Permalink.Equals(permalink, StringComparison.OrdinalIgnoreCase))
                .Where(bp => bp.Visible)
                .FirstOrDefault();

            if (post != null)
            {
                return this.Find(post.Id);
            }
            else
            {
                return null;
            }
        }
    }
}
