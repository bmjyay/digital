CREATE DATABASE IF NOT EXISTS digital;
USE digital;

CREATE TABLE IF NOT EXISTS hosts (
    h_id     INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    gender   VARCHAR(50),
    email    VARCHAR(255),
    phone    VARCHAR(50),
    capacity INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS hostees (
    he_id  INT AUTO_INCREMENT PRIMARY KEY,
    name   VARCHAR(255) NOT NULL,
    gender VARCHAR(50),
    email  VARCHAR(255),
    phone  VARCHAR(50),
    h_id   INT DEFAULT NULL,
    FOREIGN KEY (h_id) REFERENCES hosts(h_id)
);

CREATE TABLE IF NOT EXISTS users (
    u_id     INT AUTO_INCREMENT PRIMARY KEY,
    h_id     INT,
    password VARCHAR(255),
    FOREIGN KEY (h_id) REFERENCES hosts(h_id)
);

CREATE TABLE IF NOT EXISTS friendships (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user1        INT,
    user2        INT,
    status       VARCHAR(50),
    requested_at DATETIME,
    accepted_at  DATETIME DEFAULT NULL,
    FOREIGN KEY (user1) REFERENCES users(u_id),
    FOREIGN KEY (user2) REFERENCES users(u_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    f_id         INT AUTO_INCREMENT PRIMARY KEY,
    u_id         INT,
    published_at DATETIME,
    content      TEXT,
    category     VARCHAR(100),
    FOREIGN KEY (u_id) REFERENCES users(u_id)
);
