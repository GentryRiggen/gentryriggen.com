CREATE TABLE author
(
    id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(32) NOT NULL,
    last_name VARCHAR(32) NOT NULL
);
CREATE UNIQUE INDEX unique_id ON author (id);
INSERT INTO author (first_name, last_name) VALUES('default', 'default');
SET @defaultAuthorId = LAST_INSERT_ID();


CREATE TABLE book_series
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  title VARCHAR(64) NOT NULL
);
CREATE UNIQUE INDEX unique_id ON book_series (id);



CREATE TABLE book
(
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
  author_id INT NOT NULL,
  book_series_id INT,
  title VARCHAR(128) NOT NULL,
  artwork_url VARCHAR(256) NOT NULL,
  file_url VARCHAR(256) NOT NULL,
  publish_date DATETIME NOT NULL,
  rating INT DEFAULT 1 NOT NULL,
  fiction INT DEFAULT 0 NOT NULL,
  review LONGTEXT
);
CREATE UNIQUE INDEX unique_id ON book (id);
ALTER TABLE book ADD FOREIGN KEY (author_id) REFERENCES author(id);
ALTER TABLE book ADD FOREIGN KEY (book_series_id) REFERENCES book_series(id);


INSERT INTO role (title) VALUES('Librarian');
SET @librarianRoleId = LAST_INSERT_ID();
INSERT INTO user_role (user_id, role_id) VALUES(1, @librarianRoleId);

INSERT INTO book (author_id, book_series_id, title, artwork_url, file_url, publish_date, rating, fiction)
VALUES(@defaultAuthorId, NULL, 'Freedom', 'freedomDanielSuarez.jpg', '', '2013-12-27 00:00:00', 5, 1);
