CREATE TABLE user
(
  id         INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(64),
  last_name  VARCHAR(64),
  email      VARCHAR(128),
  username   VARCHAR(64)     NOT NULL,
  password   VARCHAR(256)    NOT NULL
);
ALTER TABLE user ADD CONSTRAINT unique_id UNIQUE (id);
ALTER TABLE user ADD CONSTRAINT unique_username UNIQUE (username);



CREATE TABLE blog_post
(
  id         INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  title      VARCHAR(256)    NOT NULL,
  subtitle   VARCHAR(256),
  permalink   VARCHAR(256),
  content    LONGTEXT,
  visible    INT DEFAULT 0 NOT NULL,
  created_by INT             NOT NULL,
  created_on DATETIME,
  updated_on DATETIME        NOT NULL,
  visible_on DATETIME
);
CREATE UNIQUE INDEX unique_id ON blog_post (id);
ALTER TABLE blog_post ADD FOREIGN KEY (created_by) REFERENCES user(id);



CREATE TABLE role
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  title VARCHAR(32) NOT NULL
);
CREATE UNIQUE INDEX unique_id ON role (id);
CREATE UNIQUE INDEX unique_title ON role (title);



CREATE TABLE user_role
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  role_id INT NOT NULL
);
CREATE UNIQUE INDEX unique_id ON user_role (id);
ALTER TABLE user_role ADD FOREIGN KEY (user_id) REFERENCES user(id);
ALTER TABLE user_role ADD FOREIGN KEY (role_id) REFERENCES role(id);



INSERT INTO role VALUES (DEFAULT, 'Admin');
SET @adminRoleId = LAST_INSERT_ID();

INSERT INTO role VALUES (DEFAULT, 'Editor');
SET @editorRoleId = LAST_INSERT_ID();

INSERT INTO role VALUES (DEFAULT, 'Read');
SET @readRoleId = LAST_INSERT_ID();

INSERT INTO user VALUES (DEFAULT, 'Gentry', 'Riggen', 'gentry@gentryriggen.com', 'gentry','$2a$10$t0a0GFNUAv8pi4Mho8QoLecg/CJrg9t9Pb0t32J4gWXX5rO0HCWQ.');
SET @defaultUserId = LAST_INSERT_ID();

INSERT INTO user_role VALUES
  (DEFAULT, @defaultUserId, @adminRoleId),
  (DEFAULT, @defaultUserId, @editorRoleId),
  (DEFAULT, @defaultUserId, @readRoleId);


INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (13, 'How To Migrate an Azure Blob From One Container To Another', 'Azure PowerShell Cmdlets to the rescue!', 'azure-blob-to-blob-migration', '<p>I recently had the need to move this very site from one Azure subscription to another.  I use Azure as a Platform - Websites, Database, Blob Storage - more than I use it as an Infrastructure - hosting a VM that I install all my components on. Moving the website was as easy as deploying a new website and and publishing my code to it and then pointing my DNS at the new website. The SQL database was really easy because of <a href="http://msdn.microsoft.com/en-us/library/hh335292.aspx" target="#">Azure''s Import/Export feature.</a> This only left my blob storage where I keep binary content like pictures and other files. Unfortunately to my knowledge there is no Import/Export feature for Azure Storage Containers. Oh well it gave me an opportunity to try out some of Azure''s management tools, specifically PowerShell cmdlets. The following is the steps I used to script the process using the Azure PowerShell Cmdlets.</p>

<h2>Get the tools</h2>
<p>You can find and download the Azure PowerShell tools here <a href="azure.microsoft.com/downloads" target=#">Azure Downloads</a> under Command Line Tools.</p>

<h2 id="AddAccount">Add Your Azure Account</h2>
<p>Start Azure PowerShell add your Azure account by using the following cmdlet <kbd>Add-AzureAccount</kbd>. This will open a browser and ask you to authenticate with your Azure credentials. If your subscriptions are under different accounts, start with the account where your storage container and content is currently located. If you run <kbd>Get-AzureSubscription</kbd> you will see a list of all the subscriptions that are associated with the account you signed in with. This may or may not have setup your "CurrentStorageAccountName" for your desired subscription. For me it did not so I had to run <kbd>Set-AzureSubscription -SubscriptionName GDawg -CurrentStorageAccountName gentry</kbd>. Cool subscription name, right? This is the name of your storage account, not your container name.</p>

<h2>Download Your Blobs</h2>
<p>There are two cmdlets I used to get at my blobs and their content. The first is<kbd>Get-AzureStorageBlob</kbd> which allows you to get a list of all my blobs and related information for each. The second was <kbd>Get-AzureStorageBlobContent</kbd> to actually download the blob. I downloaded all of my blob contents to some deep and cheap storage with the following command:</p>

<pre class="brush: ps">
  Get-AzureStorageBlob -Container images | foreach {
    Get-AzureStorageBlobContent -Blob $_.name -Container images -Destination E:TempBlobs
  }
</pre>

<p>This may ask you to overwrite some files if you have named some blogs the same thing. I''ll let you decide how you want to de-duplicate those...</p>

<h2>Upload Your Blobs to Your New Container</h2>
<p>If your subscription is under another Azure account see the <a href="#AddAccount">Add Your Azure Account</a> section above to get PowerShell setup with the right account. With your account setup use the following cmdlet to select the right subscription that you want to upload your blobs to <kbd>Select-AzureSubscription -SubscriptioinName GSlizzle</kbd>. Yes, all of my subscription names are ridiculous. Moving on!</p>', 0, 1, '2015-01-24 00:00:00', '2015-02-28 05:52:08', '2015-01-24 00:00:00');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (14, 'Look at where you''re going, not where you are', 'How I plan to achieve my goals', 'look-at-where-you-are-going-not-where-you-are', '<img src="http://cdn.gentryriggen.com/binary/WindingRoad.jpg" class="img-responsive"/><p><span>When I first started to drive, my Dad would take me driving all over my hometown. This often included places that contained winding roads that were scary to navigate as a new driver. My Dad noticed my hesitations and gave me some advice I will never forget. He said &#34;Keep your eyes on where you&#39;re going, not the immediate turn you are in.&#34; It was simple advice that had profound results. When I would look ahead of the curve rather than directly into it, I began to take the turns much easier. When I focused on where I wanted to go, everything I was currently doing just fell into place.</span><br/></p><p>I remembered this lesson the other day while driving home from work and I thought to myself &#34;What if I could apply this principle to other aspects of my life?&#34; What if I were to stop looking at my current situation and begin to focus instead on where I want to go. You can literally apply this paradigm shift to almost any part of your life. The first one that immediately jumped out at me was obviously my software career, but it can be applied to so much more. For example, think about a healthy lifestyle. I often find myself, as I am sure many people, focusing on my current state of health. It probably sucks and I know I can do more, but what if I shifted my focus to the state of health I wanted. For me personally I could focus on a desirable pants size and 10k run time. If these things were my focus, maybe my current state of affairs would adjust accordingly.</p><h2>Applying this paradigm to my software career</h2><p>Like I said this could be applied to any and all aspects of life, but since I am a software guy, I am going to spend the rest of this post elaborating into that aspect of my life. Currently I maintain a position as a Software Engineer at a Fortune 100 company, at least until they <a href="http://youtu.be/Z7dROcm_SbY" target="#">fix that payroll glitch</a>. I work on anything from legacy systems, 10 years or older, to some decently modern systems and software. I work with some really great teams and individuals and at the same time deal with a bunch of corporate bureaucracy. It comes with the huge multinational corporation territory I guess. All in all I am in a very good spot at this point in my career. But is it where I want to be? Probably not. Am I stuck in the current curve I am navigating and not looking at where I want to go? Probably. Do I spend too much time focusing on my current situation and not enough on where I want to be next in my career? Most definitely. </p><p>Where am I going? Where do I want to be? If you were to ask my peers this question they would probably say Microsoft, Amazon, Google or start my own business. They wouldn&#39;t be wrong (Yeah I am talking to the thousands of recruiters from those companies fervently reading my blog...). But Microsoft, Amazon and Google isn&#39;t the answer and neither is my own startup. The answer is more about the content of the work I want to be doing in my life. </p><blockquote>    <ul>        <li><p>I want to write software. I then want to learn how to write even better software over and over again.</p></li>        <li><p>I want to create things that people use and enjoy, not only things that they&#39;re required to use for their job.</p></li>        <li><p>I want to support existing projects that have flexibility and I want to support features not necessarily code bases.</p></li>        <li><p>I want to work in a place where I am absolutely the dumbest person there, but have individuals who love to teach and share their incredible knowledge.</p></li>    </ul></blockquote><p>Is this too much to ask? Probably. But this is where I want to go so shouldn&#39;t I be looking towards that?</p><h2>OK so what does this look like and why might this help my current situation?</h2><p>I don&#39;t know what this looks like, but this is what I plan to do. I listed off a lot of things above that <b>I want</b> so that is where I am going to be &#34;looking.&#34; I mentioned that <b>I want to write software. I then want to learn how to write even better software over and over again.</b> For me this looks like taking every single opportunity at work to write new software. Although I am a software engineer, trust me when I say that I probably at best spend about 50% actually coding. This also means that I should write more software at home. We live in an awesome time where you can single handedly build incredible software and host it in the cloud for little to no cost. I have already started this by developing <a href="/MyProjects" target="#">mobile applications and websites</a>, but can and definitely plan to do more. I also plan to learn more languages and design patterns as these things tend to give me better insight on solving more and more problems.</p><p><b>I want to create things that people use and enjoy, not only things that they&#39;re required to use for their job.</b> I have always liked design, but have never considered myself to be a designer. I like when things are thoughtfully designed. I often use software that is less-featured but better designed and suited to my tastes (Windows Phone...). So for me I want to pursue writing more applications that are &#34;fun&#34; and &#34;beautiful.&#34; This will most likely happen on my solo development projects in web, mobile and desktop applications.</p><p><b>I want to support existing projects that have flexibility and I want to support features not necessarily code bases. </b> If the model sucks, change it, not write more bad code to make it work. If there is existing code that is less than desirable but supplies said feature, I should be able to start from scratch and create new code that supplies that feature. These are the traits of the employer and also the customer that help to create living applications that get better over time. I am finding success in finding employers/customers with these traits in my solo development work in my moonlight hours. I plan to keep seeking these types of projects out.</p><p><b>I want to work in a place where I am absolutely the dumbest person there, but have individuals who love to teach and share their incredible knowledge. </b> This is the single most important aspect to me. I learn best by learning from others and even better when I learn WITH others. I jive well with the pair programming paradigm and what better way to learn languages, design patterns, problem solving, troubleshooting etc. then to see it first hand with a person that knows these things well? Don&#39;t get me wrong, I currently work with some very intelligent people, but I want more possible mentors in more areas of expertise. To accomplish this I am going to focus more on finding individuals, within my job as well as outside my job, with the skills I desire and very earnestly seek their attention for mentoring opportunities.</p><h2>Wrap Up</h2><p>Looking at where you&#39;re going when driving definitely works, at least for me. Whether or not it works in my career is still up in the air, but I am sure that it is still a paradigm worth pursuing. I will be sure to update with any successes or failures in this area. </p>', 1, 1, '2014-04-02 00:00:00', '2015-02-23 05:39:06', '2014-04-02 00:00:00');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (15, '2014 Goals', 'Looking ahead to the new year', '2014-goals', '<img src="http://cdn.gentryriggen.com/binary/newyearsresolution.jpg" class="img img-rounded img-responsive"/>
<h2>First some reflection on 2013</h2>
<p>2013 was a big year for me and my career as a software developer. It marked the first full year that I worked as a software developer in some capacity after transitioning from being an IT admin. Needless to say I enjoy software much more but my IT skills have and will continue to serve me in the future. It was also a big year for the projects I completed outside of my 9 to 5 job. I was able to create and publish my first Mobile app, <a href="http://gentryriggen.com/MyProjects/Project/1">Gym Bag Notebook</a>, for the Windows Phone platform which has over 1,200 downloads in a little over 2 months . I also created this blog using the skills I have learned in ASP.NET MVC with Entity Framework. Finally I began mentoring a great friend of mine who is just starting his career in software development, <a href="http://kylelfrisbie.com/">Kyle Frisbie</a>.</p>
<h2>Developer Goals</h2>
<p>In 2014 I want to continue the hard work I have started in 2013 and continue to push myself to <a href="/Blog/Tag/7?tagName=Be%20a%20Better%20Developer">Be a Better Developer</a>. Regarding that journey here are my goals:</p>
<ol>
    <li>
        <h4>Be a published app author on all major platforms</h4>
        <p>This for me includes Windows 8, Windows Phone, (Xbox One if they open the market for it), Android and iOS. </p>
    </li>
    <li>
        <h4>Develop at least 2 projects with my mentor</h4>
        <p>This will have to be Geographically-distributed as my mentor lives about 75 miles away which is far enough that we will not be meeting in person often. Our first project together will be building him a website for his own blog. Custom made, so that he owns his own content. What comes after that I expect will be an Android app.</p>
    </li>
    <li>
        <h4>Blog more</h4>
        <p>I just started this blog in late November 2013 but only authored 2 posts. My goal is to author at least 25 posts in 2014. That really only is 2/month and I expect to do more.</p>
    </li>
    <li>
        <h4>Start a small business for myself</h4>
        <p>This <strong style="font-size: 18px;text-transform:uppercase;">will only be a small business</strong> and definitely not the next Facebook. I really only want something that I can use to work on small projects for some clients. I purchase and do enough work currently that it makes sense to charge them as business expenses. Furthermore I want business cards... Nuff said.</p>
    </li>
</ol>
<hr />
<h2>Life Goals</h2>
<p>There''s more to life than software development. At least that is what people keep telling me. </p>
<ol>
    <li>
        <h4>Find balance</h4>
        <p>I work a lot. Not necessarily at my 9-5 corporate job, but in general. I often spend a good 8-10 hours at work per day, go workout which takes almost 2 hours and then come home and work on my moonlight projects. I find each of these things to be critically important so it is hard to give up room in any area. That''s what 2014  is about. I hope to find some overlap such as working out during lunch at work, etc.</p>
    </li>
<li>
        <h4>Travel (Small trips)</h4>
        <p>My wife and I always talk about taking small trips to places in beautiful Colorado and we rarely do. It gets me away from the computer and spending more time with the hottie at home.</p>
    </li>
</ol>
<hr />
<p>No matter what happens, I know 2014 is going to be big. I will be documenting all of my new and updated projects in the <a href="/MyProjects">My Projects </a> section of the site and sharing the things I learn as well.</p>
<h3>Cheers!</h3>', 1, 1, '2014-01-05 00:00:00', '2015-02-28 05:52:03', '2014-01-05 00:00:00');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (16, 'Shut Up & Ship!', 'Seriously!', 'shut-up-and-ship', '<p>I have a story. On New Year''s day 2013, I was on a family vacation and I asked each of my family members about their goals for the new year. Most of the answers were as you would expect. Lose weight, be happier with my job etc. etc. I specifically remember mine because it was something I wanted to achieve so badly. My New Year''s resolution was to BE A BETTER DEVELOPER. It was all I wanted. I knew that I had the potential and attitude to do it and a new <a href="http://pluralsight.com/training/Courses" target="_blank">PluralSight Subscription</a> to boot.
</p>

<p>Well if you haven''t noticed, it is the middle of November already and I am just now getting started with blogging. Ok that''s not true. I have already tried starting to blog on popular content management systems such as WordPress, SquareSpace and Blogger. Each one of these systems left a lot to be desired. SquareSpace was beautiful if you just used their templates and nothing more, Wordpress was customizable beyond belief with Widgets and themes but those same components could just as easily crash after a bad update. On and on it went and I realized that blogging wasn''t the only step to becoming a better developer. For me it was learning how to build a website and create an online presence. The popular tech evangelist <a href="http://hanselman.com" target="_blank">Scott Hanselman</a>  talks about this exact topic in this post: <a href="http://www.hanselman.com/blog/YourWordsAreWasted.aspx " target="_blank">Your Words are Wasted</a>. This website is a culmination of that effort. An effort that has taken much longer than I would have liked. </p>

<p>I have built this website from the ground up using all of the skills I have learned in C#, ASP.NET, Entity Framework, SQL Server, LINQ, Windows Azure and more. And the best part about the site is that it is not even done yet. Not by a longshot. I have a long list of features that have yet to be implemented. But the title of this post says it all. Shut up & Ship! I stole this quote from the Windows Phone team at Microsoft who are hoping to stop just talking about the next release, but instead put their nose down and ship it. I love that idea because I work with other developers who are still developing that Android app. They are still waiting to write that next blog post, but the new Call of Duty came out and they have been a little distracted. Not me. I can''t move at that pace and achieve the things I want to achieve or be the developer I know I can be. </p>

<p>This website is where my journey begins and where I will post the exciting events, lessons and other randomness in my adventure. It is a living code base that will evolve over time. It has already allowed me to learn and grasp some fundamental .NET application design and will continue to do so. Please feel free to visit the other areas of my site: <a href="/MyProjects">My Projects</a> and the <a href="/Home/About">About Me Section</a>.</p>', 1, 1, '2013-11-17 00:00:00', '2015-02-21 22:27:36', '2013-11-17 00:00:00');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (17, 'I am an expert at nothing', 'blah', 'i-am-an-expert-at-nothing', '<p>Languages I work in on a weekly basis:</p>&#13;<ul>&#13;  <li>&#13;    Javascript&#13;    <ul>&#13;      <li>Angular.js, Require.js, jQuery</li>&#13;    </ul>&#13;  </li>&#13;  <li>Swift, ObjectiveC</li>&#13;  <li>PHP</li>&#13;  <li>MySQL</li>&#13;  <li>Laravel with Eloquent ORM</li>&#13;  <li>Java</li>&#13;  <li>Liquibase Database management</li>&#13;  <li>C# with ASP.NET</li>&#13;</ul>', 0, 1, '2015-02-16 00:00:00', '2015-08-22 23:28:48', '2015-02-16 00:00:00');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (18, 'Entity Framework: Eagerly loading entities across join tables', 'Not just another easy one-to-many scenario', 'entity-framework-eagerly-loading-across-join-tables', '<p>Here''s the scenario: I have an entity called ''Property'' to represent a house in a real estate application and another entity called ''Image'' that represents a picture (Shocker). My assumption is that a ''Property'' can have many ''Image''(s) and for reusability of the ''Image'' class, an ''Image'' can be related to many other entities so I created a join table called ''PropertyImage''.</p>

<strong>Property Entity</strong>
<pre class="brush: csharp">
public class Property
{
    public int Id { get; set; }
    ...
    public virtual ICollection&lt;PropertyImage&gt; PropertyImages { get; set; }
}
</pre>

<strong>Image Entity</strong>
<pre class="brush: csharp">
public class Image
{
    public int Id { get; set; }
    public string Url { get; set; }
    public string AlternateText { get; set; }
    public string Description { get; set; }
}
</pre>

<strong>PropertyImage Entity</strong>
<pre class="brush: csharp">
public class PropertyImage
{
    public int Id { get; set; }
    public Image Image { get; set; }
    public Property Property { get; set; }
    public string PropertySection { get; set; }
}
</pre>
<strong>A Pretty ERD for the visual people out there</strong>
<img class="img-responsive img-border" src="http://cdn.gentryriggen.com/binary/Relationship.JPG" alt="Entity Relationship Diagram for the relationship"/>

<p>So now when I look at a property, I want to get back a collection of PropertyImages each with its own Image object. I am no dummy when it comes to Entity Framework so I query the Property DbSet appropriately by using "Include" in my query so that it includes the collection of PropertyImage objects.</p>

<pre class="brush: csharp">
public override IQueryable&lt;Property&gt; GetAll()
{
    return base.GetAll()
        .Include(p => p.PropertyImages);
}
</pre>

<p>And I do the same on the PropertyImage query to eager load the Image and Property objects.</p>

<pre class="brush: csharp">
public override IQueryable&lt;PropertyImage&gt; GetAll()
{
    return base.GetAll()
        .Include(pi => pi.Image)
        .Include(pi => pi.Property);
}
</pre>

<p>I am so smart so I run my application, get all my Property objects, create an img tag for each Property.PropertyImage.Image.Url and POOOF!!! <strong>''System.NullReferenceException''</strong>. What the heck?!? I step through the debugger and see that each Property has a collection of PropertyImage objects. So far so good. I then dig into each PropertyImage object and see that the Image is null. Damnit, my Entity Framework ego is completely deflated at this point. I Google with Bing and keep seeing every reference to use "Include" on my queries. All the easy One-To-Many queries are very well documented and plenty of points are earned on StackOverflow for that question, but what about eagerly loading across a join table? I could do it in SQL (after I Google with Bing for a bit)... Finally I found the solution. You do use an "Include" but do a little bit more work inside the "Include" than a simple lambda expression.</p>

<pre class="brush: csharp">
public override IQueryable&lt;Property&gt; GetAll()
{
    return base.GetAll()
        .Include(p => p.PropertyImages)
        .Include(p => from pi in p.PropertyImages
            select pi.Image);
}
</pre>
<p>As you can see, you need to walk that line across the Join Table and include each Image Object. Whew! I hope this helps your Entity Framework egos out there stay strong.</p>', 1, 1, '2013-12-27 00:00:00', '2015-06-13 21:30:47', '2013-12-27 00:00:00');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (19, 'JSON Web Tokens in ASP.NET Web API', 'My solution for using JWTs in Web API', 'json-web-tokens-aspnet-web-api', '<p><img src="http://cdn.gentryriggen.com/binary/jsonWebTokens.jpg" class="img-responsive"/></p><p>Recently I updated this very blog to have an Angular.js front end while still maintaining an ASP.NET backend with Web API. The first problem I had to solve was authentication/authorization since I could no longer rely on the built-in Forms Authentication with MVC. I wanted a solution that was just as elegant and easy to use though. I wasn''t willing to sacrifice the simplicity of adding attributes such as the following to my controllers and their methods. </p><pre>[Authorize(Roles = &#34;User, Admin&#34;)]</pre><p>I knew from the beginning I was going to be doing token based authentication with my Angular app and decided to use JSON Web Tokens (JWTs) because they are quickly becoming the de facto standard for token formats. With these two concerns in mind I set out to create an <a href="https://msdn.microsoft.com/en-us/library/system.web.http.filters.authorizationfilterattribute">AuthorizationFilterAttribute</a> class that could parse JWTs.</p><h2><b>Serializing &amp; Deserializing JWTs in .NET</b></h2><p>The first step is having the ability to parse/decode JWTs as this is the token that will be sent on every authenticated request. I first looked at some .NET libraries already available but I wanted to fully understand the <a href="http://tools.ietf.org/html/draft-ietf-oauth-json-web-token-07">JWT standard of implementation</a>. Eventually I stumbled onto this <a href="https://code.google.com/p/wallet-online-sample-csharp/source/browse/JWT/JWT.cs?r=d292e4a1d4b7dc5420382fc170c084f724e5188e">.NET class</a> <a href="http://john-sheehan.com">John Sheehan</a> wrote. It is extremely simple and straightforward to use for encoding and decoding JWTs. I wrapped this functionality into a JWT model class that matched what I was looking to put into my tokens. BTW, <a href="http://gentryriggen.com/#!/blog/open-sourcing-this-blog" target="">my blog is open source</a> if you want to see the full implementation.</p><h2><b>Get JWTs passed in by the request</b></h2><p>The second step is to create a new filter class that extends AuthorizationFilterAttribute. Extending this class allows you to annotate classes and methods. AuthorizationFilterAttribute has an OnAuthorization method that you can override. The method gives you access to the request in an <a href="https://msdn.microsoft.com/en-us/library/system.web.http.controllers.httpactioncontext(v=vs.118).aspx" target="">HttpActionContext</a>. It''s in this method where we will find the JWT and validate the user''s authenticity as well as authorization.</p><pre>// Defined at the top of class&#10;private const string TOKEN_HEADER = &#34;Authorization&#34;;&#10;&#10;&#10;IEnumerable values;&#10;string token = String.Empty;&#10;var headers = actionContext.Request.Headers;&#10;headers.TryGetValues(TOKEN_HEADER, out values);&#10;if (values != null &amp;&amp; values.Count() &gt; 0)&#10;{&#10;    token = values.First().Split('' '')[1];&#10;}&#10;else &#10;{&#10;    actionContext.Response = new HttpResponseMessage(HttpStatusCode.Unauthorized);&#10;    return;&#10;}&#10;</pre><p>With the above code I grab the Authorization header that should be passed. An example would be <b>Authorization: Bearer SADLJ23ASDFIJ23459SFJQ239RQJAFG </b>where the token follows ''Bearer'' by a single space. If I cannot find the token, I immediately set the response to be unauthorized and stop processing which stops the whole chain and my controller''s code is never invoked.</p><h2><b>Info I receive from deserialized JWTs</b></h2><p>Once I have the JWT I decode it into my JsonWebToken class. In my implementation that basically looks like:</p><pre>private const int DEFAULT_EXPIRATION_TIME = 2592000;&#10;private const string DEFAULT_ISSUER = &#34;gentryriggen.com&#34;;&#10;public User User { get; set; }&#10;public int ExpirationEpoch { get; set; }&#10;public IEnumerable&lt;string&gt; Claims { get; set; }&#10;</pre><h2><b>Check the validity of the JWT</b></h2><p>Deserializing the JWT gives me access to a user object, an expiration time and a list of claims the user has. With all this information I can now see whether or not this user is a legitimate user in my app and if they have access to the resource. For that I created this straight forward <b>ValidateToken</b> method.</p><pre>public static bool ValidateToken(JsonWebToken token, ApplicationDataFactory dataFactory, string roles = null)&#10;{&#10;    // If past expiration&#10;    if (Utilities.GetEpochTimeNow() &gt; token.ExpirationEpoch)&#10;    {&#10;        return false;&#10;    }&#10;&#10;    // Ensure this is an existing user&#10;    User dbUser = dataFactory.Users.Find(token.User.Id);&#10;    if (dbUser == null) return false;&#10;&#10;    var userManager = new UserManager(new UserStore(dataFactory.Context));&#10;    // Check to see if the JWT lied about roles the user has&#10;    foreach (string role in userManager.GetRoles(dbUser.Id))&#10;    {&#10;        if (!token.Claims.Contains(role)) return false;&#10;    }&#10;&#10;    // Finally Check Roles requested the JWT verify&#10;    if (roles != null &amp;&amp; roles.Length &gt; 0 &amp;&amp; !String.IsNullOrEmpty(roles))&#10;    {&#10;        bool validClaims = false;&#10;        foreach (string claim in token.Claims)&#10;        {&#10;            if (roles.Contains(claim))&#10;            {&#10;                validClaims = true;&#10;                break;&#10;            }&#10;        }&#10;        if (!validClaims) return false;&#10;    }&#10;&#10;return true;&#10;}&#10;</pre><p>I first check to see if the token has expired. I then check to see if I have this user in my database. In the next step I verify that the JWT''s claims match what I have in my database (The user''s roles could have changed since they were issued this JWT). I then check the roles against the roles required for the requested resource.</p><h2><b>BOOM Simple!</b></h2><p>With this simple filter I am now able to place this attribute on any of my controllers or their methods.</p><pre>[TokenAuth(Roles=&#34;Admin, Editor&#34;)]</pre><p>Again all of this code is available on my <a href="https://github.com/gentryriggen/gentryriggen.com" target="">GitHub account</a>. Feel free to reach out to me with questions and or discussions in the comments section below.</p>', 1, 1, '2015-07-18 20:50:56', '2015-07-26 19:29:31','2015-07-18 20:50:56');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (20, 'Safely Open Sourcing your ASP.NET Website', 'Hide your secrets', 'safely-open-sourcing-your-asp-net-website', '<p>I recently open sourced the code for this very blog. It was scary because everyone could see my code and more importantly my implementation details. In an effort to hide my secret settings (like a database connection) yet still have an effortless deployment process I learned some tricks that I thought I''d throw out there.<br/></p>', 0, 1, '2015-03-08 06:13:38', '2015-07-29 03:57:38', '2015-03-08 06:13:38');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (21, 'Open Sourcing This Blog', 'For better or for worse', 'open-sourcing-this-blog', '<p>I have decided to open source the code for this blog <a href="https://github.com/GentryRiggen/gentryriggen.com" target="#">on GitHub</a>. My goal here is to create some blog posts detailing some of the patterns, libraries and techniques used to create it and have the code openly accessible for reference. I use this site regularly to test new software I am interested and thought it deserved to be shared.</p>', 1, 1, '2015-03-19 03:11:05', '2015-03-19 03:11:05', '2015-03-19 03:11:05');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (22, 'Angular Auth Flow for Users and Roles', 'A method I find to be elegant and simple', 'angular-auth-flow-for-users-and-roles', '<p><img src="http://cdn.gentryriggen.com/binary/ngAuthFlow.jpg" class="img-responsive"/></p><p>When building any application there are often complex rules around which pages a user is allowed to navigate to. You may have public pages, private pages, pages designed only for admins to see etc. Angular applications are no exception. In this blog post I am going to detail a solution I like to use. I have an example app here: <a href="https://github.com/GentryRiggen/ngAuthFlow">ngAuthFlow</a> demonstrating my approach.</p><p>First things first, this example assumes you are using Angular <a href="https://github.com/angular-ui/ui-router">UI-Router</a>. Angular UI-Router is a great routing library for adding customizable bits to your routes - or states as they like to call them. </p><p><span>Every time your app is initialized you need to do a check to see if the current user is logged in. In most applications I usually have a server request that fetches detail about the current user assuming they are authenticated. With UI-Router we can tap into the $stateChangeStart event like so.</span><br/></p><pre>$rootScope.$on(''$stateChangeStart'', function (event, toState, toParams) {}</pre><p>This is where I will make the user request. I have a service called userService that wraps the request in a promise so that if it needs to get the current user from the server it can resolve the promise when the request comes back. Additionally if the userService already has the user info it can just immediately resolve the promise. *Using a $timeout to simulate server requests in this example</p><pre>userSvc.getCurrentUser = function () {&#10;  var deferred = $q.defer();&#10;  if (angular.isUndefined($rootScope.currentUser)) {&#10;    $timeout(function() {&#10;       var random = Math.floor(Math.random() * 3);&#10;       $rootScope.currentUser = users[random];&#10;       $rootScope.$broadcast(&#34;currentUser&#34;, $rootScope.currentUser);&#10;         deferred.resolve($rootScope.currentUser);&#10;       }, 250);&#10;   } else {&#10;     deferred.resolve($rootScope.currentUser);&#10;   }&#10;&#10;   return deferred.promise;&#10;};&#10;</pre><p>In the $stateChangeStart event I will make the getCurrentUser call every time and then determine the user''s right to go to the route based on the state info. Let''s take a look at my states for this example application. </p><pre>$stateProvider&#10;  .state(''home'', {&#10;    url: ''/'',&#10;    templateUrl: ''app/main/main.html'',&#10;    controller: ''MainCtrl'',&#10;    data: {&#10;      requireLogin: false&#10;    }&#10;  })&#10;  .state(''admin'', {&#10;    url: ''/admin'',&#10;    templateUrl: ''app/admin/admin.html'',&#10;    controller: ''AdminCtrl'',&#10;    data: {&#10;      allowedRoles: [&#34;Admin&#34;]&#10;    }&#10;  })&#10;  .state(''pro'', {&#10;    url: ''/pro'',&#10;    templateUrl: ''app/pro/pro.html'',&#10;    controller: ''ProCtrl'',&#10;    data: {&#10;      allowedRoles: [&#34;Pro&#34;]&#10;    }&#10;  })&#10;  .state(''basic'', {&#10;    url: ''/basic'',&#10;    templateUrl: ''app/basic/basic.html'',&#10;    controller: ''BasicCtrl'',&#10;    data: {&#10;      allowedRoles: [&#34;Basic&#34;]&#10;    }&#10;  });&#10;</pre><p>You can see that I have added a <b>data</b> object to each state to encapsulate some of the properties I want to expose. Specifically I have added <b>requireLogin</b> and <b>allowedRoles</b>. <b>requireLogin</b> is a boolean to indicate whether or not this is a public route. <b>allowedRoles</b> is an array of roles that the user is required to be a part of - at least one - in order to go the route. </p><p>Finally let''s look at the logic that determines the user''s right to route to each state.</p><pre>app.run(function ($rootScope, $state, userService) {&#10;    $rootScope.$on(''$stateChangeStart'', function (event, toState, toParams) {&#10;        userService.getCurrentUser().then(&#10;            function (currentUser) {&#10;                var userIsAdmin = _.contains(currentUser.roles, &#34;Admin&#34;);&#10;                if (!userIsAdmin &amp;&amp;&#10;                    angular.isDefined(toState.data) &amp;&amp;&#10;                    angular.isDefined(toState.data.allowedRoles) &amp;&amp;&#10;                    toState.data.allowedRoles.length &gt; 0) {&#10;&#10;                    var allowedThrough = false;&#10;                    angular.forEach(toState.data.allowedRoles, function (role) {&#10;                        if (_.contains(currentUser.roles, role)) {&#10;                            allowedThrough = true;&#10;                        }&#10;                    });&#10;                    &#10;                    if (!allowedThrough) {&#10;                        // If we get this far, they don''t have access&#10;                        event.preventDefault();&#10;                    }&#10;                }&#10;            },&#10;            function () {&#10;                // This may be a public route&#10;                if (angular.isDefined(toState.data) &amp;&amp;&#10;                    angular.isDefined(toState.data.requireLogin) &amp;&amp;&#10;                    toState.data.requireLogin === false) {&#10;                    return;&#10;                } else {&#10;                    event.preventDefault();&#10;                }&#10;            }&#10;        );&#10;    });&#10;  })&#10;</pre><p>You can see that I have some logic in there to allow a user in the &#34;Admin&#34; role to trump everything. It should be obvious that with this approach you can customize your application in any number of ways to fit your business logic.</p><p>A quick note, you should have backend server logic that is ensuring these roles as well. This approach just aids in the user''s experience by not letting people access certain pages on the client.</p><p>Hope this helps and happy coding.</p>', 1, 1, '2015-06-03 04:14:56', '2015-07-26 19:19:33', '2015-06-03 04:14:56');
INSERT INTO blog_post(id, title, subtitle, permalink, content, visible, created_by, created_on, updated_on, visible_on) VALUES (23, 'Five Reasons Why You Should Be Doing Side Projects', 'At Least it''s the Five Reasons I Do Side Projects', '5-reasons-why-you-should-be-doing-side-projects', '<p><span>I have been doing side projects since before I became a software engineer. It''s actually one of the primary reasons I was able to land a job in the software industry. But benefits like landing a job don''t stop there. Here are my top five reasons for burning the midnight oil to work on side projects. </span><br/></p><h2 style="color: rgb(85, 85, 85);background-color: rgb(255, 255, 255);">1. The Best Way to Market Yourself</h2><p style="color: rgb(85, 85, 85);background-color: rgb(255, 255, 255);">Having side projects allows you to build your resume and your audience. This is especially true for me. One of my first side projects was creating an app to track my workouts called<span class="Apple-converted-space"> </span><a href="https://www.microsoft.com/en-us/store/apps/gym-bag-notebook/9nblggh0j953" target="" style="color: rgb(0, 174, 238);background-color: transparent;">Gym Bag Notebook</a>. Developing and releasing this app instantly gave me the credibility of a developer with thousands of users. In fact this app helped me land my job at<span class="Apple-converted-space"> </span><a href="http://trainheroic.com/" target="" style="color: rgb(0, 174, 238);background-color: transparent;">TrainHeroic</a>. </p><p style="color: rgb(85, 85, 85);background-color: rgb(255, 255, 255);">Imagine this for one second. You have a passion that you are really excited about - for me this was working out. You pursue that passion by trying to build software around it - for me this was creating an app for my phone. Then after you have created that software people approach you and say &#34;Hey! That''s really cool. Would you mind if we paid you to do that full-time?&#34; What are you going to say?</p><h2><span style="color: inherit;">2. Stress Free Development Time</span><br/></h2><p>With the project schedule being dictated by no one but yourself, you are free to spend time on whatever you deem necessary. If you are anything like me you have probably been in a situation where you were unable to put forth your best software because there was just not enough time in the schedule. With side projects you get to experience the freedom and excitement of development you experienced when you were just starting. </p><p>Additionally you alone define requirements. You get to prioritize items in your project that invigorate you. For some that is pushing an application''s performance and for others it could be doing great designs and UX.</p><h2>3. Passion Produces the Best Results</h2><p>As a software developer you need to be constantly pushing the boundaries of what you think you are capable of doing. The only way I know how to consistently do this is to be passionate about the content.</p><p>Let''s be real - being passionate about your full time job can be tough. Maybe this is not the case for some of you but for 99% of the rest of us it''s a fact. Side projects keep us loving what we do as software engineers and that keeps your skills relevant.</p><h2>4. Join New Communities</h2><p>When you start working in a new technology, you will quickly find out who''s who. It doesn''t matter how small or obscure your side project is, there are others out there who are working on the same stack. Get involved with these communities. Answer questions on StackOverflow. Go to local MeetUps. All of these things will increase your knowledge, help grow your network and reinforce your passion. </p><h2>5. Solve Problems and Bring Solutions to Your Day Job </h2><p>I am very fortunate to work in web development which is what I really enjoy doing the most in my free time. I can''t tell you how many times I was working on an issue at work and decided to try and solve it in a unique way on one of my side projects. I even blog about it sometimes to <a href="http://gentryriggen.com/#!/blog/angular-auth-flow-for-users-and-roles" target="">share my learnings</a>.</p><p>When I do this I learn a ton and get to be the dev at work who brings solutions. It''s a key advantage to remaining employable. </p><p>In the end JUST DO IT!</p>', 1, 1, '2015-07-28 04:21:30', '2015-08-02 03:17:50', '2015-07-28 04:21:30');



