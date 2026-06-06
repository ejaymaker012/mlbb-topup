CREATE DATABASE mlbb_topup;
USE mlbb_topup;

CREATE TABLE Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  mlbb_id VARCHAR(50),
  mlbb_server VARCHAR(50),
  isAdmin BOOLEAN DEFAULT FALSE
);

CREATE TABLE TopUps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  mlbb_id VARCHAR(50),
  mlbb_server VARCHAR(50),
  diamonds INT,
  amount DECIMAL(10,2),
  method VARCHAR(50),
  status ENUM('pending','success','failed') DEFAULT 'success',
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id)
);
