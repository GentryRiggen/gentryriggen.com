using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Entity;
using System.Data.Entity.Infrastructure;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using System.Web.Http.Description;
using gentryriggen.data;
using gentryriggen.models;
using gentryriggen.models.Serializable;
using gentryriggen.Filters;
using System.Data.Entity.Validation;
using gentryriggen.Utils;

namespace gentryriggen.Controllers
{
    public class BlogController : ApiController
    {
        private AppData appData = new AppData();

        public IHttpActionResult GetBlogPosts([FromUri]int page = 1, [FromUri]int pageSize = 5)
        {
            int skip = (page - 1) * pageSize;
            List<BlogPost> posts = appData.BlogPosts.GetAll(false).Skip(skip).Take(pageSize).ToList();
            List<SerializedBlogPost> serialized = new List<SerializedBlogPost>();
            foreach (BlogPost p in posts)
            {
                serialized.Add(p.Serialize());
            }

            int total = appData.BlogPosts.Count();
            double numPages = Math.Ceiling(Convert.ToDouble(total / pageSize));

            return Ok(new
            {
                page = page,
                pageSize = pageSize,
                numPages = numPages,
                posts = serialized
            });
        }

        // GET: get all paginated
        [Route("api/admin/blog/")]
        [TokenAuth(Roles="Admin, Editor")]
        public IHttpActionResult GetBlogPostsAsAdmin([FromUri]int page = 1, [FromUri]int pageSize = 5)
        {
            int skip = (page - 1) * pageSize;
            List<BlogPost> posts = appData.BlogPosts.GetAll(true).Skip(skip).Take(pageSize).ToList();
            List<SerializedBlogPost> serialized = new List<SerializedBlogPost>();
            foreach (BlogPost p in posts)
            {
                serialized.Add(p.Serialize());
            }

            int total = appData.BlogPosts.Count();
            double numPages = Math.Ceiling(Convert.ToDouble(total / pageSize));

            return Ok(new
            {
                page = page,
                pageSize = pageSize,
                numPages = numPages,
                posts = serialized
            });
        }

        // GET: by search
        [ResponseType(typeof(IEnumerable<SerializedBlogPost>))]
        [Route("api/blog/search")]
        [HttpGet]
        public IHttpActionResult SearchBlogPosts([FromUri]string q = "")
        {
            List<BlogPost> blogPosts = appData.BlogPosts.Search(q).ToList();
            List<SerializedBlogPost> serialized = new List<SerializedBlogPost>();
            foreach (BlogPost p in blogPosts)
            {
                serialized.Add(p.Serialize());
            }

            return Ok(serialized);
        }

        // GET: by permalink
        [ResponseType(typeof(SerializedBlogPost))]
        [Route("api/blog/{permalink}")]
        public IHttpActionResult GetBlogPost(string permalink)
        {
            BlogPost blogPost = appData.BlogPosts.GetByPermalink(permalink);
            if (blogPost == null)
            {
                return NotFound();
            }

            SerializedBlogPost b = blogPost.Serialize();
            b.Url = Utilities.GetSetting("appUrl") + "/#!/blog/" + b.Permalink;
            return Ok(b);
        }

        [ResponseType(typeof(SerializedBlogPost))]
        [TokenAuth(Roles = "Admin, Editor")]
        [Route("api/admin/blog/{id}")]
        [HttpGet]
        public IHttpActionResult Get(int id)
        {
            BlogPost blogPost = appData.BlogPosts.Find(id);
            if (blogPost == null)
            {
                return NotFound();
            }

            return Ok(blogPost.Serialize());
        }

        // PUT
        [ResponseType(typeof(void))]
        [TokenAuth(Roles = "Admin, Editor")]
        [Route("api/admin/blog/{id}")]
        [HttpPut]
        public IHttpActionResult PutBlogPost(int id, SerializedBlogPost blogPost)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (id != blogPost.Id)
            {
                return BadRequest();
            }

            BlogPost dbBlogPost = appData.BlogPosts.Find(id);
            // If visible was false and is now true, updated Created On
            DateTime createdOn = dbBlogPost.CreatedOn;
            if (!dbBlogPost.Visible && blogPost.Visible)
                createdOn = DateTime.Now;
            dbBlogPost.DeSerialize(blogPost);
            dbBlogPost.CreatedOn = createdOn;

            appData.BlogPosts.Update(dbBlogPost);
            try
            {
                appData.SaveChanges();
            }
            catch (DbEntityValidationException e)
            {
                foreach (var eve in e.EntityValidationErrors)
                {
                    Console.WriteLine("Entity of type \"{0}\" in state \"{1}\" has the following validation errors:", eve.Entry.Entity.GetType().Name, eve.Entry.State);
                    foreach (var ve in eve.ValidationErrors)
                    {
                        Console.WriteLine("- Property: \"{0}\", Error: \"{1}\"",
                            ve.PropertyName, ve.ErrorMessage);
                    }
                }

                throw e;
            }

            return StatusCode(HttpStatusCode.NoContent);
        }

        // POST
        [ResponseType(typeof(SerializedBlogPost))]
        [TokenAuth(Roles = "Admin, Editor")]
        [Route("api/admin/blog")]
        [HttpPost]
        public IHttpActionResult PostBlogPost(SerializedBlogPost blogPost)
        {
            User u = appData.Users.GetById(User.Identity.Name);
            if (u == null)
            {
                return StatusCode(HttpStatusCode.Unauthorized);
            }

            BlogPost newBlogPost = new BlogPost();
            newBlogPost.DeSerialize(blogPost);
            newBlogPost.Author = u;

            if (!newBlogPost.IsValid())
            {
                return BadRequest(newBlogPost.ErrorsToString());
            }

            try
            {
                appData.BlogPosts.Add(newBlogPost);
                appData.SaveChanges();
            }
            catch (DbEntityValidationException e)
            {
                foreach (var eve in e.EntityValidationErrors)
                {
                    Console.WriteLine("Entity of type \"{0}\" in state \"{1}\" has the following validation errors:", eve.Entry.Entity.GetType().Name, eve.Entry.State);
                    foreach (var ve in eve.ValidationErrors)
                    {
                        Console.WriteLine("- Property: \"{0}\", Error: \"{1}\"",
                            ve.PropertyName, ve.ErrorMessage);
                    }
                }

                throw e;
            }


            return Created("/api/blog/" + newBlogPost.Permalink, newBlogPost.Serialize());
        }

        [ResponseType(typeof(SerializedBlogPost))]
        [TokenAuth(Roles = "Admin, Editor")]
        [Route("api/blog/createnew")]
        [HttpPost]
        public IHttpActionResult CreateBlogPost()
        {
            User u = appData.Users.GetById(User.Identity.Name);
            BlogPost blogPost = new BlogPost
            {
                Title = "New Blog Post" + DateTime.Now.ToString(),
                SubTitle = "",
                Content = "",
                Visible = false,
                Permalink = "New-Blog-Post",
                Author = u
            };

            appData.BlogPosts.Add(blogPost);
            appData.SaveChanges();

            SerializedBlogPost b = blogPost.Serialize();
            b.Url = Utilities.GetSetting("appUrl") + "/#!/blog/" + b.Permalink;
            return Ok(b);
        }

        // DELETE
        [ResponseType(typeof(BlogPost))]
        [TokenAuth(Roles = "Admin, Editor")]
        [Route("api/admin/blog/{id}")]
        [HttpDelete]
        public IHttpActionResult DeleteBlogPost(int id)
        {
            BlogPost blogPost = appData.BlogPosts.Find(id);
            if (blogPost == null)
            {
                return NotFound();
            }

            appData.BlogPosts.Delete(blogPost);
            appData.SaveChanges();

            return Ok(blogPost);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                appData.Dispose();
            }
            base.Dispose(disposing);
        }

        private bool BlogPostExists(int id)
        {
            return appData.BlogPosts.Exists(id);
        }
    }
}