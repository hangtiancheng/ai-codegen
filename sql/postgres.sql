-- docker exec -i postgres psql -U root -W pass < ./sql/postgres.sql

DROP DATABASE IF EXISTS swifty_codegen;
CREATE DATABASE swifty_codegen WITH ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;

\c swifty_codegen;

CREATE OR REPLACE FUNCTION set_update_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS "users" (
    id            BIGSERIAL    PRIMARY KEY,
    user_account  VARCHAR(256) NOT NULL,
    user_password VARCHAR(512) NOT NULL,
    username      VARCHAR(256),
    user_avatar   VARCHAR(1024),
    user_profile  VARCHAR(512),
    user_role     VARCHAR(256) NOT NULL DEFAULT 'user',
    edit_time     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_delete     SMALLINT     NOT NULL DEFAULT 0,
    CONSTRAINT uk_user_account UNIQUE (user_account)
);

COMMENT ON TABLE  "users"               IS 'user';
COMMENT ON COLUMN "users".id            IS 'id';
COMMENT ON COLUMN "users".user_account  IS 'user account';
COMMENT ON COLUMN "users".user_password IS 'password';
COMMENT ON COLUMN "users".username      IS 'username';
COMMENT ON COLUMN "users".user_avatar   IS 'user avatar';
COMMENT ON COLUMN "users".user_profile  IS 'user profile';
COMMENT ON COLUMN "users".user_role     IS 'user role';
COMMENT ON COLUMN "users".edit_time     IS 'edit time';
COMMENT ON COLUMN "users".create_time   IS 'create time';
COMMENT ON COLUMN "users".update_time   IS 'update time';
COMMENT ON COLUMN "users".is_delete     IS 'is delete, default 0, 1 as deleted';

CREATE INDEX idx_username ON "users" (username);

CREATE TRIGGER trg_user_update_time
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION set_update_time();

CREATE TABLE IF NOT EXISTS "apps" (
    id           BIGSERIAL    PRIMARY KEY,
    app_name     VARCHAR(256),
    app_cover    VARCHAR(512),
    init_prompt  TEXT,
    priority     INT          NOT NULL DEFAULT 0,
    user_id      BIGINT       NOT NULL,
    edit_time    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    create_time  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_delete    SMALLINT     NOT NULL DEFAULT 0
);

COMMENT ON TABLE  "apps"              IS 'app';
COMMENT ON COLUMN "apps".id           IS 'id';
COMMENT ON COLUMN "apps".app_name     IS 'app name';
COMMENT ON COLUMN "apps".app_cover    IS 'app cover';
COMMENT ON COLUMN "apps".init_prompt  IS 'init prompt';
COMMENT ON COLUMN "apps".priority     IS 'priority';
COMMENT ON COLUMN "apps".user_id      IS 'creator user id';
COMMENT ON COLUMN "apps".edit_time    IS 'edit time';
COMMENT ON COLUMN "apps".create_time  IS 'create time';
COMMENT ON COLUMN "apps".update_time  IS 'update time';
COMMENT ON COLUMN "apps".is_delete    IS 'is delete, default 0, 1 as deleted';

CREATE INDEX idx_app_name ON "apps" (app_name);
CREATE INDEX idx_user_id  ON "apps" (user_id);

CREATE TRIGGER trg_app_update_time
BEFORE UPDATE ON "apps"
FOR EACH ROW EXECUTE FUNCTION set_update_time();

CREATE TABLE IF NOT EXISTS "chat_histories" (
    id           BIGSERIAL   PRIMARY KEY,
    message      TEXT        NOT NULL,
    message_type VARCHAR(32) NOT NULL,
    app_id       BIGINT      NOT NULL,
    user_id      BIGINT      NOT NULL,
    create_time  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_delete    SMALLINT    NOT NULL DEFAULT 0
);

COMMENT ON TABLE  "chat_histories"              IS 'chat history';
COMMENT ON COLUMN "chat_histories".id           IS 'id';
COMMENT ON COLUMN "chat_histories".message      IS 'message';
COMMENT ON COLUMN "chat_histories".message_type IS 'user or ai';
COMMENT ON COLUMN "chat_histories".app_id       IS 'app id';
COMMENT ON COLUMN "chat_histories".user_id      IS 'creator user id';
COMMENT ON COLUMN "chat_histories".create_time  IS 'create time';
COMMENT ON COLUMN "chat_histories".update_time  IS 'update time';
COMMENT ON COLUMN "chat_histories".is_delete    IS 'is delete, default 0, 1 as deleted';

CREATE INDEX idx_chat_app_id              ON "chat_histories" (app_id);
CREATE INDEX idx_chat_create_time         ON "chat_histories" (create_time);
CREATE INDEX idx_chat_app_id_create_time  ON "chat_histories" (app_id, create_time);

CREATE TRIGGER trg_chat_history_update_time
BEFORE UPDATE ON "chat_histories"
FOR EACH ROW EXECUTE FUNCTION set_update_time();
