using gentryriggen.models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gentryriggen.data.Repositories
{
    public class UserRepository : GenericRepository<User>
    {
        public UserRepository(AppDbContext context) : base(context) { }

        public User GetById(string id)
        {
            return base.DbSet.Where(u => u.Id.Equals(id)).FirstOrDefault();
        }

        public User FindByToken(string token)
        {
            return null;
        }

    }
}
