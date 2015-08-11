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
  content    LONGTEXT,
  created_by INT             NOT NULL,
  created_on DATETIME,
  updated_on DATETIME        NOT NULL
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
