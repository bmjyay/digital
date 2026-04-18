CREATE DATABASE IF NOT EXISTS digital;
USE digital;

CREATE TABLE IF NOT EXISTS hosts (
    h_id     INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    gender   VARCHAR(50),
    email    VARCHAR(255),
    phone    VARCHAR(50),
    capacity INT DEFAULT 1,
    address  VARCHAR(500) DEFAULT NULL,
    lat      DECIMAL(9,6) DEFAULT NULL,
    lng      DECIMAL(9,6) DEFAULT NULL
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

CREATE TABLE IF NOT EXISTS messages (
    m_id      INT AUTO_INCREMENT PRIMARY KEY,
    from_u_id INT NOT NULL,
    to_u_id   INT NOT NULL,
    content   TEXT NOT NULL,
    sent_at   DATETIME NOT NULL,
    read_at   DATETIME DEFAULT NULL,
    FOREIGN KEY (from_u_id) REFERENCES users(u_id),
    FOREIGN KEY (to_u_id) REFERENCES users(u_id)
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id INT AUTO_INCREMENT PRIMARY KEY,
    name   VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS host_tags (
    h_id   INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (h_id, tag_id),
    FOREIGN KEY (h_id) REFERENCES hosts(h_id),
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
    r_id        INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(100) DEFAULT 'general',
    address     VARCHAR(500),
    description TEXT,
    url         VARCHAR(500),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itinerary (
    i_id        INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    location    VARCHAR(255),
    start_time  DATETIME,
    end_time    DATETIME,
    category    VARCHAR(100) DEFAULT 'general'
);
