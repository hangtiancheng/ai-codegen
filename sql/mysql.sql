-- docker exec -i mysql mysql -uroot -ppass < ./sql/main.sql

DROP DATABASE IF EXISTS swifty_codegen;

CREATE DATABASE IF NOT EXISTS swifty_codegen;

USE swifty_codegen;

CREATE TABLE IF NOT EXISTS "users"
(
    id            BIGINT AUTO_INCREMENT                  COMMENT 'id' PRIMARY KEY,
    user_account  VARCHAR(256)                           NOT NULL COMMENT 'user account',
    user_password VARCHAR(512)                           NOT NULL COMMENT 'password',
    username      VARCHAR(256)                           NULL     COMMENT 'username',
    user_avatar   VARCHAR(1024)                          NULL     COMMENT 'user avatar',
    user_profile  VARCHAR(512)                           NULL     COMMENT 'user profile',
    user_role     VARCHAR(256) DEFAULT 'user'            NOT NULL COMMENT 'user role',
    edit_time     DATETIME     DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'edit time',
    create_time   DATETIME     DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'create time',
    update_time   DATETIME     DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'update time',
    is_delete     TINYINT      DEFAULT 0                 NOT NULL COMMENT 'is delete, default 0, 1 as deleted',
    UNIQUE KEY uk_user_account (user_account),
    INDEX idx_username (username)
) COMMENT 'users' COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS "apps"
(
    id           BIGINT AUTO_INCREMENT              COMMENT 'id' PRIMARY KEY,
    app_name     VARCHAR(256)                       NULL     COMMENT 'app name',
    app_cover    VARCHAR(512)                       NULL     COMMENT 'app cover',
    init_prompt  TEXT                               NULL     COMMENT 'init prompt',
    priority     INT      DEFAULT 0                 NOT NULL COMMENT 'priority',
    user_id      BIGINT                             NOT NULL COMMENT 'creator user id',
    edit_time    DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'edit time',
    create_time  DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'create time',
    update_time  DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'update time',
    is_delete    TINYINT  DEFAULT 0                 NOT NULL COMMENT 'is delete, default 0, 1 as deleted',
    INDEX idx_app_name (app_name),
    INDEX idx_user_id (user_id)
) COMMENT 'apps' COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS "chat_histories"
(
    id           BIGINT AUTO_INCREMENT              COMMENT 'id' PRIMARY KEY,
    message      TEXT                               NOT NULL COMMENT 'message',
    message_type VARCHAR(32)                        NOT NULL COMMENT 'user or ai',
    app_id       BIGINT                             NOT NULL COMMENT 'app id',
    user_id      BIGINT                             NOT NULL COMMENT 'creator user id',
    create_time  DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'create time',
    update_time  DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'update time',
    is_delete    TINYINT  DEFAULT 0                 NOT NULL COMMENT 'is delete, default 0, 1 as deleted',
    INDEX idx_chat_app_id (app_id),
    INDEX idx_chat_create_time (create_time),
    INDEX idx_chat_app_id_create_time (app_id, create_time)
) COMMENT 'chat history' COLLATE = utf8mb4_unicode_ci;
