USE digital;

ALTER TABLE hosts ADD COLUMN IF NOT EXISTS address VARCHAR(500) DEFAULT NULL;
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6) DEFAULT NULL;
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6) DEFAULT NULL;

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
