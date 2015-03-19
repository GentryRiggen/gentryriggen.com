using gentryriggen.data.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.data
{
    public class AppData : IDisposable
    {
        private AppDbContext _context = new AppDbContext();
        private UserRepository _users = null;
        private BlogPostRepository _blogPosts = null;

        public UserRepository Users
        {
            get
            {
                if (this._users == null)
                {
                    this._users = new UserRepository(this._context);
                }
                return this._users;
            }
        }

        public BlogPostRepository BlogPosts
        {
            get
            {
                if (this._blogPosts == null)
                {
                    this._blogPosts = new BlogPostRepository(this._context);
                }
                return this._blogPosts;
            }
        }

        public AppDbContext Context
        {
            get
            {
                return _context;
            }
        }

        public void SaveChanges()
        {
            this._context.SaveChanges();
        }

        public void Dispose()
        {
            if (this._context != null)
            {
                this._context.Dispose();
            }
        }
    }
}
