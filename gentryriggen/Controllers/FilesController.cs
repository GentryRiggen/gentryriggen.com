using gentryriggen.Filters;
using gentryriggen.models;
using gentryriggen.Models;
using gentryriggen.Utils;
using Microsoft.WindowsAzure.Storage.Blob;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;

namespace gentryriggen.Controllers
{
    [TokenAuth(Roles = "Admin, Editor")]
    public class FilesController : ApiController
    {
        private static string binaryContainerName = "binary";
        private static string binaryUrl = Utilities.GetSetting("binaryUrl");

        [ResponseType(typeof(IEnumerable<BlobFile>))]
        [Route("api/admin/files")]
        [HttpGet]
        public IHttpActionResult Get([FromUri]int page = 1, [FromUri]int pageSize = 50, [FromUri]string q = "")
        {
            int skip = (page - 1) * pageSize;
            int stopAt = skip + pageSize;
            if (!String.IsNullOrEmpty(q))
                q = q.ToLower();
            CloudBlobContainer container = CDNRepository.GetContainer(binaryContainerName);
            // Loop over items within the container and get their URI
            List<BlobFile> files = new List<BlobFile>();
            int count = 1;
            foreach (IListBlobItem item in container.ListBlobs(null, false))
            {
                if (count > skip && count <= stopAt)
                {
                    if (item.GetType() == typeof(CloudBlockBlob))
                    {
                        CloudBlockBlob blob = (CloudBlockBlob)item;
                        if (!String.IsNullOrEmpty(q))
                        {
                            string fileName = blob.Uri.AbsolutePath.Split('/').Last().ToLower();
                            if (fileName.StartsWith(q))
                            {
                                files.Add(new BlobFile 
                                {
                                    FileName = blob.Name,
                                    Uri = new Uri(binaryUrl + blob.Name)
                                });
                            }
                            else
                            {
                                // do not count this one
                                count--;
                            }
                        }
                        else
                        {
                            files.Add(new BlobFile
                            {
                                FileName = blob.Name,
                                Uri = new Uri(binaryUrl + blob.Name)
                            });
                        }
                    }
                    else if (count > stopAt)
                        break;

                    count++;
                }
            }
            return Ok(files);
        }

        [Route("api/admin/files")]
        [HttpPost]
        public async Task<HttpResponseMessage> PostUpload()
        {
            var provider = new MultipartFileStreamProvider(Path.GetTempPath());

            // Read the form data.
            await Request.Content.ReadAsMultipartAsync(provider);

            CloudBlobContainer imagesContainer = CDNRepository.GetContainer(binaryContainerName);
            foreach (var fileData in provider.FileData)
            {
                var filename = fileData.Headers.ContentDisposition.FileName;
                filename = filename.Trim( new Char[] { ' ', '"', '/', '\\' } );
                var blob = imagesContainer.GetBlockBlobReference(filename);
                using (var filestream = File.OpenRead(fileData.LocalFileName))
                {
                    blob.UploadFromStream(filestream);
                }
                File.Delete(fileData.LocalFileName);
            }

            return Request.CreateResponse(HttpStatusCode.OK);
        }

        [Route("api/admin/files")]
        [HttpDelete]
        public IHttpActionResult Delete([FromUri]string fileName)
        {
            CloudBlobContainer container = CDNRepository.GetContainer(binaryContainerName);
            CloudBlockBlob blockBlob = container.GetBlockBlobReference(fileName);
            // Delete the blob.
            blockBlob.Delete();
            return Ok();
        }
    }
}
